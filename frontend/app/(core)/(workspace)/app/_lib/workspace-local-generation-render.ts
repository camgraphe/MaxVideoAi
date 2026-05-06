import { getRenderEta } from '@/lib/render-eta';
import type { SelectedVideoPreview } from '@/lib/video-preview-group';
import type { EngineCaps, PreflightResponse } from '@/types/engines';
import { resolveRenderThumb, type LocalRender } from './render-persistence';
import type { FormState } from './workspace-form-state';

export type LocalGenerationRenderPreparation = {
  localKey: string;
  id: string;
  thumb: string;
  etaSeconds: number;
  etaLabel: string;
  friendlyMessage: string;
  startedAt: number;
  minDurationMs: number;
  minReadyAt: number;
  initialRender: LocalRender;
  selectedPreview: SelectedVideoPreview;
};

export type PrepareLocalGenerationRenderOptions = {
  batchId: string;
  iterationIndex: number;
  iterationCount: number;
  selectedEngine: EngineCaps;
  form: Pick<FormState, 'aspectRatio'>;
  effectiveDurationSec: number;
  effectivePrompt: string;
  preflight?: PreflightResponse | null;
  formatTakeLabel: (index: number, total: number) => string;
  now?: number;
};

export function prepareLocalGenerationRender({
  batchId,
  iterationIndex,
  iterationCount,
  selectedEngine,
  form,
  effectiveDurationSec,
  effectivePrompt,
  preflight,
  formatTakeLabel,
  now,
}: PrepareLocalGenerationRenderOptions): LocalGenerationRenderPreparation {
  const localKey = `local_${batchId}_${iterationIndex + 1}`;
  const id = localKey;
  const thumb = resolveRenderThumb({ aspectRatio: form.aspectRatio });
  const { seconds: etaSeconds, label: etaLabel } = getRenderEta(selectedEngine, effectiveDurationSec);
  const friendlyMessage = iterationCount > 1 ? formatTakeLabel(iterationIndex + 1, iterationCount) : '';
  const startedAt = now ?? Date.now();
  const minEtaSeconds = Math.min(Math.max(etaSeconds ?? 4, 0), 8);
  const minDurationMs = Math.max(1200, minEtaSeconds * 1000);
  const minReadyAt = startedAt + minDurationMs;
  const currency = preflight?.pricing?.currency ?? preflight?.currency ?? 'USD';

  const initialRender: LocalRender = {
    localKey,
    batchId,
    iterationIndex,
    iterationCount,
    id,
    engineId: selectedEngine.id,
    engineLabel: selectedEngine.label,
    createdAt: new Date(startedAt).toISOString(),
    aspectRatio: form.aspectRatio,
    durationSec: effectiveDurationSec,
    prompt: effectivePrompt,
    progress: 5,
    message: friendlyMessage,
    status: 'pending',
    thumbUrl: thumb,
    readyVideoUrl: undefined,
    priceCents: preflight?.pricing?.totalCents ?? undefined,
    currency,
    pricingSnapshot: preflight?.pricing,
    paymentStatus: 'pending_payment',
    etaSeconds,
    etaLabel,
    startedAt,
    minReadyAt,
    groupId: batchId,
    renderIds: undefined,
    heroRenderId: null,
  };

  return {
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
    selectedPreview: {
      id,
      localKey,
      batchId,
      iterationIndex,
      iterationCount,
      aspectRatio: form.aspectRatio,
      thumbUrl: thumb,
      progress: initialRender.progress,
      message: friendlyMessage,
      priceCents: initialRender.priceCents,
      currency: initialRender.currency,
      etaSeconds,
      etaLabel,
      prompt: effectivePrompt,
      status: initialRender.status,
    },
  };
}
