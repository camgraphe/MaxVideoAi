import type { GenerateResult } from '@/lib/fal';
import type { PricingSnapshot } from '@/types/engines';
import type { VideoAsset } from '@/types/render';
import type { PaymentMode, PendingReceipt } from './initial-video-job';

export type FinalGenerateResponse = {
  ok: true;
  jobId: string;
  videoUrl: string | null;
  video: VideoAsset | null;
  thumbUrl: string;
  status: string;
  progress: number;
  pricing: PricingSnapshot;
  paymentStatus: string;
  provider: GenerateResult['provider'];
  providerJobId: string | null;
  batchId: string | null;
  groupId: string | null;
  iterationIndex: number | null;
  iterationCount: number | null;
  renderIds: Array<string | null> | null;
  heroRenderId: string | null;
  localKey: string | null;
  message: string | null;
  etaSeconds: number | null;
  etaLabel: string | null;
};

export function resolveGenerateResponsePaymentStatus(params: {
  status: string;
  pendingReceipt: PendingReceipt | null;
  paymentMode: PaymentMode;
  paymentStatus: string;
}): string {
  return params.status === 'failed' && params.pendingReceipt && params.paymentMode === 'wallet'
    ? 'refunded_wallet'
    : params.paymentStatus;
}

export function buildFinalGenerateResponse(params: {
  jobId: string;
  media: {
    video: string | null;
    videoAsset: VideoAsset | null;
    thumb: string;
  };
  completion: {
    status: string;
    progress: number;
    message: string | null;
    etaSeconds: number | null;
    etaLabel: string | null;
  };
  pricing: PricingSnapshot;
  payment: {
    pendingReceipt: PendingReceipt | null;
    paymentMode: PaymentMode;
    paymentStatus: string;
  };
  provider: {
    providerMode: GenerateResult['provider'];
    providerJobId: string | null;
  };
  batch: {
    batchId: string | null;
    groupId: string | null;
    iterationIndex: number | null;
    iterationCount: number | null;
    renderIds: Array<string | null> | null;
    heroRenderId: string | null;
    localKey: string | null;
  };
}): FinalGenerateResponse {
  const paymentStatus = resolveGenerateResponsePaymentStatus({
    status: params.completion.status,
    pendingReceipt: params.payment.pendingReceipt,
    paymentMode: params.payment.paymentMode,
    paymentStatus: params.payment.paymentStatus,
  });

  return {
    ok: true,
    jobId: params.jobId,
    videoUrl: params.media.video,
    video: params.media.videoAsset,
    thumbUrl: params.media.thumb,
    status: params.completion.status,
    progress: params.completion.progress,
    pricing: params.pricing,
    paymentStatus,
    provider: params.provider.providerMode,
    providerJobId: params.provider.providerJobId,
    batchId: params.batch.batchId,
    groupId: params.batch.groupId,
    iterationIndex: params.batch.iterationIndex,
    iterationCount: params.batch.iterationCount,
    renderIds: params.batch.renderIds,
    heroRenderId: params.batch.heroRenderId,
    localKey: params.batch.localKey,
    message: params.completion.message,
    etaSeconds: params.completion.etaSeconds,
    etaLabel: params.completion.etaLabel,
  };
}
