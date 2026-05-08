import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getJobStatus, runGenerate } from '@/lib/api';
import { getLocalizedModeLabel } from '@/lib/ltx-localization';
import type {
  EngineCaps,
  EngineModeUiCaps,
  Mode,
  PreflightResponse,
} from '@/types/engines';
import type { JobsPage } from '@/types/jobs';
import type { SelectedVideoPreview } from '@/lib/video-preview-group';
import type { SWRInfiniteKeyedMutator } from 'swr/infinite';
import type { LocalRender } from '../_lib/render-persistence';
import {
  emitClientMetric,
  isInsufficientFundsError,
} from '../_lib/workspace-client-helpers';
import type { FormState } from '../_lib/workspace-form-state';
import type { GenerationInputPreparationResult } from '../_lib/workspace-generation-inputs';
import {
  applyGenerationPollToRender,
  applyGenerationPollToSelectedPreview,
  projectGenerationPollStatus,
} from '../_lib/workspace-generation-polling';
import {
  applyAcceptedGenerationResultToRender,
  applyAcceptedGenerationResultToSelectedPreview,
  projectAcceptedGenerationResult,
} from '../_lib/workspace-generation-result';
import {
  getGenerationIterationGuardMessage,
  type LumaRay2GenerationContext,
} from '../_lib/workspace-generation-guards';
import { buildWorkspaceGeneratePayload } from '../_lib/workspace-generation-payload';
import { prepareLocalGenerationRender } from '../_lib/workspace-local-generation-render';
import { STORAGE_KEYS } from '../_lib/workspace-storage';

type MemberTier = 'Member' | 'Plus' | 'Pro';
type ShotType = 'customize' | 'intelligent';
type MutateLatestJobs = SWRInfiniteKeyedMutator<JobsPage[]>;
type PreparedGenerationInputs = Extract<GenerationInputPreparationResult, { ok: true }>;

type WorkflowCopy = {
  audioUnsupported: string;
  addReferenceMediaBeforeAudio: string;
  addSourceVideo: (modeLabel: string) => string;
};

type PresentInsufficientFunds = (options: {
  currencyCode: string;
  shortfallCents?: number;
}) => void;

type RunWorkspaceGenerationIterationOptions = {
  activeMode: Mode;
  allowsUnifiedVeoFirstLast: boolean;
  batchId: string;
  capability: EngineModeUiCaps | undefined;
  cfgScale: number | null;
  currencyCode: string;
  effectiveDurationSec: number;
  effectivePrompt: string;
  form: FormState;
  formatTakeLabel: (current: number, total: number) => string;
  generationInputs: PreparedGenerationInputs;
  hasLastFrameInput: boolean;
  isSeedance: boolean;
  isUnifiedSeedance: boolean;
  iterationCount: number;
  iterationIndex: number;
  lumaContext: LumaRay2GenerationContext;
  memberTier: MemberTier;
  mutateLatestJobs: MutateLatestJobs;
  paymentMode: 'wallet' | 'platform';
  preflight: PreflightResponse | null;
  presentInsufficientFunds: PresentInsufficientFunds;
  primaryAssetFieldLabel: string;
  rendersRef: MutableRefObject<LocalRender[]>;
  selectedEngine: EngineCaps;
  setActiveBatchId: Dispatch<SetStateAction<string | null>>;
  setActiveGroupId: Dispatch<SetStateAction<string | null>>;
  setBatchHeroes: Dispatch<SetStateAction<Record<string, string>>>;
  setRenders: Dispatch<SetStateAction<LocalRender[]>>;
  setSelectedPreview: Dispatch<SetStateAction<SelectedVideoPreview | null>>;
  setViewMode: Dispatch<SetStateAction<'single' | 'quad'>>;
  shotType: ShotType;
  showComposerError: (message: string) => void;
  submissionMode: Mode;
  supportsAudioToggle: boolean;
  supportsKlingV3Controls: boolean;
  supportsKlingV3VoiceControl: boolean;
  supportsNegativePrompt: boolean;
  token: string | null;
  trimmedNegativePrompt: string;
  trimmedPrompt: string;
  uiLocale: string;
  voiceControlEnabled: boolean;
  voiceIds: string[];
  workflowCopy: WorkflowCopy;
  writeScopedStorage: (base: string, value: string | null) => void;
};

