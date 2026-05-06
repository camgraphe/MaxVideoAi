import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import { getJobStatus, runGenerate } from '@/lib/api';
import { authFetch } from '@/lib/authFetch';
import { CURRENCY_LOCALE } from '@/lib/intl';
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
import {
  type LocalRender,
} from '../_lib/render-persistence';
import {
  emitClientMetric,
  isInsufficientFundsError,
} from '../_lib/workspace-client-helpers';
import type { FormState } from '../_lib/workspace-form-state';
import {
  prepareGenerationInputs,
} from '../_lib/workspace-generation-inputs';
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
  getLumaRay2GenerationContext,
  getStartRenderValidationMessage,
  supportsNegativePromptInput,
} from '../_lib/workspace-generation-guards';
import { buildWorkspaceGeneratePayload } from '../_lib/workspace-generation-payload';
import { prepareLocalGenerationRender } from '../_lib/workspace-local-generation-render';
import type {
  WorkspaceInputFieldEntry,
  WorkspaceInputSchemaSummary,
} from '../_lib/workspace-input-schema';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import { STORAGE_KEYS } from '../_lib/workspace-storage';

type MemberTier = 'Member' | 'Plus' | 'Pro';
type ShotType = 'customize' | 'intelligent';

type TopUpModalState = {
  message: string;
  amountLabel?: string;
  shortfallCents?: number;
} | null;

type WorkspaceWalletCopy = {
  wallet: {
    insufficient: string;
    insufficientWithAmount: string;
  };
};

type WorkflowCopy = {
  audioUnsupported: string;
  addReferenceMediaBeforeAudio: string;
  addSourceVideo: (modeLabel: string) => string;
};

type MutateLatestJobs = SWRInfiniteKeyedMutator<JobsPage[]>;

type UseWorkspaceGenerationRunnerOptions = {
  audioWorkflowUnsupported: boolean;
  form: FormState | null;
  activeMode: Mode;
  submissionMode: Mode;
  effectivePrompt: string;
  effectiveDurationSec: number;
  negativePrompt: string;
  selectedEngine: EngineCaps | null;
  preflight: PreflightResponse | null;
  memberTier: MemberTier;
  showComposerError: (message: string) => void;
  writeScopedStorage: (base: string, value: string | null) => void;
  mutateLatestJobs: MutateLatestJobs;
  inputSchemaSummary: WorkspaceInputSchemaSummary;
  extraInputFields: WorkspaceInputFieldEntry[];
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  setAuthModalOpen: Dispatch<SetStateAction<boolean>>;
  setPreflightError: Dispatch<SetStateAction<string | undefined>>;
  setTopUpModal: Dispatch<SetStateAction<TopUpModalState>>;
  setActiveGroupId: Dispatch<SetStateAction<string | null>>;
  setActiveBatchId: Dispatch<SetStateAction<string | null>>;
  setBatchHeroes: Dispatch<SetStateAction<Record<string, string>>>;
  setRenders: Dispatch<SetStateAction<LocalRender[]>>;
  setSelectedPreview: Dispatch<SetStateAction<SelectedVideoPreview | null>>;
  setViewMode: Dispatch<SetStateAction<'single' | 'quad'>>;
  rendersRef: MutableRefObject<LocalRender[]>;
  uiLocale: string;
  workflowCopy: WorkflowCopy;
  workspaceCopy: WorkspaceWalletCopy;
  capability: EngineModeUiCaps | undefined;
  cfgScale: number | null;
  formatTakeLabel: (current: number, total: number) => string;
  primaryAssetFieldLabel: string;
  primaryAssetFieldIds: Set<string>;
  referenceAssetFieldIds: Set<string>;
  referenceAudioFieldIds: Set<string>;
  genericImageFieldIds: Set<string>;
  frameAssetFieldIds: Set<string>;
  allowsUnifiedVeoFirstLast: boolean;
  hasLastFrameInput: boolean;
  supportsAudioToggle: boolean;
  multiPromptActive: boolean;
  multiPromptInvalid: boolean;
  multiPromptError: string | null;
  multiPromptScenes: MultiPromptScene[];
  supportsKlingV3Controls: boolean;
  supportsKlingV3VoiceControl: boolean;
  isSeedance: boolean;
  isUnifiedSeedance: boolean;
  promptLength: number;
  promptCharLimitExceeded: boolean;
  promptMaxChars: number | null;
  voiceIds: string[];
  voiceControlEnabled: boolean;
  shotType: ShotType;
  klingElements: KlingElementState[];
};

