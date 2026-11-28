import { query } from '@/lib/db';
import { KLING_V4_ENDPOINTS } from '@/lib/kling-v4';
import { nextPurchaseProvider, purchaseRoutingSnapshot } from '@/lib/video-purchase-decision';
import type { withWalletFailureSettlement } from '@/server/fal-webhook-refunds';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { ownedMediaStorageKeyForUrl } from '@/server/storage-read';
import { createProviderAttempt, linkProviderFallbackAttempt, markProviderAttemptAccepted, markProviderAttemptFailed,
  ProviderAttemptAlreadyClaimed, syncProviderAttemptTerminalStatus } from '@/server/video-providers/provider-attempts';
import { customerPurchaseCeiling } from '@/server/video-providers/purchase-router';
import { createPinnedVideoRouterClient, VideoRouterSubmitError } from '@/server/video-providers/videorouter/client';
import { stopKlingV4WalletPurchase } from '@/server/video-providers/videorouter/kling-v4-wallet-stop';
import { KLING_V4_SANDBASE_MODEL, klingV4VideoRouterEnabled, klingV4SandBasePlan, klingV4SandBaseReferences, klingV4SandBaseRequest } from '@/server/video-providers/videorouter/kling-v4';
import { buildPersistedVideoJobResponse, type PersistedVideoJob } from './persisted-video-job';
import { persistDirectProviderAcceptance } from './direct-provider-acceptance';
import type { GenerateProviderSubmissionParams, GenerateProviderSubmissionResult } from './video-provider-submission';

type Query = <T>(sql: string, values?: unknown[]) => Promise<T[]>;
type FalSubmit = (onAccepted: (id: string) => Promise<void>) => Promise<GenerateProviderSubmissionResult>;
type Deps = { query?: Query; sign?: typeof createOwnedMediaReadUrl; client?: ReturnType<typeof createPinnedVideoRouterClient>;
  settle?: typeof withWalletFailureSettlement };

function deferred(jobId: string): GenerateProviderSubmissionResult {
  return { kind: 'error_response', status: 202, body: { ok: true, jobId, deferred: true, status: 'running',
    error: 'SUBMISSION_UNCONFIRMED', message: 'This generation is being checked. Do not submit it again.' } };
}