export async function runWorkspaceGenerationIteration({
  activeMode,
  allowsUnifiedVeoFirstLast,
  batchId,
  capability,
  cfgScale,
  currencyCode,
  effectiveDurationSec,
  effectivePrompt,
  form,
  formatTakeLabel,
  generationInputs,
  hasLastFrameInput,
  isSeedance,
  isUnifiedSeedance,
  iterationCount,
  iterationIndex,
  lumaContext,
  memberTier,
  mutateLatestJobs,
  paymentMode,
  preflight,
  presentInsufficientFunds,
  primaryAssetFieldLabel,
  rendersRef,
  selectedEngine,
  setActiveBatchId,
  setActiveGroupId,
  setBatchHeroes,
  setRenders,
  setSelectedPreview,
  setViewMode,
  shotType,
  showComposerError,
  submissionMode,
  supportsAudioToggle,
  supportsKlingV3Controls,
  supportsKlingV3VoiceControl,
  supportsNegativePrompt,
  token,
  trimmedNegativePrompt,
  trimmedPrompt,
  uiLocale,
  voiceControlEnabled,
  voiceIds,
  workflowCopy,
  writeScopedStorage,
}: RunWorkspaceGenerationIterationOptions) {
  const {
    inputsPayload,
    primaryAttachment,
    referenceImageUrls,
    referenceVideoUrls,
    referenceAudioUrls,
    primaryImageUrl,
    primaryAudioUrl,
    endImageUrl,
    extraInputValues,
    klingElementsPayload,
    multiPromptPayload,
  } = generationInputs;

  const guardMessage = getGenerationIterationGuardMessage({
    selectedEngineId: selectedEngine.id,
    submissionMode,
    allowsUnifiedVeoFirstLast,
    hasLastFrameInput,
    isUnifiedSeedance,
    primaryImageUrl,
    primaryAudioUrl,
    primaryAssetFieldLabel,
    referenceImageUrls,
    referenceVideoUrls,
    referenceAudioUrls,
    inputsPayload,
    primaryAttachment,
    addReferenceMediaBeforeAudioMessage: workflowCopy.addReferenceMediaBeforeAudio,
    extendOrRetakeSourceVideoMessage: workflowCopy.addSourceVideo(getLocalizedModeLabel(submissionMode, uiLocale)),
  });
  if (guardMessage) {
    showComposerError(guardMessage);
    return;
  }

  const localRender = prepareLocalGenerationRender({
    batchId,
    iterationIndex,
    iterationCount,
    selectedEngine,
    form,
    effectiveDurationSec,
    effectivePrompt,
    preflight,
    formatTakeLabel,
  });
  const {
    localKey,
    id,
    thumb,
    etaSeconds,
    etaLabel,
    friendlyMessage,
    startedAt,
    minDurationMs,
    minReadyAt,
    initialRender,
    selectedPreview: initialSelectedPreview,
  } = localRender;

  let progressMessage = friendlyMessage;
  const totalMs = minDurationMs;
  let progressInterval: number | null = null;
  let progressTimeout: number | null = null;

  const stopProgressTracking = () => {
    if (typeof window === 'undefined') return;
    if (progressInterval !== null) {
      window.clearInterval(progressInterval);
      progressInterval = null;
    }
    if (progressTimeout !== null) {
      window.clearTimeout(progressTimeout);
      progressTimeout = null;
    }
  };

  const startProgressTracking = () => {
    if (typeof window === 'undefined') return;
    if (progressInterval !== null) return;
    progressInterval = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - startedAt;
      const pct = Math.min(95, Math.round((elapsed / totalMs) * 100));
      setRenders((prev) =>
        prev.map((render) =>
          render.localKey === localKey && !render.videoUrl
            ? {
                ...render,
                progress: pct < 5 ? 5 : pct,
                message: progressMessage,
              }
            : render
        )
      );
      setSelectedPreview((current) =>
        current && current.localKey === localKey && !current.videoUrl
          ? { ...current, progress: pct < 5 ? 5 : pct, message: progressMessage }
          : current
      );
    }, 400);
    const timeoutMs = Math.max(totalMs * 1.5, totalMs + 15000);
    progressTimeout = window.setTimeout(() => {
      stopProgressTracking();
    }, timeoutMs);
  };

  setRenders((prev) => [initialRender, ...prev]);
  setBatchHeroes((prev) => {
    if (prev[batchId]) return prev;
    return { ...prev, [batchId]: localKey };
  });
  setActiveBatchId(batchId);
  setActiveGroupId(batchId);
  if (iterationCount > 1) {
    setViewMode((prev) => (prev === 'quad' ? prev : 'quad'));
  }
  setSelectedPreview(initialSelectedPreview);

  startProgressTracking();

  try {
    const { payload: generatePayload, resolvedDurationSeconds } = buildWorkspaceGeneratePayload({
      selectedEngineId: selectedEngine.id,
      activeMode,
      submissionMode,
      form,
      trimmedPrompt,
      trimmedNegativePrompt,
      effectiveDurationSec,
      memberTier,
      paymentMode,
      cfgScale,
      capability,
      supportsNegativePrompt,
      supportsAudioToggle,
      isSeedance,
      supportsKlingV3Controls,
      supportsKlingV3VoiceControl,
      voiceIds,
      voiceControlEnabled,
      shotType,
      localKey,
      batchId,
      iterationIndex,
      iterationCount,
      friendlyMessage,
      etaSeconds,
      etaLabel,
      lumaContext,
      inputsPayload,
      primaryImageUrl,
      primaryAudioUrl,
      referenceImageUrls,
      endImageUrl,
      extraInputValues,
      multiPromptPayload,
      klingElementsPayload,
    });

    emitClientMetric('generation_started', {
      local_key: localKey,
      batch_id: batchId,
      group_id: batchId,
      iteration_index: iterationIndex,
      iteration_count: iterationCount,
      batch_size: iterationCount,
      engine: selectedEngine.id,
      mode: submissionMode,
      duration_sec: resolvedDurationSeconds,
      payment_mode: paymentMode,
      has_audio: Boolean(form.audio),
    });

    const res = await runGenerate(generatePayload, token ? { token } : undefined);

    const acceptedResult = projectAcceptedGenerationResult({
      response: res,
      fallback: {
        id,
        batchId,
        iterationIndex,
        iterationCount,
        thumbUrl: thumb,
        priceCents: preflight?.pricing?.totalCents ?? undefined,
        currency: preflight?.pricing?.currency ?? preflight?.currency ?? 'USD',
        pricingSnapshot: preflight?.pricing,
        etaSeconds,
        etaLabel,
        message: friendlyMessage,
        minReadyAt,
        aspectRatio: form.aspectRatio,
        localKey,
      },
      now: Date.now(),
    });

    try {
      if (acceptedResult.jobId.startsWith('job_')) {
        writeScopedStorage(STORAGE_KEYS.previewJobId, acceptedResult.jobId);
      }
    } catch {
      // ignore storage failures
    }

    setRenders((prev) =>
      prev.map((render) =>
        render.localKey === localKey ? applyAcceptedGenerationResultToRender(render, acceptedResult) : render
      )
    );
    progressMessage = acceptedResult.message;
    setSelectedPreview((current) => applyAcceptedGenerationResultToSelectedPreview(current, acceptedResult));

    if (acceptedResult.iterationCount > 1) {
      setViewMode((prev) => (prev === 'quad' ? prev : 'quad'));
    }
    setActiveBatchId(acceptedResult.batchId);
    setActiveGroupId(acceptedResult.batchId ?? batchId ?? id);
    setBatchHeroes((prev) => {
      if (prev[acceptedResult.batchId]) return prev;
      return { ...prev, [acceptedResult.batchId]: localKey };
    });

    if (acceptedResult.videoUrl || acceptedResult.status === 'completed') {
      stopProgressTracking();
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jobs:status', { detail: acceptedResult.statusEventDetail }));
    }

    void mutateLatestJobs(undefined, { revalidate: true });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('wallet:invalidate'));
    }

    const jobId = acceptedResult.jobId;
    const poll = async () => {
      try {
        const status = await getJobStatus(jobId);
        if (status.message) {
          progressMessage = status.message;
        }
        const target = rendersRef.current.find((render) => render.id === jobId);
        const pollProjection = projectGenerationPollStatus({
          status,
          target,
          jobId,
          localKey,
          now: Date.now(),
        });
        if (pollProjection.deferUntilReady && pollProjection.nextPollDelayMs !== null) {
          window.setTimeout(poll, pollProjection.nextPollDelayMs);
          return;
        }
        setRenders((prev) =>
          prev.map((render) => (render.id === jobId ? applyGenerationPollToRender(render, pollProjection) : render))
        );
        setSelectedPreview((current) => applyGenerationPollToSelectedPreview(current, pollProjection));
        if (pollProjection.shouldKeepPolling && pollProjection.nextPollDelayMs !== null) {
          window.setTimeout(poll, pollProjection.nextPollDelayMs);
        }
        if (pollProjection.shouldStopProgressTracking) {
          stopProgressTracking();
        }
      } catch {
        window.setTimeout(poll, 3000);
      }
    };
    window.setTimeout(poll, 1500);

    if (acceptedResult.videoUrl) {
      stopProgressTracking();
    }
  } catch (error) {
    stopProgressTracking();
    emitClientMetric('generation_failed', {
      local_key: localKey,
      batch_id: batchId,
      group_id: batchId,
      iteration_index: iterationIndex,
      iteration_count: iterationCount,
      engine: selectedEngine.id,
      mode: submissionMode,
      error_code:
        error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: string }).code
          : 'generation_request_failed',
      error_message: error instanceof Error ? error.message : 'Generation failed',
    });
    let fallbackBatchId: string | null = null;
    setRenders((prev) => {
      const next = prev.filter((render) => render.localKey !== localKey);
      fallbackBatchId = next[0]?.batchId ?? null;
      return next;
    });
    setBatchHeroes((prev) => {
      if (!prev[batchId]) return prev;
      const next = { ...prev };
      delete next[batchId];
      return next;
    });
    setActiveBatchId((current) => (current === batchId ? fallbackBatchId : current));
    setActiveGroupId((current) => (current === batchId ? fallbackBatchId : current));
    setSelectedPreview((current) => (current && current.localKey === localKey ? null : current));
    if (isInsufficientFundsError(error)) {
      const shortfallCents = error.details?.requiredCents;
      presentInsufficientFunds({ currencyCode, shortfallCents });
      return;
    }
    if (error && typeof error === 'object' && (error as { error?: string }).error === 'FAL_UNPROCESSABLE_ENTITY') {
      const payload = error as { userMessage?: string; providerMessage?: string; detail?: unknown };
      const userMessage =
        typeof payload.userMessage === 'string'
          ? payload.userMessage
          : `The provider rejected this ${primaryAssetFieldLabel.toLowerCase()}. Please try with a different one.`;
      const providerMessage =
        typeof payload.providerMessage === 'string'
          ? payload.providerMessage
          : typeof payload.detail === 'string'
            ? payload.detail
            : undefined;
      const composed =
        providerMessage && providerMessage !== userMessage
          ? `${userMessage}\n(${providerMessage})`
          : userMessage;
      showComposerError(composed);
      return;
    }
    const enrichedError = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
    const apiMessage =
      typeof enrichedError?.originalMessage === 'string' && enrichedError.originalMessage.trim().length
        ? enrichedError.originalMessage.trim()
        : undefined;
    const fallbackMessage =
      apiMessage ??
      (error instanceof Error && typeof error.message === 'string' && error.message.trim().length
        ? error.message
        : 'Generate failed');
    showComposerError(fallbackMessage);
  }
}
