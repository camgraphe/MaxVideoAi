import { createHash } from 'node:crypto';
import { getAudioPackConfig, type AudioGenerateRequestBody } from '@/lib/audio-generation';
import { computeCanonicalAudioBillingSnapshot } from '@/server/pricing/quote-billing';
import { inspectSourceVideo, resolveAudioAspectRatio } from './media';
import { loadSourceJob } from './audio-generate-jobs';
import { AudioGenerationError, resolveAudioRenderDuration, validateAudioGenerateRequest } from './audio-generate-validation';
import { isVideoBackedPack } from './audio-generate-snapshots';
import { isGoogleVertexLyria3Configured } from './providers/google-vertex-lyria';
import type { ResolveServerPricingPolicyDependencies } from '@/server/pricing/resolve-pricing-policy';

export function assertAudioProviderConfigured(normalized: ReturnType<typeof validateAudioGenerateRequest>, env = process.env) {
  const music = normalized.pack === 'music_only' || normalized.musicEnabled;
  if (music && !isGoogleVertexLyria3Configured(env)) throw new AudioGenerationError('Lyria is currently unavailable.', { status: 503, code: 'audio_provider_unavailable' });
  if (normalized.pack !== 'music_only' && !(env.FAL_API_KEY || env.FAL_KEY)) throw new AudioGenerationError('Audio provider is currently unavailable.', { status: 503, code: 'audio_provider_unavailable' });
}

export function audioQuoteInputKey(userId: string, normalized: unknown, durationSec: number) {
  return createHash('sha256').update(JSON.stringify({ userId, normalized, durationSec })).digest('hex');
}

export function assertExpectedAudioQuote(expected: AudioGenerateRequestBody['expectedQuote'], actual: { inputKey: string; pricing: { totalCents: number; currency: string } }, now = Date.now()) {
  if (!expected) return; // Existing Studio and historical callers remain compatible; all prices are still computed on the server.
  if (expected.inputKey !== actual.inputKey || expected.totalCents !== actual.pricing.totalCents || expected.currency !== actual.pricing.currency || !Number.isFinite(expected.expiresAt) || expected.expiresAt <= now || expected.expiresAt > now + 120_000) {
    throw new AudioGenerationError('The audio quote changed. Review the current price.', { status: 409, code: 'audio_quote_stale' });
  }
}

export async function prepareAudioRun(body: AudioGenerateRequestBody, userId: string, dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies; env?: NodeJS.ProcessEnv } = {}) {
  const normalized = validateAudioGenerateRequest(body);
  assertAudioProviderConfigured(normalized, dependencies.env);
  const packConfig = getAudioPackConfig(normalized.pack);
  const sourceJob =
    normalized.sourceJobId
      ? await loadSourceJob(userId, normalized.sourceJobId)
      : null;

  if (normalized.sourceJobId && !sourceJob) {
    throw new AudioGenerationError('Source job not found.', {
      status: 404,
      code: 'source_job_not_found',
      field: 'sourceJobId',
    });
  }

  const sourceVideoUrl = normalized.sourceVideoUrl ?? sourceJob?.video_url ?? null;
  if (packConfig.requiresVideo && !sourceVideoUrl) {
    throw new AudioGenerationError('Source video is missing.', {
      status: 400,
      code: 'source_video_missing',
      field: 'sourceVideoUrl',
    });
  }

  const needsSourceProbe = Boolean(sourceVideoUrl) && (packConfig.requiresVideo || normalized.pack === 'music_only');
  const sourceProbe = needsSourceProbe && sourceVideoUrl ? await inspectSourceVideo(sourceVideoUrl) : null;
  const probedDurationSec = sourceProbe?.durationSec ?? null;
  const durationSec = resolveAudioRenderDuration({
    pack: normalized.pack,
    sourceVideoUrl,
    requiresVideo: packConfig.requiresVideo,
    probedDurationSec,
    requestedDurationSec: normalized.durationSec,
    script: normalized.script,
  });

  const aspectRatio =
    sourceJob?.aspect_ratio ??
    resolveAudioAspectRatio(sourceProbe?.width ?? null, sourceProbe?.height ?? null) ??
    (isVideoBackedPack(normalized.pack) ? '16:9' : null);
  const pricingSnapshot = await computeCanonicalAudioBillingSnapshot({
    pack: normalized.pack,
    durationSec,
    mood: normalized.mood ?? null,
    voiceMode: normalized.voiceMode,
    script: normalized.script,
    voiceModel: normalized.voiceModel,
    musicModel: normalized.musicModel,
    musicBpm: normalized.musicBpm,
    musicEnabled: normalized.musicEnabled,
  }, { pricingPolicy: dependencies.pricingPolicy });
  const inputKey = audioQuoteInputKey(userId, normalized, durationSec);
  return { normalized, packConfig, sourceJob, sourceVideoUrl, sourceProbe, durationSec, aspectRatio, pricingSnapshot, inputKey };
}
