import type { z } from 'zod';
import { query } from '@/lib/db';
import { buildRecastBrief } from '@/lib/character-studio-recast';
import { resolveStudioOutput } from './source';
import { saveJobOutputToLibrary, ensureReusableAsset } from '@/server/media-library';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { prepareVideoExcerpt } from '@/server/video-excerpts/prepare';
import { prepareAudioExcerpt } from '@/server/video-excerpts/prepare-audio';
import { createCreatorGenerationService } from '@/server/tools/creator-generation-service';
import { reservePaidGenerationInitialJob } from '@/server/agent-api/paid-generation-execution';
import { AgentApiError } from '@/server/agent-api/errors';
import type { CanonicalGenerationReference } from '@/server/agent-api/generation-types';
import { requireGenerationActor, type GenerationActor } from '@/server/agent-api/generation-actor';
import type { CreatorGenerationOptions } from '@/server/tools/creator-generation-service';

import { recastSettings as settings } from './recast-request';
import { recastConfirmationInput } from './integration-request';

const engineId = 'wan-3-prime';
export async function resolveCharacterPortraitAsset(userId: string, portrait: z.infer<typeof settings>['portrait']) {
  if ('assetId' in portrait) return portrait.assetId;
  await resolveStudioOutput({ query }, userId, portrait.jobId, portrait.imageUrl);
  const [existing] = await query<{ public_id: string }>(
    `SELECT public_id FROM media_assets WHERE user_id=$1 AND source_job_id=$2 AND kind='image'
     AND (url=$3 OR metadata->>'originUrl'=$3) AND status='ready' AND deleted_at IS NULL LIMIT 1`,
    [userId, portrait.jobId, portrait.imageUrl],
  );
  if (existing?.public_id) return existing.public_id;
  const [output] = await query<{ id: string }>(
    `SELECT id FROM job_outputs WHERE user_id=$1 AND job_id=$2 AND kind='image'
     AND (url=$3 OR storage_url=$3) AND status='ready' LIMIT 1`,
    [userId, portrait.jobId, portrait.imageUrl],
  );
  if (output) {
    const asset = await saveJobOutputToLibrary({ userId, jobId: portrait.jobId, outputId: output.id });
    if (asset.publicId) return asset.publicId;
  }
  // Legacy completed jobs can predate the job_outputs projection.
  const legacy = await ensureReusableAsset({
    userId,
    kind: 'image',
    url: portrait.imageUrl,
    source: 'saved_job_output',
    sourceJobId: portrait.jobId,
  });
  if (legacy.publicId) return legacy.publicId;
  throw new AgentApiError('REFERENCE_NOT_FOUND', 'The original character image is unavailable.');
}

const dependencies = {
  prepareVideo: prepareVideoExcerpt,
  prepareAudio: prepareAudioExcerpt,
  generation: createCreatorGenerationService,
};

export type RecastPreparationDependencies = typeof dependencies;
export type RecastLifecycleOptions = Pick<CreatorGenerationOptions, 'accountUrl' | 'onQuotePrepared'>;

