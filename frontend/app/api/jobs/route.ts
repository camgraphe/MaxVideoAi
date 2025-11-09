import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureBillingSchema } from '@/lib/schema';
import { getUserIdFromRequest } from '@/lib/user';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { updateJobFromFalWebhook } from '@/server/fal-webhook-handler';
import { listStarterPlaylistVideos } from '@/server/videos';

function parseCursorParam(value: string | null): { createdAt: Date | null; id: number | null } {
  if (!value) {
    return { createdAt: null, id: null };
  }
  if (value.includes('|')) {
    const [timestampPart, idPart] = value.split('|', 2);
    let createdAt: Date | null = null;
    if (timestampPart) {
      const parsed = new Date(timestampPart);
      if (!Number.isNaN(parsed.getTime())) {
        createdAt = parsed;
      }
    }
    let id: number | null = null;
    if (idPart) {
      const parsed = Number.parseInt(idPart, 10);
      if (Number.isFinite(parsed)) {
        id = parsed;
      }
    }
    return { createdAt, id };
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return { createdAt: null, id: parsed };
  }
  return { createdAt: null, id: null };
}

function formatCursorValue(row: { created_at: string; id: number }): string {
  const createdAt = new Date(row.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return String(row.id);
  }
  return `${createdAt.toISOString()}|${row.id}`;
}

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
    const params: Array<string | number | Date> = [userId];
    const conditions: string[] = [
      'user_id = $1',
      'hidden IS NOT TRUE',
      "NOT (LOWER(status) IN ('failed','error','errored','cancelled','canceled') AND updated_at < NOW() - INTERVAL '150 seconds')"
    ];

    const cursorInfo = parseCursorParam(cursor);
    if (cursorInfo.createdAt) {
      params.push(cursorInfo.createdAt);
      const createdAtIndex = params.length;
      params.push(cursorInfo.id ?? Number.MAX_SAFE_INTEGER);
      const idIndex = params.length;
      conditions.push(`(created_at, id) < ($${createdAtIndex}, $${idIndex})`);
    } else if (typeof cursorInfo.id === 'number' && Number.isFinite(cursorInfo.id)) {
      params.push(cursorInfo.id);
      conditions.push(`id < $${params.length}`);
    }
    params.push(limit + 1);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitParamIndex = params.length;

