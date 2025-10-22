import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureBillingSchema } from '@/lib/schema';
import { getUserIdFromRequest } from '@/lib/user';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { updateJobFromFalWebhook } from '@/server/fal-webhook-handler';

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, jobs: [], nextCursor: null, error: 'Database unavailable' },
      { status: 503 }
    );
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[api/jobs] schema init failed', error);
    return NextResponse.json(
      { ok: false, jobs: [], nextCursor: null, error: 'Database unavailable' },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '24')));
  const cursor = url.searchParams.get('cursor');
  const userId = await getUserIdFromRequest(req);

  if (!userId) {
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

    type JobRow = {
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
      visibility: string | null;
      indexable: boolean | null;
      status: string | null;
      progress: number | null;
      provider_job_id: string | null;
    };

    let rows = await query<JobRow>(
    `SELECT id, job_id, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url, created_at, aspect_ratio, has_audio, can_upscale, preview_frame, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, visibility, indexable, status, progress, provider_job_id
       FROM app_jobs
       ${where}
       ORDER BY id DESC
       LIMIT $${limitParamIndex}`,
      params
    );

    const staleJobs = rows.filter((row) => {
      if (!row.provider_job_id) return false;
      const status = (row.status ?? '').toLowerCase();
      if (status === 'failed' || status === 'cancelled') return false;
      const missingVideo = !row.video_url;
      const missingThumb = !row.thumb_url;
      if (!missingVideo && status === 'completed') return false;
      return missingVideo || missingThumb;
    });

    if (staleJobs.length) {
      const falClient = getFalClient();
      const refreshedIds: string[] = [];
      const FAILURE_STATES = new Set(['FAILED', 'FAIL', 'ERROR', 'ERRORED', 'CANCELLED', 'CANCELED', 'NOT_FOUND', 'MISSING', 'UNKNOWN']);
      const COMPLETED_STATES = new Set(['COMPLETED', 'FINISHED', 'SUCCESS', 'SUCCEEDED']);
      for (const jobRow of staleJobs) {
        const markJobFailed = async (reason: string) => {
          try {
            await updateJobFromFalWebhook({
              request_id: jobRow.provider_job_id ?? undefined,
              status: 'failed',
              response: { error: reason, status: 'failed' },
              result: { error: reason, status: 'failed' },
            });
          } catch (updateError) {
            console.warn('[api/jobs] failed to mark job as failed via webhook handler', jobRow.job_id, updateError);
            try {
              await query(
                `UPDATE app_jobs SET status = 'failed', progress = LEAST(progress, 1), message = $1 WHERE job_id = $2`,
                [reason, jobRow.job_id]
              );
            } catch (writeError) {
              console.warn('[api/jobs] database update fallback for failed job also failed', jobRow.job_id, writeError);
            }
          }
          refreshedIds.push(jobRow.job_id);
        };

        try {
          let engineIdForLookup = jobRow.engine_id;
          if (!engineIdForLookup || engineIdForLookup === 'fal-unknown') {
            const logRows = await query<{ engine_id: string | null }>(
              `SELECT engine_id
                 FROM fal_queue_log
                WHERE provider_job_id = $1
                ORDER BY created_at DESC
                LIMIT 1`,
              [jobRow.provider_job_id]
            );
            if (logRows[0]?.engine_id) {
              engineIdForLookup = logRows[0].engine_id;
            } else {
              const altRows = await query<{ engine_id: string | null }>(
                `SELECT engine_id
                   FROM app_jobs
                  WHERE provider_job_id = $1
                    AND engine_id IS NOT NULL
                    AND engine_id <> 'fal-unknown'
                  ORDER BY updated_at DESC
                  LIMIT 1`,
                [jobRow.provider_job_id]
              );
              if (altRows[0]?.engine_id) {
                engineIdForLookup = altRows[0].engine_id;
              }
            }
          }

          if (!engineIdForLookup || engineIdForLookup === 'fal-unknown') {
            await markJobFailed('Unable to determine Fal engine for this job.');
            continue;
          }

          const falModel =
            (await resolveFalModelId(engineIdForLookup)) ??
            engineIdForLookup;
          const statusInfo = (await falClient.queue
            .status(falModel, { requestId: jobRow.provider_job_id! })
            .catch((error: unknown) => {
              console.warn('[api/jobs] fal status fetch failed', jobRow.job_id, error);
              return null;
            })) as Record<string, unknown> | null;

          if (!statusInfo) {
            await markJobFailed('Fal job status unavailable (possibly expired).');
            continue;
          }

          const statusRecord = statusInfo as Record<string, unknown>;
          const rawState =
            (typeof statusRecord.status === 'string' && (statusRecord.status as string)) ||
            (typeof statusRecord.state === 'string' && (statusRecord.state as string)) ||
            undefined;
          const state = rawState ? rawState.toUpperCase() : undefined;
          const providerError =
            (typeof statusRecord.error === 'string' && (statusRecord.error as string)) ||
            (typeof statusRecord.error_message === 'string' && (statusRecord.error_message as string)) ||
            undefined;

          if (state && FAILURE_STATES.has(state)) {
            await markJobFailed(providerError ?? 'Fal reported this job as failed.');
            continue;
          }

          if (!state && !jobRow.video_url) {
            await markJobFailed(providerError ?? 'Fal could not locate this job.');
            continue;
          }

          if (state && !COMPLETED_STATES.has(state)) {
            // Job is still in progress according to Fal; skip for now.
            continue;
          }

          const queueResult = await falClient.queue.result(falModel, { requestId: jobRow.provider_job_id! });
          if (!queueResult) {
            await markJobFailed(providerError ?? 'Fal returned no result for this job.');
            continue;
          }
          const previousStatus = (jobRow.status ?? '').toLowerCase();
          const queueStatus =
            queueResult && typeof queueResult === 'object' && 'status' in queueResult
              ? (queueResult as { status?: string | null }).status ?? undefined
              : state ?? undefined;
          const shouldPreserveStatus =
            previousStatus === 'completed' || previousStatus === 'success' || previousStatus === 'succeeded';
          const nextStatus = shouldPreserveStatus && queueStatus ? jobRow.status ?? undefined : queueStatus ?? jobRow.status ?? undefined;
          await updateJobFromFalWebhook({
            request_id: jobRow.provider_job_id ?? undefined,
            status: nextStatus,
            result: queueResult,
          });
          refreshedIds.push(jobRow.job_id);
        } catch (error) {
          console.warn('[api/jobs] failed to refresh job from Fal', jobRow.job_id, error);
          await markJobFailed(
            error instanceof Error ? error.message : 'Fal job could not be refreshed and was marked as failed.'
          );
        }
      }

      if (refreshedIds.length) {
        const refreshedRows = await query<JobRow>(
          `SELECT id, job_id, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url, created_at, aspect_ratio, has_audio, can_upscale, preview_frame, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, visibility, indexable, status, progress, provider_job_id
             FROM app_jobs
             WHERE job_id = ANY($1::text[])`,
          [refreshedIds]
        );
        const refreshedMap = new Map(refreshedRows.map((row) => [row.job_id, row]));
        rows = rows.map((row) => refreshedMap.get(row.job_id) ?? row);
      }
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
      status: r.status ?? undefined,
      progress: typeof r.progress === 'number' ? r.progress : undefined,
      heroRenderId: r.hero_render_id ?? undefined,
      localKey: r.local_key ?? undefined,
      message: r.message ?? undefined,
      etaSeconds: r.eta_seconds ?? undefined,
      etaLabel: r.eta_label ?? undefined,
      visibility: r.visibility ?? 'public',
      indexable: r.indexable ?? true,
    }));

    return NextResponse.json({ ok: true, jobs: mapped, nextCursor });
  } catch (error) {
    console.warn('[api/jobs] query failed', error);
    return NextResponse.json(
      { ok: false, jobs: [], nextCursor: null, error: 'Database unavailable' },
      { status: 503 }
    );
  }
}