export async function tryKlingV4VideoRouter(params: GenerateProviderSubmissionParams, submitFal: FalSubmit, deps: Deps = {}):
Promise<GenerateProviderSubmissionResult | null> {
  if (params.engineId !== 'kling-v4') return null;
  const queryFn = deps.query ?? query;
  const { jobId, userId } = params;
  // A retry can arrive on another deployment with different controls or destination settings.
  // Inspect the persisted owner before the in-memory request can select any paid transport.
  const [existing] = await queryFn<PersistedVideoJob>(`SELECT j.* FROM app_jobs j WHERE j.job_id=$1 AND j.user_id=$2
    AND (j.settings_snapshot ? 'klingV4WalletStop' OR EXISTS (SELECT 1 FROM provider_attempts a WHERE a.job_id=j.id AND a.attempt_index=1))`, [jobId, userId]);
  if (existing) {
    if (existing.provider_job_id || existing.status === 'completed' || existing.status === 'failed') {
      return { kind: 'accepted_response', body: buildPersistedVideoJobResponse(existing, params.localKey) };
    }
    return deferred(jobId);
  }
  if (params.paymentMode !== 'wallet' || !params.walletChargeReserved || params.providerKey !== 'fal') return null;

  async function claim(input: Omit<Parameters<typeof createProviderAttempt>[0], 'claimOnce' | 'publicJobId' | 'queryFn'>) {
    try { return await createProviderAttempt({ ...input, claimOnce: true, publicJobId: jobId, queryFn }); }
    catch (error) {
      if (error instanceof ProviderAttemptAlreadyClaimed) return null;
      throw error;
    }
  }
  async function sendFal(attemptId: number) {
    const result = await submitFal(async providerJobId => {
      try {
        await markProviderAttemptAccepted({ attemptId, providerJobId, queryFn });
        await syncProviderAttemptTerminalStatus({ publicJobId: jobId, provider: 'fal', providerJobId, queryFn });
      } catch { console.warn('[kling-v4-routing] Fal acceptance persistence deferred', { jobId }); }
    });
    if (result.kind === 'error_response' && result.body.ok === false) {
      await markProviderAttemptFailed({ attemptId, errorClass: 'fal_submit_failed', fallbackEligible: false, queryFn })
        .catch(() => console.warn('[kling-v4-routing] Fal refusal persistence deferred', { jobId }));
    }
    return result;
  }
  async function bindProvider(provider: 'fal' | 'videorouter') {
    // A provisional Fal job can be reclaimed by maintenance while a supplier is working.
    // Only the worker that claimed the next attempt can hand off the unacknowledged job.
    const rows = await queryFn(`UPDATE app_jobs SET provider=$3, status='running', provisional=FALSE, updated_at=NOW()
      WHERE job_id=$1 AND user_id=$2 AND provider_job_id IS NULL AND status IN ('pending','queued','running','processing','in_progress')
      RETURNING id`, [jobId, userId, provider]);
    return rows.length === 1;
  }
  const matches = params.mode === 'ref2v' && params.audioEnabled !== false && !params.negativePrompt &&
    !params.imageUrl && params.cfgScale == null && params.prompt === params.falPayload.prompt &&
    params.durationSec === params.falPayload.durationSec && params.effectiveResolution === '720p' && params.aspectRatio === '16:9';
  const images = matches ? klingV4SandBaseReferences(params.falPayload) : null;
  const verifiedFacts = images?.every(url => Boolean(ownedMediaStorageKeyForUrl({ url, userId }))) ? {
    engineId: params.engineId, mode: params.mode, durationSec: params.durationSec, promptLength: params.prompt.trim().length,
    resolution: params.effectiveResolution, aspectRatio: params.aspectRatio, referenceImageCount: images.length,
    ownedReferenceImages: true, hasSeed: false, unreviewedOptions: false, audioEnabled: true,
    hasStartImage: false, hasEndImage: false, referenceVideoCount: 0, referenceAudioCount: 0,
  } : null;
  if (!images || !verifiedFacts || !klingV4VideoRouterEnabled()) {
    // Every paid Kling V4 request claims the same first slot before dispatch, including native-only settings.
    const providerModel = KLING_V4_ENDPOINTS[params.mode as keyof typeof KLING_V4_ENDPOINTS];
    const native = await claim({ attemptIndex: 1, provider: 'fal', providerModel, requestSnapshot: verifiedFacts });
    if (!native || !await bindProvider('fal')) return deferred(jobId);
    return sendFal(native.id);
  }
  const plan = klingV4SandBasePlan(params.durationSec, customerPurchaseCeiling(params.pricing));
  const snapshot = purchaseRoutingSnapshot(plan, 'canary');
  async function stop(message: string, attemptId: number | null, errorCode: string, errorClass: 'refused' | 'invalid') {
    try {
      const stopped = await stopKlingV4WalletPurchase({ jobId, userId, message, attemptId, errorCode, errorClass }, deps.settle);
      if (!stopped) return deferred(jobId);
      return { kind: 'error_response' as const, status: errorClass === 'invalid' ? 400 : 503,
        body: { ok: false, jobId, status: 'failed', paymentStatus: 'refunded_wallet', error: 'GENERATION_UNAVAILABLE', message } };
    } catch {
      console.warn('[kling-v4-routing] wallet settlement requires review', { jobId });
      return deferred(jobId);
    }
  }
  if (plan.order[0] !== 'videorouter') return stop('No compatible provider fits the purchase ceiling.', null, 'PURCHASE_CEILING', 'refused');
  const requestSnapshot = { ...verifiedFacts, estimatedProviderCostUsd: plan.candidates[0].costMicros! / 1e6, purchaseRouting: snapshot };
  const attempt = await claim({ attemptIndex: 1, provider: 'videorouter', providerModel: KLING_V4_SANDBASE_MODEL, requestSnapshot });
  if (!attempt || !await bindProvider('videorouter')) return deferred(jobId);

  let task;
  try {
    const urls = await Promise.all(images.map(url => (deps.sign ?? createOwnedMediaReadUrl)({ url, userId, expiresInSeconds: 3600 })))
      .catch(() => { throw new VideoRouterSubmitError('invalid', 'REFERENCE_INVALID'); });
    const request = klingV4SandBaseRequest(params.prompt, params.durationSec, urls, requestSnapshot.estimatedProviderCostUsd);
    task = await (deps.client ?? createPinnedVideoRouterClient()).createVideo(request);
  } catch (err) {
    const failure = err instanceof VideoRouterSubmitError ? err : new VideoRouterSubmitError('uncertain', 'SUBMISSION_UNCONFIRMED');
    if (failure.outcome === 'uncertain') {
      const results = await Promise.allSettled([
        queryFn(`UPDATE app_jobs SET provider='videorouter',status='provider_polling_stalled',provisional=FALSE,
          message='This generation requires review before retrying.',updated_at=NOW()
          WHERE job_id=$1 AND provider_job_id IS NULL AND status IN ('pending','queued','running','processing','in_progress')`, [jobId]),
        markProviderAttemptFailed({ attemptId: attempt.id, status: 'polling_stalled', errorCode: failure.code,
          errorClass: failure.outcome, fallbackEligible: false, queryFn }),
      ]);
      if (results.some(r => r.status === 'rejected')) console.warn('[kling-v4-routing] reconciliation write deferred', { jobId });
      return deferred(jobId);
    }
    if (nextPurchaseProvider(plan.order, 'videorouter', failure.outcome) !== 'fal') {
      return stop('This generation could not start with the requested inputs.', attempt.id, failure.code, failure.outcome);
    }
    await markProviderAttemptFailed({ attemptId: attempt.id, errorCode: failure.code, errorClass: failure.outcome, fallbackEligible: true, queryFn });
    const fallback = await claim({ attemptIndex: 2, provider: 'fal', providerModel: KLING_V4_ENDPOINTS.ref2v,
      status: 'fallback_started', requestSnapshot: { fallbackFrom: 'videorouter', fallbackReason: failure.code } });
    if (!fallback) return deferred(jobId);
    await linkProviderFallbackAttempt({ fromAttemptId: attempt.id, toAttemptId: fallback.id, queryFn });
    if (!await bindProvider('fal')) return deferred(jobId);
    return sendFal(fallback.id);
  }
  return { kind: 'accepted_response', body: await persistDirectProviderAcceptance({ jobId, provider: 'videorouter',
    providerJobId: task.providerJobId, attemptId: attempt.id, responseSnapshot: task.raw, status: 'queued', progress: 10,
    localKey: params.localKey, queryFn, acceptedBody: { ok: true, jobId, status: 'queued', providerJobId: task.providerJobId },
    logAccepted: () => params.logMetricFn('accepted', { jobId, meta: { provider: 'videorouter' } }),
  }) };
}