export async function prepareRecast(actor: GenerationActor, value: unknown, deps = dependencies, options: RecastLifecycleOptions = {}) {
  requireGenerationActor(actor);
  const s = settings.parse(value);
  const mode = s.video ? 'v2v' : s.audio || s.product ? 'ref2v' : 'i2v';
  const portrait = await resolveCharacterPortraitAsset(actor.userId, s.portrait);
  const references: CanonicalGenerationReference[] = [];
  for (const id of [portrait, s.product]) {
    if (!id) continue;
    await resolveStudioMedia(actor.userId, { type: 'asset', assetId: id, kind: 'image' });
    references.push({ kind: 'asset', assetId: id, role: mode === 'i2v' ? 'first_frame' : 'reference' });
  }
  const passages: Partial<
    Record<
      'audio' | 'video',
      { startSec: number; endSec: number; durationSec: number; sourceId: string; excerptId: string }
    >
  > = {};
  // Both workers use the same per-account slot. Each materializes and probes the exact requested passage.
  for (const kind of ['video', 'audio'] as const) {
    const input = s[kind];
    if (!input) continue;
    const prepare = kind === 'video' ? deps.prepareVideo : deps.prepareAudio;
    const { asset } = await prepare(actor.userId, {
      source: { type: 'asset', kind, assetId: input.assetId },
      engineId,
      mode,
      fieldId: kind === 'video' ? 'video_url' : 'reference_audio_urls',
      range: input.range,
    });
    if (!asset.assetId || asset.assetId === input.assetId || !asset.durationSec)
      throw new AgentApiError('REFERENCE_INVALID', 'The prepared passage is unavailable.');
    references.push({
      kind: 'asset',
      assetId: asset.assetId,
      role: kind === 'video' ? 'source' : 'reference',
    });
    passages[kind] = {
      ...input.range,
      durationSec: asset.durationSec,
      sourceId: input.assetId,
      excerptId: asset.assetId,
    };
  }
  const brief = buildRecastBrief({
    character: 'character',
    source: s.video && 'video',
    product: s.product,
    audio: s.audio && 'audio',
    dialogue: s.dialogue,
    direction: s.direction,
  });
  // Opt in to ordered identity/product/audio references without reinterpreting
  // older Wan quotes whose unnumbered references remain canonical as stored.
  let referenceSlot = 0;
  for (const reference of references) {
    if (reference.role === 'reference') reference.slot = referenceSlot++;
  }
  const quote = await deps
    .generation(actor, {
      enabled: true,
      accountUrl: options.accountUrl,
      billingProduct: 'character-recast',
      onQuotePrepared: async (quote, tx) => {
        await tx.query(
          'INSERT INTO character_studio_recast_quotes(quote_id,user_id,request_hash,passages) VALUES ($1,$2,$3,$4::jsonb)',
          [quote.quoteId, actor.userId, quote.requestHash, JSON.stringify(passages)],
        );
        await options.onQuotePrepared?.(quote, tx);
      },
    })
    .prepare({
      surface: 'video',
      engineId,
      mode,
      prompt: brief.prompt,
      references,
      settings: {
        durationSec: s.seconds,
        resolution: s.resolution,
        aspectRatio: s.aspectRatio,
        audio: brief.generateAudio,
      },
    });
  return {
    kind: 'wallet' as const,
    quoteId: quote.quoteId,
    expiresAt: quote.expiresAt,
    amountCents: quote.price.amountCents,
    currency: quote.price.currency,
    topupRequired: quote.topupRequired,
    sourceSeconds: passages.video?.durationSec ?? 0,
    audioSeconds: passages.audio?.durationSec ?? 0,
    passages,
    quote,
  };
}

export async function confirmRecast(
  actor: GenerationActor,
  value: unknown,
  generation = createCreatorGenerationService,
  options: Pick<RecastLifecycleOptions, 'accountUrl'> = {},
) {
  requireGenerationActor(actor);
  const input = recastConfirmationInput.parse(value);
  const job = await generation(actor, {
    enabled: true,
    accountUrl: options.accountUrl,
    billingProduct: 'character-recast',
    onQuoteLocked: async (quote, tx) => {
      const [row] = await tx.query(
        'SELECT quote_id FROM character_studio_recast_quotes WHERE quote_id=$1 AND user_id=$2 AND request_hash=$3 FOR SHARE',
        [quote.quoteId, actor.userId, quote.requestHash],
      );
      if (
        !row ||
        quote.request.engineId !== engineId ||
        quote.priceCents !== input.amountCents ||
        quote.currency !== input.currency
      ) {
        throw new AgentApiError('QUOTE_EXPIRED', 'Review the current Recast quote.');
      }
    },
    confirmDependencies: {
      reserveInitialJob: (input, deps) =>
        reservePaidGenerationInitialJob({ ...input, billingProduct: 'character-recast', customerProductLabel: 'MaxVideoAI Recast' }, deps),
    },
  }).confirm({ quoteId: input.quoteId, confirmed: true });
  return { jobId: job.jobId, status: job.status };
}