type JobRow = {
      id: number;
      job_id: string;
      updated_at: string;
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
    `SELECT id, job_id, updated_at, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url, created_at, aspect_ratio, has_audio, can_upscale, preview_frame, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, visibility, indexable, status, progress, provider_job_id
      FROM app_jobs
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${limitParamIndex}`,
      params
    );

    const staleJobs = rows.filter((row) => {
      if (!row.provider_job_id) return false;
      const status = (row.status ?? '').toLowerCase();
      if (status === 'failed' || status === 'cancelled' || status === 'canceled' || status === 'error') return false;
      const missingVideo = !row.video_url;
      const missingThumb = !row.thumb_url;
      if (!missingVideo && status === 'completed') return false;
      return missingVideo || missingThumb;
    });

    if (staleJobs.length) {
      console.info('[api/jobs] refreshing stale Fal jobs', {
        at: new Date().toISOString(),
        userId,
        count: staleJobs.length,
        samples: staleJobs.slice(0, 5).map((job) => ({
          jobId: job.job_id,
          providerJobId: job.provider_job_id,
          status: job.status,
          createdAt: job.created_at,
          videoUrl: job.video_url,
          thumbUrl: job.thumb_url,
        })),
      });
      const falClient = getFalClient();
      const refreshedIds: string[] = [];
      const FAILURE_STATES = new Set(['FAILED', 'FAIL', 'ERROR', 'ERRORED', 'CANCELLED', 'CANCELED', 'NOT_FOUND', 'MISSING', 'UNKNOWN']);
      const COMPLETED_STATES = new Set(['COMPLETED', 'FINISHED', 'SUCCESS', 'SUCCEEDED']);
      for (const jobRow of staleJobs) {
        const markJobFailed = async (reason: string) => {
          console.warn('[api/jobs] marking job as failed after stale refresh', {
            at: new Date().toISOString(),
            jobId: jobRow.job_id,
            providerJobId: jobRow.provider_job_id,
            reason,
          });
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
          console.info('[api/jobs] refreshed Fal job payload', {
            at: new Date().toISOString(),
            jobId: jobRow.job_id,
            providerJobId: jobRow.provider_job_id,
            falState: state ?? queueStatus ?? null,
            previousStatus: jobRow.status,
            nextStatus,
            hasVideo: Boolean(jobRow.video_url),
            providerError,
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
          `SELECT id, job_id, updated_at, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url, created_at, aspect_ratio, has_audio, can_upscale, preview_frame, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, visibility, indexable, status, progress, provider_job_id
             FROM app_jobs
             WHERE job_id = ANY($1::text[])`,
          [refreshedIds]
        );
        const refreshedMap = new Map(refreshedRows.map((row) => [row.job_id, row]));
        rows = rows.map((row) => refreshedMap.get(row.job_id) ?? row);
        console.info('[api/jobs] applied refreshed Fal rows', {
          at: new Date().toISOString(),
          userId,
          refreshedCount: refreshedIds.length,
        });
      }
    }

    const hasMore = rows.length > limit;
    let items = hasMore ? rows.slice(0, -1) : rows;

    if (items.length) {
      const seenProviderIds = new Set<string>();
      const deduped: typeof items = [];
      items.forEach((row) => {
        const providerId = typeof row.provider_job_id === 'string' ? row.provider_job_id.trim() : '';
        if (providerId && seenProviderIds.has(providerId)) {
          return;
        }
        if (providerId) {
          seenProviderIds.add(providerId);
        }
        deduped.push(row);
      });
      if (deduped.length !== items.length) {
        console.info('[api/jobs] deduplicated provider job ids', {
          at: new Date().toISOString(),
          userId,
          removed: items.length - deduped.length,
        });
      }
      items = deduped;
    }

    const nextCursor = hasMore && items.length ? formatCursorValue(items[items.length - 1]) : null;

    type Row = (typeof rows)[number];
    const normalizeRenderIds = (value: unknown): string[] | undefined => {
      const coerce = (entries: unknown[]): string[] =>
        entries
          .map((entry) => {
            if (typeof entry === 'string' && entry.length) return entry;
            if (entry && typeof entry === 'object') {
              const record = entry as Record<string, unknown>;
              if (typeof record.url === 'string' && record.url.length) {
                return record.url;
              }
            }
            return null;
          })
          .filter((entry): entry is string => Boolean(entry));

      if (Array.isArray(value)) {
        return coerce(value);
      }
      if (typeof value === 'string' && value.trim().length) {
        try {
          const parsed = JSON.parse(value) as unknown;
          if (Array.isArray(parsed)) {
            return coerce(parsed);
          }
        } catch {
          return undefined;
        }
      }
      return undefined;
    };

    let mapped = items.map((r: Row) => {
      const renderIds = normalizeRenderIds(r.render_ids);
      const primaryImage = renderIds?.[0] ? normalizeMediaUrl(renderIds[0]) ?? renderIds[0] : undefined;
      return {
        jobId: r.job_id,
        engineLabel: r.engine_label,
        durationSec: r.duration_sec,
        prompt: r.prompt,
        thumbUrl: normalizeMediaUrl(r.thumb_url) ?? primaryImage ?? undefined,
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
        renderIds,
        status: r.status ?? undefined,
        progress: typeof r.progress === 'number' ? r.progress : undefined,
        heroRenderId: r.hero_render_id ?? undefined,
        localKey: r.local_key ?? undefined,
        message: r.message ?? undefined,
        etaSeconds: r.eta_seconds ?? undefined,
        etaLabel: r.eta_label ?? undefined,
        visibility: r.visibility ?? 'public',
        indexable: r.indexable ?? true,
      };
    });

    if (!mapped.length && !cursor) {
      const starterVideos = await listStarterPlaylistVideos(limit);
      if (starterVideos.length) {
        mapped = starterVideos.map((video) => ({
          jobId: video.id,
          engineLabel: video.engineLabel,
          durationSec: video.durationSec,
          prompt: video.prompt,
          thumbUrl: video.thumbUrl ?? undefined,
          videoUrl: video.videoUrl ?? undefined,
          createdAt: video.createdAt,
          engineId: video.engineId,
          aspectRatio: video.aspectRatio,
          hasAudio: video.hasAudio,
          canUpscale: video.canUpscale,
          previewFrame: video.thumbUrl ?? undefined,
          finalPriceCents: video.finalPriceCents ?? undefined,
          currency: video.currency ?? 'USD',
          pricingSnapshot: undefined,
          vendorAccountId: undefined,
          paymentStatus: 'curated',
          stripePaymentIntentId: undefined,
          stripeChargeId: undefined,
          batchId: undefined,
          groupId: undefined,
          iterationIndex: undefined,
          iterationCount: undefined,
          renderIds: undefined,
          heroRenderId: undefined,
          localKey: undefined,
          status: 'completed',
          progress: 100,
          message: undefined,
          etaSeconds: undefined,
          etaLabel: undefined,
          visibility: video.visibility,
          indexable: video.indexable,
          curated: true,
        }));
        return NextResponse.json({ ok: true, jobs: mapped, nextCursor: null });
      }
    }

    return NextResponse.json({ ok: true, jobs: mapped, nextCursor });
  } catch (error) {
    console.warn('[api/jobs] query failed', error);
    return NextResponse.json(
      { ok: false, jobs: [], nextCursor: null, error: 'Database unavailable' },
      { status: 503 }
    );
  }
}
