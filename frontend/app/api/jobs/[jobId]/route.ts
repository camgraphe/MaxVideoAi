import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { shouldUseFalApis } from '@/lib/result-provider';
import { getPosterFrame } from '@/lib/fal';
import type { PricingSnapshot } from '@/types/engines';
import { ensureBillingSchema } from '@/lib/schema';
import { loadFallbackJob } from '../fallback';
import { buildFalProxyUrl } from '@/lib/fal-proxy';
import { normalizeMediaUrl } from '@/lib/media';
import { getMockJob } from '@/lib/mock-jobs-store';

type DbJobRow = {
  id: number;
  job_id: string;
  status: string;
  progress: number;
  provider_job_id: string | null;
  video_url: string | null;
  thumb_url: string;
  engine_label: string;
  duration_sec: number;
  prompt: string;
  created_at: string;
  final_price_cents: number | null;
  pricing_snapshot: PricingSnapshot | null;
  currency: string | null;
  payment_status: string | null;
  vendor_account_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  batch_id: string | null;
  group_id: string | null;
  iteration_index: number | null;
  iteration_count: number | null;
  render_ids: unknown;
  hero_render_id: string | null;
  local_key: string | null;
  message: string | null;
  eta_seconds: number | null;
  eta_label: string | null;
};

function respondWithMockJob(jobId: string) {
  const job = getMockJob(jobId);
  if (!job) return null;
  const status =
    job.status === 'failed'
      ? 'failed'
      : job.status === 'completed' || job.videoUrl
        ? 'completed'
        : 'pending';
  return NextResponse.json({
    ok: true,
    jobId: job.jobId,
    status,
    progress: job.progress,
    videoUrl: normalizeMediaUrl(job.videoUrl) ?? undefined,
    thumbUrl: normalizeMediaUrl(job.thumbUrl) ?? undefined,
    pricing: job.pricing ?? undefined,
    finalPriceCents: job.pricing?.totalCents ?? undefined,
    currency: job.pricing?.currency ?? 'USD',
    paymentStatus: job.paymentStatus ?? undefined,
    vendorAccountId: undefined,
    stripePaymentIntentId: undefined,
    stripeChargeId: undefined,
    batchId: job.batchId ?? undefined,
    groupId: job.groupId ?? undefined,
    iterationIndex: job.iterationIndex ?? undefined,
    iterationCount: job.iterationCount ?? undefined,
    renderIds: job.renderIds ?? undefined,
    heroRenderId: job.heroRenderId ?? undefined,
    localKey: job.localKey ?? undefined,
    message: job.message ?? undefined,
    etaSeconds: job.etaSeconds ?? undefined,
    etaLabel: job.etaLabel ?? undefined,
  });
}

async function respondWithFallbackJob(jobId: string) {
  const fallback = await loadFallbackJob(jobId);
  if (!fallback) return null;
  return NextResponse.json({
    ok: true,
    jobId: fallback.jobId,
    status: 'completed',
    progress: 100,
    videoUrl: normalizeMediaUrl(fallback.videoUrl) ?? undefined,
    thumbUrl: normalizeMediaUrl(fallback.thumbUrl) ?? undefined,
    pricing: fallback.pricingSnapshot ?? undefined,
    finalPriceCents: fallback.finalPriceCents ?? undefined,
    currency: fallback.currency ?? 'USD',
    paymentStatus: undefined,
    vendorAccountId: undefined,
    stripePaymentIntentId: undefined,
    stripeChargeId: undefined,
    batchId: fallback.batchId ?? undefined,
    groupId: fallback.groupId ?? undefined,
    iterationIndex: fallback.iterationIndex ?? undefined,
    iterationCount: fallback.iterationCount ?? undefined,
    renderIds: fallback.renderIds ?? undefined,
    heroRenderId: fallback.heroRenderId ?? undefined,
    localKey: fallback.localKey ?? undefined,
    message: fallback.message ?? undefined,
    etaSeconds: fallback.etaSeconds ?? undefined,
    etaLabel: fallback.etaLabel ?? undefined,
  });
}

