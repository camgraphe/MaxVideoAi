import { getFalClient } from '@/lib/fal-client';
import { assertFalModelAllowed } from '@/lib/fal-model-policy';
import { AudioProviderError } from './error';
import { AUDIO_PROVIDER_ROSTER, AUDIO_PROVIDER_TIMEOUT_MS, ENABLE_AUDIO_PROVIDER_FALLBACK } from './roster';
import { findCustomVoiceId, findFileUrl } from './response';
import type {
  AudioPipelineRole,
  AudioProviderAttemptFailure,
  AudioProviderCandidate,
  AudioProviderResult,
  AudioProviderSubscribe,
} from './types';

export async function subscribeFalModel(model: string, input: Record<string, unknown>) {
  assertFalModelAllowed(model);
  const falClient = getFalClient();
  return falClient.subscribe(model, {
    input,
    mode: 'polling',
  });
}

async function subscribeWithTimeout(
  role: AudioPipelineRole,
  model: string,
  input: Record<string, unknown>,
  subscribe: AudioProviderSubscribe,
  timeoutOverrideMs?: number
) {
  const timeoutMs = timeoutOverrideMs ?? AUDIO_PROVIDER_TIMEOUT_MS[role];
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Provider timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([subscribe(model, input), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function runAudioRoleWithFallback(
  role: AudioPipelineRole,
  builder: (candidate: AudioProviderCandidate) => Record<string, unknown>,
  options?: {
    candidates?: AudioProviderCandidate[];
    subscribe?: AudioProviderSubscribe;
    timeoutMs?: number;
  }
): Promise<AudioProviderResult> {
  const failures: AudioProviderAttemptFailure[] = [];
  const subscribe = options?.subscribe ?? subscribeFalModel;
  const roster = options?.candidates ?? AUDIO_PROVIDER_ROSTER[role];
  const candidates = ENABLE_AUDIO_PROVIDER_FALLBACK
    ? roster
    : roster.slice(0, 1);

  for (const candidate of candidates) {
    try {
      const result = await subscribeWithTimeout(role, candidate.model, builder(candidate), subscribe, options?.timeoutMs);
      const audioUrl = findFileUrl(result.data, 'audio');
      const customVoiceId = findCustomVoiceId(result.data);
      if (!audioUrl && role !== 'voiceClone') {
        throw new Error('Provider returned no audio URL.');
      }
      if (!audioUrl && !customVoiceId) {
        throw new Error('Voice clone provider returned no audio preview or custom voice id.');
      }
      return {
        url: audioUrl ?? '',
        providerKey: candidate.key,
        providerLabel: candidate.label,
        model: candidate.model,
        requestId: result.requestId ?? null,
        customVoiceId,
      };
    } catch (error) {
      failures.push({
        providerKey: candidate.key,
        model: candidate.model,
        message: error instanceof Error ? error.message : 'Unknown provider failure',
      });
    }
  }

  throw new AudioProviderError(role, failures);
}
