import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';
import { ensureBillingSchema } from '@/lib/schema';
import { loadFallbackJobs } from './fallback';

export async function GET(req: NextRequest) {
  await ensureBillingSchema();
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '24')));
  const cursor = url.searchParams.get('cursor');

  try {
    const params: Array<number> = [];
    const conditions: string[] = ['hidden IS NOT TRUE'];

    if (cursor) {
      params.push(Number(cursor));
      conditions.push(`id < $${params.length}`);
    }
    params.push(limit + 1);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitParamIndex = params.length;

    const rows = await query<{
      id: number;
      job_id: string;
      engine_id: string;
      engine_label: string;
      duration_sec: number;
      prompt: string;
      thumb_url: string;
      video_url: string | null;
      created_at: string;
      aspect_ratio: string | null;
      has_audio: boolean | null;
      can_upscale: boolean | null;
      preview_frame: string | null;
      final_price_cents: number | null;
      pricing_snapshot: PricingSnapshot | null;
      currency: string | null;
      vendor_account_id: string | null;
      payment_status: string | null;
      stripe_payment_intent_id: string | null;
      stripe_charge_id: string | null;
    }>(
    `SELECT id, job_id, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url, created_at, aspect_ratio, has_audio, can_upscale, preview_frame, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id
       FROM app_jobs
       ${where}
       ORDER BY id DESC
       LIMIT $${limitParamIndex}`,
      params
    );

    if (!rows.length) {
      const fallback = await loadFallbackJobs(limit, cursor);
      return NextResponse.json({ ok: true, jobs: fallback.jobs, nextCursor: fallback.nextCursor });
    }

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, -1) : rows;
    const nextCursor = hasMore ? String(items[items.length - 1].id) : null;

    type Row = (typeof rows)[number];
    const mapped = items.map((r: Row) => ({
      jobId: r.job_id,
      engineLabel: r.engine_label,
      durationSec: r.duration_sec,
      prompt: r.prompt,
      thumbUrl: r.thumb_url,
      videoUrl: r.video_url ?? undefined,
      createdAt: r.created_at,
      engineId: r.engine_id,
      aspectRatio: r.aspect_ratio ?? undefined,
      hasAudio: Boolean(r.has_audio ?? false),
      canUpscale: Boolean(r.can_upscale ?? false),
      previewFrame: r.preview_frame ?? undefined,
      finalPriceCents: r.final_price_cents ?? undefined,
      currency: r.currency ?? 'USD',
      pricingSnapshot: r.pricing_snapshot ?? undefined,
      vendorAccountId: r.vendor_account_id ?? undefined,
      paymentStatus: r.payment_status ?? undefined,
      stripePaymentIntentId: r.stripe_payment_intent_id ?? undefined,
      stripeChargeId: r.stripe_charge_id ?? undefined,
    }));

    return NextResponse.json({ ok: true, jobs: mapped, nextCursor });
  } catch {
    try {
      const fallback = await loadFallbackJobs(limit, cursor);
      return NextResponse.json({ ok: true, jobs: fallback.jobs, nextCursor: fallback.nextCursor });
    } catch {
      return NextResponse.json({ ok: false, jobs: [], nextCursor: null, error: 'Jobs unavailable' }, { status: 500 });
    }
  }
}
