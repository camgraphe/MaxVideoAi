import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureBillingSchema } from '@/lib/schema';
import { loadFallbackJobs } from './fallback';
import { getUserIdFromRequest } from '@/lib/user';
import { ENV } from '@/lib/env';

export async function GET(req: NextRequest) {
  await ensureBillingSchema();
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '24')));
  const cursor = url.searchParams.get('cursor');
  const userId = await getUserIdFromRequest(req);
  const allowAnonymous =
    (ENV.RESULT_PROVIDER ?? '').toUpperCase() === 'TEST' || (ENV.RESULT_PROVIDER ?? '').toUpperCase() === '';

  if (!userId) {
    if (allowAnonymous) {
      const fallback = await loadFallbackJobs(limit, cursor);
      return NextResponse.json({ ok: true, jobs: fallback.jobs, nextCursor: fallback.nextCursor });
    }
    return NextResponse.json({ ok: false, jobs: [], nextCursor: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params: Array<string | number> = [userId];
    const conditions: string[] = ['user_id = $1', 'hidden IS NOT TRUE'];

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
    }>(
    `SELECT id, job_id, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url, created_at, aspect_ratio, has_audio, can_upscale, preview_frame, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label
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
      thumbUrl: normalizeMediaUrl(r.thumb_url) ?? undefined,
      videoUrl: normalizeMediaUrl(r.video_url) ?? undefined,
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
      batchId: r.batch_id ?? undefined,
      groupId: r.group_id ?? undefined,
      iterationIndex: r.iteration_index ?? undefined,
      iterationCount: r.iteration_count ?? undefined,
      renderIds: Array.isArray(r.render_ids)
        ? (r.render_ids as unknown[]).map((value) => (typeof value === 'string' ? value : null)).filter(
            (entry): entry is string => Boolean(entry)
          )
        : undefined,
      heroRenderId: r.hero_render_id ?? undefined,
      localKey: r.local_key ?? undefined,
      message: r.message ?? undefined,
      etaSeconds: r.eta_seconds ?? undefined,
      etaLabel: r.eta_label ?? undefined,
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