export function useWorkspaceGenerationRunner({
  audioWorkflowUnsupported,
  form,
  activeMode,
  submissionMode,
  effectivePrompt,
  effectiveDurationSec,
  negativePrompt,
  selectedEngine,
  preflight,
  memberTier,
  showComposerError,
  writeScopedStorage,
  mutateLatestJobs,
  inputSchemaSummary,
  extraInputFields,
  inputAssets,
  setAuthModalOpen,
  setPreflightError,
  setTopUpModal,
  setActiveGroupId,
  setActiveBatchId,
  setBatchHeroes,
  setRenders,
  setSelectedPreview,
  setViewMode,
  rendersRef,
  uiLocale,
  workflowCopy,
  workspaceCopy,
  capability,
  cfgScale,
  formatTakeLabel,
  primaryAssetFieldLabel,
  primaryAssetFieldIds,
  referenceAssetFieldIds,
  referenceAudioFieldIds,
  genericImageFieldIds,
  frameAssetFieldIds,
  allowsUnifiedVeoFirstLast,
  hasLastFrameInput,
  supportsAudioToggle,
  multiPromptActive,
  multiPromptInvalid,
  multiPromptError,
  multiPromptScenes,
  supportsKlingV3Controls,
  supportsKlingV3VoiceControl,
  isSeedance,
  isUnifiedSeedance,
  promptLength,
  promptCharLimitExceeded,
  promptMaxChars,
  voiceIds,
  voiceControlEnabled,
  shotType,
  klingElements,
}: UseWorkspaceGenerationRunnerOptions) {
  const startRender = useCallback(async () => {
    if (!form || !selectedEngine) return;
    const { supabase } = await import('@/lib/supabaseClient');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) {
      setAuthModalOpen(true);
      return;
    }
    setPreflightError(undefined);
    const trimmedPrompt = effectivePrompt.trim();
    const trimmedNegativePrompt = negativePrompt.trim();
    const supportsNegativePrompt = supportsNegativePromptInput(inputSchemaSummary);
    const lumaContext = getLumaRay2GenerationContext({
      selectedEngineId: selectedEngine.id,
      submissionMode,
      form,
    });
    const validationMessage = getStartRenderValidationMessage({
      audioWorkflowUnsupported,
      audioUnsupportedMessage: workflowCopy.audioUnsupported,
      multiPromptActive,
      multiPromptInvalid,
      multiPromptError,
      promptLength,
      promptCharLimitExceeded,
      promptMaxChars,
      selectedEngineLabel: selectedEngine.label,
      trimmedPrompt,
      trimmedNegativePrompt,
      inputSchemaSummary,
      inputAssets,
      extraInputFields,
      form,
      lumaContext,
    });
    if (validationMessage) {
      showComposerError(validationMessage);
      return;
    }

    const iterationCount = Math.max(1, form.iterations ?? 1);
    const batchId = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    if (iterationCount > 1) {
      const totalCents =
        typeof preflight?.pricing?.totalCents === 'number' ? preflight.pricing.totalCents * iterationCount : undefined;
      emitClientMetric('group_render_initiated', {
        batchId,
        iterations: iterationCount,
        engine: selectedEngine.id,
        total_cents: totalCents ?? null,
        currency: preflight?.pricing?.currency ?? preflight?.currency ?? 'USD',
      });
    }

    const paymentMode: 'wallet' | 'platform' = token ? 'wallet' : 'platform';
    const currencyCode = preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';

    const presentInsufficientFunds = (shortfallCents?: number) => {
      const normalizedShortfall = typeof shortfallCents === 'number' ? Math.max(0, shortfallCents) : undefined;

      let friendlyNotice: string = workspaceCopy.wallet.insufficient;
      let formattedShortfall: string | undefined;
      if (typeof normalizedShortfall === 'number' && normalizedShortfall > 0) {
        try {
          formattedShortfall = new Intl.NumberFormat(CURRENCY_LOCALE, {
            style: 'currency',
            currency: currencyCode,
          }).format(normalizedShortfall / 100);
          friendlyNotice = workspaceCopy.wallet.insufficientWithAmount.replace('{amount}', formattedShortfall);
        } catch {
          formattedShortfall = `${currencyCode} ${(normalizedShortfall / 100).toFixed(2)}`;
          friendlyNotice = workspaceCopy.wallet.insufficientWithAmount.replace('{amount}', formattedShortfall);
        }
      }

      setTopUpModal({
        message: friendlyNotice,
        amountLabel: formattedShortfall,
        shortfallCents: typeof normalizedShortfall === 'number' ? normalizedShortfall : undefined,
      });
      showComposerError(friendlyNotice);
    };

    if (paymentMode === 'wallet') {
      const unitCostCents =
        typeof preflight?.pricing?.totalCents === 'number'
          ? preflight.pricing.totalCents
          : typeof preflight?.total === 'number'
            ? preflight.total
            : null;
      if (typeof unitCostCents === 'number' && unitCostCents > 0) {
        const requiredCents = unitCostCents * iterationCount;
        try {
          const res = await authFetch('/api/wallet');
          if (res.ok) {
            const walletJson = await res.json();
            const balanceCents =
              typeof walletJson.balanceCents === 'number'
                ? walletJson.balanceCents
                : typeof walletJson.balance === 'number'
                  ? Math.round(walletJson.balance * 100)
                  : typeof walletJson.balance === 'string'
                    ? Math.round(Number(walletJson.balance) * 100)
                    : undefined;
            if (typeof balanceCents === 'number') {
              const shortfall = requiredCents - balanceCents;
              if (shortfall > 0) {
                presentInsufficientFunds(shortfall);
                return;
              }
            }
          }
        } catch (walletError) {
          console.warn('[startRender] wallet balance check failed', walletError);
        }
      }
    }

    const generationInputs = prepareGenerationInputs({
      selectedEngineId: selectedEngine.id,
      activeMode,
      submissionMode,
      form,
      inputSchema: selectedEngine.inputSchema,
      inputSchemaSummary,
      extraInputFields,
      inputAssets,
      primaryAssetFieldIds,
      referenceAssetFieldIds,
      genericImageFieldIds,
      frameAssetFieldIds,
      referenceAudioFieldIds,
      supportsKlingV3Controls,
      klingElements,
      multiPromptActive,
      multiPromptScenes,
    });
    if (!generationInputs.ok) {
      showComposerError(generationInputs.message);
      return;
    }

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

    const runIteration = async (iterationIndex: number) => {
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
            prev.map((r) =>
              r.localKey === localKey && !r.videoUrl
                ? {
                    ...r,
                    progress: pct < 5 ? 5 : pct,
                    message: progressMessage,
                  }
                : r
            )
          );
          setSelectedPreview((cur) =>
            cur && cur.localKey === localKey && !cur.videoUrl
              ? { ...cur, progress: pct < 5 ? 5 : pct, message: progressMessage }
              : cur
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
        setSelectedPreview((cur) => applyAcceptedGenerationResultToSelectedPreview(cur, acceptedResult));

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
            const target = rendersRef.current.find((r) => r.id === jobId);
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
              prev.map((r) => (r.id === jobId ? applyGenerationPollToRender(r, pollProjection) : r))
            );
            setSelectedPreview((cur) => applyGenerationPollToSelectedPreview(cur, pollProjection));
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
          const next = prev.filter((r) => r.localKey !== localKey);
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
        setSelectedPreview((cur) => (cur && cur.localKey === localKey ? null : cur));
        if (isInsufficientFundsError(error)) {
          const shortfallCents = error.details?.requiredCents;
          presentInsufficientFunds(shortfallCents);
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
    };

    for (let iterationIndex = 0; iterationIndex < iterationCount; iterationIndex += 1) {
      void runIteration(iterationIndex);
    }
  }, [
    audioWorkflowUnsupported,
    form,
    activeMode,
    submissionMode,
    effectivePrompt,
    effectiveDurationSec,
    negativePrompt,
    selectedEngine,
    preflight,
    memberTier,
    showComposerError,
    writeScopedStorage,
    mutateLatestJobs,
    inputSchemaSummary,
    extraInputFields,
    inputAssets,
    setAuthModalOpen,
    setPreflightError,
    setTopUpModal,
    setActiveGroupId,
    setActiveBatchId,
    setBatchHeroes,
    setRenders,
    setSelectedPreview,
    setViewMode,
    rendersRef,
    uiLocale,
    workflowCopy,
    workspaceCopy,
    capability,
    cfgScale,
    formatTakeLabel,
    primaryAssetFieldLabel,
    primaryAssetFieldIds,
    referenceAssetFieldIds,
    referenceAudioFieldIds,
    genericImageFieldIds,
    frameAssetFieldIds,
    allowsUnifiedVeoFirstLast,
    hasLastFrameInput,
    supportsAudioToggle,
    multiPromptActive,
    multiPromptInvalid,
    multiPromptError,
    multiPromptScenes,
    supportsKlingV3Controls,
    supportsKlingV3VoiceControl,
    isSeedance,
    isUnifiedSeedance,
    promptLength,
    promptCharLimitExceeded,
    promptMaxChars,
    voiceIds,
    voiceControlEnabled,
    shotType,
    klingElements,
  ]);

  return {
    startRender,
  };
}
