import { ADMIN_EXCLUDED_USER_IDS } from '@/lib/admin/exclusions';
import { query } from '@/lib/db';
import { WAN_REVIEWED_EXTRA_KEYS } from '@/lib/video-routing/wan-options';
import { customerPurchaseCeiling, planWanPrimePurchase } from '@/server/video-providers/purchase-router';

export type ReplayGroup = {
  jobs: number;
  mode: string | null;
  duration: number;
  resolution: string | null;
  ratio: string | null;
  images: number | null;
  videos: number | null;
  audioRefs: number | null;
  startFrame: boolean | null;
  endFrame: boolean | null;
  document: boolean | null;
  unreviewed: boolean;
  cents: number | null;
  currency: string | null;
};

export function replayWanPrime(groups: readonly ReplayGroup[]) {
  const report = {
    total: 0, eligible: 0, threeRoutes: 0, missingFacts: 0, outsideCoverage: 0, overCeiling: 0,
    baselineMicros: 0, purchaseMicros: 0, modes: { t2v: 0, i2v: 0, ref2v: 0 },
  };
  const firstChoices: Record<string, number> = {};
  for (const row of groups) {
    report.total += row.jobs;
    const mode = row.mode;
    if (!mode || !row.resolution || !row.ratio || typeof row.startFrame !== 'boolean' || typeof row.endFrame !== 'boolean' ||
        typeof row.document !== 'boolean' || [row.images, row.videos, row.audioRefs].some(n => n == null || !Number.isInteger(n) || n < 0)) {
      report.missingFacts += row.jobs;
      continue;
    }
    if ((mode !== 't2v' && mode !== 'i2v' && mode !== 'ref2v') || row.videos || row.audioRefs || row.document || row.unreviewed) {
      report.outsideCoverage += row.jobs;
      continue;
    }
    const ceilingMicros = customerPurchaseCeiling({ totalCents: row.cents ?? NaN, currency: row.currency });
    if (ceilingMicros < 0) {
      report.missingFacts += row.jobs;
      continue;
    }
    const plan = planWanPrimePurchase({
      engineId: 'wan-3-prime', mode, durationSec: row.duration, resolution: row.resolution, aspectRatio: row.ratio,
      images: Number(row.images) + Number(row.startFrame), hasStartFrame: row.startFrame, hasEndFrame: row.endFrame,
      hasVideo: false, inputVideoSeconds: 0, hasAudioReference: false, hasDocument: false,
    }, { ceilingMicros });
    if (!plan.canaryEligible) {
      report.outsideCoverage += row.jobs;
      continue;
    }
    const first = plan.candidates.find(c => c.provider === plan.order[0]);
    const baseline = plan.candidates.find(c => c.provider === 'alibaba_model_studio');
    if (!first || first.costMicros == null || baseline?.costMicros == null) {
      report.overCeiling += row.jobs;
      continue;
    }
    firstChoices[first.provider] = (firstChoices[first.provider] ?? 0) + row.jobs;
    report.eligible += row.jobs;
    report.modes[mode] += row.jobs;
    if (plan.order.length === 3) report.threeRoutes += row.jobs;
    report.baselineMicros += row.jobs * baseline.costMicros;
    report.purchaseMicros += row.jobs * first.costMicros;
  }
  return { ...report, firstChoices };
}

export async function loadWanPrimeReplay() {
  const endDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const start = new Date(endDay + 'T00:00:00Z');
  start.setUTCDate(start.getUTCDate() - 30);
  const startDay = start.toISOString().slice(0, 10);
  const groups = await query<ReplayGroup>(`WITH shapes AS (
    SELECT coalesce(a.request_snapshot->>'mode', j.settings_snapshot->>'inputMode') AS mode,
      coalesce(a.request_snapshot->'durationSec', to_jsonb(j.duration_sec)) AS duration, lower(a.request_snapshot->>'resolution') AS resolution,
      coalesce(a.request_snapshot->>'aspectRatio', j.settings_snapshot#>>'{core,aspectRatio}') AS ratio,
      a.request_snapshot->'referenceImageCount' AS images, a.request_snapshot->'referenceVideoCount' AS videos,
      a.request_snapshot->'referenceAudioCount' AS "audioRefs", a.request_snapshot->'hasStartImage' AS "startFrame",
      a.request_snapshot->'hasEndImage' AS "endFrame",
      CASE WHEN jsonb_typeof(j.settings_snapshot) = 'object' THEN
        nullif(trim(j.settings_snapshot#>>'{advanced,extraInputValues,file_url}'),'') IS NOT NULL OR
        nullif(trim(j.settings_snapshot#>>'{advanced,extraInputValues,web_url}'),'') IS NOT NULL END AS document,
      coalesce(a.request_snapshot->'unreviewedWanOptions' = 'true'::jsonb, false) OR
      CASE WHEN jsonb_typeof(j.settings_snapshot#>'{advanced,extraInputValues}') = 'object' THEN
        jsonb_strip_nulls(j.settings_snapshot#>'{advanced,extraInputValues}') - $4::text[] <> '{}'::jsonb OR
        coalesce(jsonb_typeof(j.settings_snapshot#>'{advanced,extraInputValues,enable_prompt_expansion}'), 'null') NOT IN ('boolean','null')
        ELSE false END AS unreviewed,
      j.pricing_snapshot->'totalCents' AS cents, j.pricing_snapshot->>'currency' AS currency
    FROM app_jobs j LEFT JOIN provider_attempts a ON a.job_id=j.id AND a.attempt_index=1 AND a.provider IN ('alibaba_model_studio','apimart')
    WHERE j.created_at >= ($1::date::timestamp AT TIME ZONE 'Europe/Madrid')
      AND j.created_at < ($2::date::timestamp AT TIME ZONE 'Europe/Madrid')
      AND j.user_id <> ALL($3::text[]) AND j.surface='video' AND j.engine_id='wan-3-prime'
      AND j.status='completed' AND j.payment_status='paid_wallet'
  ) SELECT shapes.*, count(*)::int AS jobs FROM shapes GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13`,
    [startDay, endDay, ADMIN_EXCLUDED_USER_IDS, WAN_REVIEWED_EXTRA_KEYS]);
  return { startDay, endDay, ...replayWanPrime(groups) };
}
