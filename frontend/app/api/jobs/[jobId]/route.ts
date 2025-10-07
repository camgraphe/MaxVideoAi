import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ENV } from '@/lib/env';
import { shouldUseFalApis } from '@/lib/result-provider';
import { getPosterFrame } from '@/lib/fal';
import type { PricingSnapshot } from '@/types/engines';
import { ensureBillingSchema } from '@/lib/schema';
import { loadFallbackJob } from '../fallback';

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  await ensureBillingSchema();

  const jobId = params.jobId;
  const rows = await query<{
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
  }>(
    `SELECT id, job_id, status, progress, provider_job_id, video_url, thumb_url, engine_label, duration_sec, prompt, created_at, final_price_cents, pricing_snapshot, currency, payment_status, vendor_account_id, stripe_payment_intent_id, stripe_charge_id
     FROM app_jobs
     WHERE job_id = $1
     LIMIT 1`,
    [jobId]
  );
  if (!rows.length) {
    const fallback = await loadFallbackJob(jobId);
    if (!fallback) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      jobId: fallback.jobId,
      status: 'completed',
      progress: 100,
      videoUrl: fallback.videoUrl,
      thumbUrl: fallback.thumbUrl,
      pricing: fallback.pricingSnapshot ?? undefined,
      finalPriceCents: fallback.finalPriceCents ?? undefined,
      currency: fallback.currency ?? 'USD',
      paymentStatus: undefined,
      vendorAccountId: undefined,
      stripePaymentIntentId: undefined,
      stripeChargeId: undefined,
    });
  }
  const job = rows[0];

  // Optionally poll FAL once if pending and we have provider job id
  if (shouldUseFalApis() && job.provider_job_id && job.status !== 'completed' && job.status !== 'failed') {
    try {
      const statusUrl = `https://api.fal.ai/v1/status/${job.provider_job_id}`;
      const sr = await fetch(statusUrl, { headers: { Authorization: `Key ${ENV.FAL_API_KEY}` } });
      if (sr.ok) {
        const sj = await sr.json();
        const vUrl: string | undefined = sj?.response?.video?.url || sj?.output?.video || sj?.video_url;
        const st: string | undefined = sj?.status || sj?.state;
        const prog: number | undefined = sj?.progress || sj?.percent;
        let status = job.status;
        let progress = job.progress;
        let videoUrl = job.video_url;
        let thumbUrl = job.thumb_url;
        if (vUrl) {
          status = 'completed';
          progress = 100;
          videoUrl = vUrl;
          const poster = await getPosterFrame(vUrl).catch(() => null);
          if (poster) {
            thumbUrl = poster;
          }
        } else if (st === 'failed') {
          status = 'failed';
        } else if (typeof prog === 'number') {
          progress = Math.max(progress, Math.min(100, Math.round(prog)));
          status = 'running';
        }
        if (status !== job.status || progress !== job.progress || videoUrl !== job.video_url || thumbUrl !== job.thumb_url) {
          await query(
            `UPDATE app_jobs SET status = $1, progress = $2, video_url = $3, thumb_url = $4, preview_frame = $5 WHERE job_id = $6`,
            [status, progress, videoUrl, thumbUrl, thumbUrl, jobId]
          );
          return NextResponse.json({
            ok: true,
            jobId,
            status,
            progress,
            videoUrl,
            thumbUrl: thumbUrl ?? undefined,
            pricing: job.pricing_snapshot ?? undefined,
            finalPriceCents: job.final_price_cents ?? undefined,
            currency: job.currency ?? 'USD',
            paymentStatus: job.payment_status ?? undefined,
            vendorAccountId: job.vendor_account_id ?? undefined,
            stripePaymentIntentId: job.stripe_payment_intent_id ?? undefined,
            stripeChargeId: job.stripe_charge_id ?? undefined,
          });
        }
      }
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    jobId,
    status: job.status,
    progress: job.progress,
    videoUrl: job.video_url,
    thumbUrl: job.thumb_url ?? undefined,
    pricing: job.pricing_snapshot ?? undefined,
    finalPriceCents: job.final_price_cents ?? undefined,
    currency: job.currency ?? 'USD',
    paymentStatus: job.payment_status ?? undefined,
    vendorAccountId: job.vendor_account_id ?? undefined,
    stripePaymentIntentId: job.stripe_payment_intent_id ?? undefined,
    stripeChargeId: job.stripe_charge_id ?? undefined,
  });
}
