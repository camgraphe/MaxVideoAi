import type { GeneratePayload, GenerateResult } from '@/lib/fal';
import type { Mode, PricingSnapshot } from '@/types/engines';
import type { VideoProviderRoutingPlan } from '@/server/video-providers/router';
import { submitFalGenerateTask } from './fal-submission';
import { submitGoogleVertexOmniGenerateTask } from './google-vertex-omni-submission';
import { submitGoogleVertexVeoGenerateTask } from './google-vertex-veo-submission';
import { submitKlingDirectGenerateTask } from './kling-direct-submission';
import { submitLumaAgentsGenerateTask } from './luma-agents-submission';
import type { FalInputSummary } from './fal-request';
import type { PaymentMode, PendingReceipt } from './initial-video-job';
import { createProviderJobTracker } from './provider-job-tracker';

type LogMetricFn = Parameters<typeof submitFalGenerateTask>[0]['logMetricFn'];

export type GenerateProviderSubmissionResult =
  | {
      kind: 'accepted_response';
      body: Record<string, unknown>;
    }
  | {
      kind: 'generation_result';
      generationResult: GenerateResult;
    }
  | {
      kind: 'error_response';
      status: number;
      body: Record<string, unknown>;
    };

export async function submitGenerateProviderTask(params: {
  providerRoutingPlan: VideoProviderRoutingPlan;
  providerKey: string;
  falPayload: GeneratePayload;
  jobId: string;
  userId: string;
  engineId: string;
  engineLabel: string;
  mode: Mode;
  prompt: string;
  negativePrompt?: unknown;
  durationSec: number;
  aspectRatio: string | null;
  audioEnabled: boolean | undefined;
  effectiveResolution: string | null;
  imageUrl: string | null | undefined;
  cfgScale: unknown;
  placeholderThumb: string;
  pricing: PricingSnapshot;
  paymentStatus: string;
  pendingReceipt: PendingReceipt | null;
  paymentMode: PaymentMode;
  walletChargeReserved: boolean;
  falInputSummary: FalInputSummary;
  isLumaRay2: boolean;
  batchId: string | null;
  groupId: string | null;
  iterationIndex: number | null;
  iterationCount: number | null;
  renderIds: Array<string | null> | null;
  heroRenderId: string | null;
  localKey: string | null;
  logMetricFn: LogMetricFn;
}): Promise<GenerateProviderSubmissionResult> {
  if (params.providerRoutingPlan.kind === 'luma_agents_direct_primary') {
    const lumaSubmission = await submitLumaAgentsGenerateTask({
      jobId: params.jobId,
      userId: params.userId,
      engineId: params.engineId,
      engineLabel: params.engineLabel,
      mode: params.mode,
      prompt: params.prompt,
      negativePrompt: typeof params.negativePrompt === 'string' ? params.negativePrompt : null,
      durationSec: params.durationSec,
      aspectRatio: params.aspectRatio,
      audioEnabled: params.audioEnabled,
      effectiveResolution: params.effectiveResolution,
      imageUrl: params.imageUrl,
      placeholderThumb: params.placeholderThumb,
      pricing: params.pricing,
      paymentStatus: params.paymentStatus,
      pendingReceipt: params.pendingReceipt,
      paymentMode: params.paymentMode,
      walletChargeReserved: params.walletChargeReserved,
      fallbackToFalEnabled: params.providerRoutingPlan.fallbackEnabled,
      advancedDirectOnlyEnabled: params.providerRoutingPlan.advancedDirectOnlyEnabled,
      falPayload: params.falPayload,
      falInputSummary: params.falInputSummary,
      isLumaRay2: params.isLumaRay2,
      batchId: params.batchId,
      groupId: params.groupId,
      iterationIndex: params.iterationIndex,
      iterationCount: params.iterationCount,
      renderIds: params.renderIds,
      heroRenderId: params.heroRenderId,
      localKey: params.localKey,
      logMetricFn: params.logMetricFn,
    });
    if (!lumaSubmission.ok) {
      return { kind: 'error_response', status: lumaSubmission.status, body: lumaSubmission.body };
    }
    if (lumaSubmission.kind === 'accepted') {
      return { kind: 'accepted_response', body: lumaSubmission.body };
    }
    return { kind: 'generation_result', generationResult: lumaSubmission.generationResult };
  }

  if (params.providerRoutingPlan.kind === 'kling_direct_primary') {
    const klingSubmission = await submitKlingDirectGenerateTask({
      jobId: params.jobId,
      userId: params.userId,
      engineId: params.engineId,
      engineLabel: params.engineLabel,
      mode: params.mode,
      prompt: params.prompt,
      negativePrompt: typeof params.negativePrompt === 'string' ? params.negativePrompt : null,
      durationSec: params.durationSec,
      aspectRatio: params.aspectRatio,
      audioEnabled: params.audioEnabled,
      imageUrl: params.imageUrl,
      cfgScale: params.cfgScale,
      placeholderThumb: params.placeholderThumb,
      pricing: params.pricing,
      paymentStatus: params.paymentStatus,
      pendingReceipt: params.pendingReceipt,
      paymentMode: params.paymentMode,
      walletChargeReserved: params.walletChargeReserved,
      fallbackToFalEnabled: params.providerRoutingPlan.fallbackEnabled,
      fallbackOnCreditsDepletedEnabled: params.providerRoutingPlan.fallbackOnCreditsDepletedEnabled,
      elementRegistrationEnabled: params.providerRoutingPlan.elementRegistrationEnabled,
      falPayload: params.falPayload,
      falInputSummary: params.falInputSummary,
      isLumaRay2: params.isLumaRay2,
      batchId: params.batchId,
      groupId: params.groupId,
      iterationIndex: params.iterationIndex,
      iterationCount: params.iterationCount,
      renderIds: params.renderIds,
      heroRenderId: params.heroRenderId,
      localKey: params.localKey,
      logMetricFn: params.logMetricFn,
    });
    if (!klingSubmission.ok) {
      return { kind: 'error_response', status: klingSubmission.status, body: klingSubmission.body };
    }
    if (klingSubmission.kind === 'accepted') {
      return { kind: 'accepted_response', body: klingSubmission.body };
    }
    return { kind: 'generation_result', generationResult: klingSubmission.generationResult };
  }

  if (params.providerRoutingPlan.kind === 'google_vertex_veo_primary') {
    const googleSubmission = await submitGoogleVertexVeoGenerateTask({
      jobId: params.jobId,
      userId: params.userId,
      engineId: params.engineId,
      engineLabel: params.engineLabel,
      mode: params.mode,
      prompt: params.prompt,
      negativePrompt: typeof params.negativePrompt === 'string' ? params.negativePrompt : null,
      durationSec: params.durationSec,
      aspectRatio: params.aspectRatio,
      audioEnabled: params.audioEnabled,
      effectiveResolution: params.effectiveResolution,
      placeholderThumb: params.placeholderThumb,
      pricing: params.pricing,
      paymentStatus: params.paymentStatus,
      pendingReceipt: params.pendingReceipt,
      paymentMode: params.paymentMode,
      walletChargeReserved: params.walletChargeReserved,
      fallbackToFalEnabled: params.providerRoutingPlan.fallbackEnabled,
      falPayload: params.falPayload,
      falInputSummary: params.falInputSummary,
      isLumaRay2: params.isLumaRay2,
      batchId: params.batchId,
      groupId: params.groupId,
      iterationIndex: params.iterationIndex,
      iterationCount: params.iterationCount,
      renderIds: params.renderIds,
      heroRenderId: params.heroRenderId,
      localKey: params.localKey,
      logMetricFn: params.logMetricFn,
    });
    if (!googleSubmission.ok) {
      return { kind: 'error_response', status: googleSubmission.status, body: googleSubmission.body };
    }
    if (googleSubmission.kind === 'accepted') {
      return { kind: 'accepted_response', body: googleSubmission.body };
    }
    return { kind: 'generation_result', generationResult: googleSubmission.generationResult };
  }

  if (params.providerRoutingPlan.kind === 'google_vertex_omni_primary') {
    const googleSubmission = await submitGoogleVertexOmniGenerateTask({
      jobId: params.jobId,
      userId: params.userId,
      engineId: params.engineId,
      engineLabel: params.engineLabel,
      mode: params.mode,
      prompt: params.prompt,
      negativePrompt: typeof params.negativePrompt === 'string' ? params.negativePrompt : null,
      durationSec: params.durationSec,
      aspectRatio: params.aspectRatio,
      audioEnabled: params.audioEnabled,
      placeholderThumb: params.placeholderThumb,
      pricing: params.pricing,
      paymentStatus: params.paymentStatus,
      pendingReceipt: params.pendingReceipt,
      paymentMode: params.paymentMode,
      walletChargeReserved: params.walletChargeReserved,
      fallbackToFalEnabled: params.providerRoutingPlan.fallbackEnabled,
      falPayload: params.falPayload,
      falInputSummary: params.falInputSummary,
      isLumaRay2: params.isLumaRay2,
      batchId: params.batchId,
      groupId: params.groupId,
      iterationIndex: params.iterationIndex,
      iterationCount: params.iterationCount,
      renderIds: params.renderIds,
      heroRenderId: params.heroRenderId,
      localKey: params.localKey,
      logMetricFn: params.logMetricFn,
    });
    if (!googleSubmission.ok) {
      return { kind: 'error_response', status: googleSubmission.status, body: googleSubmission.body };
    }
    if (googleSubmission.kind === 'accepted') {
      return { kind: 'accepted_response', body: googleSubmission.body };
    }
    return { kind: 'generation_result', generationResult: googleSubmission.generationResult };
  }

  const providerJobTracker = createProviderJobTracker({
    jobId: params.jobId,
    providerKey: params.providerKey,
    engineId: params.engineId,
    prompt: params.prompt,
    inputSummary: params.falInputSummary,
  });
  const falSubmission = await submitFalGenerateTask({
    falPayload: params.falPayload,
    jobId: params.jobId,
    engineId: params.engineId,
    engineLabel: params.engineLabel,
    isLumaRay2: params.isLumaRay2,
    batchId: params.batchId,
    durationSec: params.durationSec,
    pendingReceipt: params.pendingReceipt,
    paymentMode: params.paymentMode,
    walletChargeReserved: params.walletChargeReserved,
    getLastProviderJobId: providerJobTracker.getLastProviderJobId,
    setLastProviderJobId: providerJobTracker.setLastProviderJobId,
    persistProviderJobId: providerJobTracker.persistProviderJobId,
    logMetricFn: params.logMetricFn,
  });
  if (!falSubmission.ok) {
    return { kind: 'error_response', status: falSubmission.status, body: falSubmission.body };
  }
  return { kind: 'generation_result', generationResult: falSubmission.generationResult };
}
