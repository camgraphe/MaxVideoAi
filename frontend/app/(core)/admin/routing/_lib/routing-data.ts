import { query, isDatabaseConfigured } from '@/lib/db';
import { type PurchaseCandidate } from '@/lib/video-purchase-decision';
import {
  rankPurchaseOffers,
  WAN_PRIME_OFFERS,
  type PurchaseRequest,
} from '@/server/video-providers/purchase-router';

export type RoutingScenario = {
  id: string;
  label: string;
  settings: string;
  ceiling: number;
  candidates: PurchaseCandidate[];
};
export function routingScenarios(): RoutingScenario[] {
  const request: PurchaseRequest = {
    engineId: 'wan-3-prime',
    mode: 't2v',
    durationSec: 15,
    resolution: '480p',
    aspectRatio: '16:9',
    images: 0,
    hasEndFrame: false,
    hasVideo: false,
    hasAudioReference: false,
    hasDocument: false,
    inputVideoSeconds: 0,
  };
  function scenario(
    id: string,
    label: string,
    settings: string,
    overrides: Partial<PurchaseRequest>
  ): RoutingScenario {
    const plan = rankPurchaseOffers({ ...request, ...overrides }, WAN_PRIME_OFFERS, {
      ceilingMicros: Number.MAX_SAFE_INTEGER,
    });
    return {
      id,
      label,
      settings,
      candidates: plan.candidates,
      ceiling: plan.candidates.find((row) => row.provider === 'alibaba_model_studio')?.costMicros ?? 0,
    };
  }
  return [
    scenario('text', 'Text to video', '15 s · 480p · 16:9 · audio on', {}),
    scenario('reference', 'One reference image', '4 s · 720p · 16:9 · audio on', {
      mode: 'ref2v',
      durationSec: 4,
      resolution: '720p',
      images: 1,
    }),
    scenario('video', 'Reference video', '5 s input + 5 s output · 720p · 16:9', {
      mode: 'ref2v',
      durationSec: 5,
      resolution: '720p',
      hasVideo: true,
      inputVideoSeconds: 5,
    }),
    scenario('extend', 'Extend video', '5 s input + 5 s output · 720p · direct only', {
      mode: 'extend',
      durationSec: 5,
      resolution: '720p',
      hasVideo: true,
      inputVideoSeconds: 5,
    }),
  ];
}

export type RoutingJob = {
  job_id: string;
  engine_id: string;
  provider: string | null;
  status: string;
  created_at: string;
  attempts: { provider: string; status: string; reason: string | null }[];
  purchase_mode: string | null;
  ranked: string[] | null;
  candidates: PurchaseCandidate[] | null;
  ceiling_micros: string | null;
};
export async function recentRoutingJobs(): Promise<RoutingJob[] | null> {
  if (!isDatabaseConfigured()) return null;
  return query<RoutingJob>(`WITH recent AS (
    SELECT id, job_id, engine_id, provider, status, created_at FROM app_jobs
    WHERE surface = 'video' ORDER BY created_at DESC, id DESC LIMIT 24
  ) SELECT recent.job_id, recent.engine_id, recent.provider, recent.status, recent.created_at,
    COALESCE(ledger.attempts, '[]'::jsonb) AS attempts,
    primary_attempt.request_snapshot #>> '{purchaseRouting,mode}' AS purchase_mode,
    primary_attempt.request_snapshot #> '{purchaseRouting,order}' AS ranked,
    primary_attempt.request_snapshot #> '{purchaseRouting,candidates}' AS candidates,
    primary_attempt.request_snapshot #>> '{purchaseRouting,ceilingMicros}' AS ceiling_micros
    FROM recent LEFT JOIN provider_attempts primary_attempt ON primary_attempt.job_id = recent.id AND primary_attempt.attempt_index = 1
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('provider', provider, 'status', status, 'reason', error_class)
        ORDER BY attempt_index) AS attempts FROM provider_attempts WHERE job_id = recent.id
    ) ledger ON true ORDER BY recent.created_at DESC,recent.id DESC`);
}