async function respondNotFound(jobId: string) {
  const mock = respondWithMockJob(jobId);
  if (mock) return mock;
  const fallback = await respondWithFallbackJob(jobId);
  if (fallback) return fallback;
  return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
}

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const jobId = params.jobId;

  if (!process.env.DATABASE_URL) {
    return respondNotFound(jobId);
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[api/jobs] schema init failed, using mock store', error);
    return respondNotFound(jobId);
  }

  let rows: DbJobRow[];
  try {
    rows = await query<DbJobRow>(
      `SELECT id, job_id, status, progress, provider_job_id, video_url, thumb_url, engine_label, duration_sec, prompt, created_at, final_price_cents, pricing_snapshot, currency, payment_status, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label
       FROM app_jobs
       WHERE job_id = $1
       LIMIT 1`,
      [jobId]
    );
  } catch (error) {
    console.warn('[api/jobs] query failed, using mock store', error);
    return respondNotFound(jobId);
  }

  if (!rows.length) {
    return respondNotFound(jobId);
  }

  const job = rows[0];
  const normalizedVideoUrl = normalizeMediaUrl(job.video_url);
  const normalizedThumbUrl = normalizeMediaUrl(job.thumb_url);
  const parsedRenderIds = Array.isArray(job.render_ids)
    ? (job.render_ids as unknown[])
        .map((value) => (typeof value === 'string' ? value : null))
        .filter((entry): entry is string => Boolean(entry))
    : undefined;

  // Optionally poll FAL once if pending and we have provider job id
  if (shouldUseFalApis() && job.provider_job_id && job.status !== 'completed' && job.status !== 'failed') {
    try {
      const statusUrl = buildFalProxyUrl(`/status/${job.provider_job_id}`);
      const sr = await fetch(statusUrl);
      if (sr.ok) {
        const sj = await sr.json();
        const vUrl: string | undefined = sj?.response?.video?.url || sj?.output?.video || sj?.video_url;
        const st: string | undefined = sj?.status || sj?.state;
        const prog: number | undefined = sj?.progress || sj?.percent;
        let status = job.status;
        let progress = job.progress;
        let videoUrl = normalizedVideoUrl;
        let thumbUrl = normalizedThumbUrl;
        if (vUrl) {
          status = 'completed';
          progress = 100;
          videoUrl = normalizeMediaUrl(vUrl) ?? vUrl;
          const poster = await getPosterFrame(vUrl).catch(() => null);
          if (poster) {
            thumbUrl = normalizeMediaUrl(poster) ?? poster;
          }
        } else if (st === 'failed') {
          status = 'failed';
        } else if (typeof prog === 'number') {
          progress = Math.max(progress, Math.min(100, Math.round(prog)));
          status = 'running';
        }
        if (status !== job.status || progress !== job.progress || videoUrl !== normalizedVideoUrl || thumbUrl !== normalizedThumbUrl) {
          await query(
            `UPDATE app_jobs SET status = $1, progress = $2, video_url = $3, thumb_url = $4, preview_frame = $5 WHERE job_id = $6`,
            [status, progress, videoUrl ?? null, thumbUrl ?? null, thumbUrl ?? null, jobId]
          );
          return NextResponse.json({
            ok: true,
            jobId,
            status,
            progress,
            videoUrl: videoUrl ?? undefined,
            thumbUrl: thumbUrl ?? undefined,
            pricing: job.pricing_snapshot ?? undefined,
            finalPriceCents: job.final_price_cents ?? undefined,
            currency: job.currency ?? 'USD',
            paymentStatus: job.payment_status ?? undefined,
            vendorAccountId: job.vendor_account_id ?? undefined,
            stripePaymentIntentId: job.stripe_payment_intent_id ?? undefined,
            stripeChargeId: job.stripe_charge_id ?? undefined,
            batchId: job.batch_id ?? undefined,
            groupId: job.group_id ?? undefined,
            iterationIndex: job.iteration_index ?? undefined,
            iterationCount: job.iteration_count ?? undefined,
            renderIds: parsedRenderIds,
            heroRenderId: job.hero_render_id ?? undefined,
            localKey: job.local_key ?? undefined,
            message: job.message ?? undefined,
            etaSeconds: job.eta_seconds ?? undefined,
            etaLabel: job.eta_label ?? undefined,
          });
        }
      }
    } catch {
      // ignore polling errors
    }
  }

  return NextResponse.json({
    ok: true,
    jobId,
    status: job.status,
    progress: job.progress,
    videoUrl: normalizedVideoUrl ?? undefined,
    thumbUrl: normalizedThumbUrl ?? undefined,
    pricing: job.pricing_snapshot ?? undefined,
    finalPriceCents: job.final_price_cents ?? undefined,
    currency: job.currency ?? 'USD',
    paymentStatus: job.payment_status ?? undefined,
    vendorAccountId: job.vendor_account_id ?? undefined,
    stripePaymentIntentId: job.stripe_payment_intent_id ?? undefined,
    stripeChargeId: job.stripe_charge_id ?? undefined,
    batchId: job.batch_id ?? undefined,
    groupId: job.group_id ?? undefined,
    iterationIndex: job.iteration_index ?? undefined,
    iterationCount: job.iteration_count ?? undefined,
    renderIds: parsedRenderIds,
    heroRenderId: job.hero_render_id ?? undefined,
    localKey: job.local_key ?? undefined,
    message: job.message ?? undefined,
    etaSeconds: job.eta_seconds ?? undefined,
    etaLabel: job.eta_label ?? undefined,
  });
}
