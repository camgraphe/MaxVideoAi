import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureBillingSchema } from '@/lib/schema';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { updateJobFromFalWebhook } from '@/server/fal-webhook-handler';
import { listStarterPlaylistVideos } from '@/server/videos';
import { getEngineAliases, listFalEngines } from '@/config/falEngines';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { shouldUseStarterFallback } from '@/lib/jobs-feed-policy';
import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders } from '@/lib/image-renders';
import { VISITOR_WORKSPACE_ENABLED } from '@/lib/visitor-access';
import { listVisitorImageLikeJobs, listVisitorStarterJobs } from '@/server/visitor-workspace';
import { deriveJobSurface, isImageLikeSurface, normalizeJobSurface } from '@/lib/job-surface';
import { applyOutputsToJobPayload, listJobOutputsByJobIds, upsertLegacyJobOutputs } from '@/server/media-library';

export const dynamic = 'force-dynamic';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

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

const STALE_AUDIO_JOB_TIMEOUT_MS = 10 * 60 * 1000;

function isStaleAudioJob(row: {
  job_id: string;
  updated_at: string;
  status: string | null;
  surface: string | null;
  settings_snapshot: unknown;
  engine_id: string;
  video_url: string | null;
  audio_url: string | null;
  render_ids: unknown;
}): boolean {
  const surface = deriveJobSurface({
    surface: row.surface,
    settingsSnapshot: row.settings_snapshot,
    jobId: row.job_id,
    engineId: row.engine_id,
    videoUrl: row.video_url,
    renderIds: row.render_ids,
  });
  if (surface !== 'audio') return false;
  if (row.video_url || row.audio_url) return false;
  const status = (row.status ?? '').trim().toLowerCase();
  if (!status || !['pending', 'running', 'queued'].includes(status)) return false;
  const updatedAt = new Date(row.updated_at);
  if (Number.isNaN(updatedAt.getTime())) return false;
  return Date.now() - updatedAt.getTime() > STALE_AUDIO_JOB_TIMEOUT_MS;
}

async function expireStaleAudioJob(
  row: {
    job_id: string;
    billing_product_key: string | null;
    pricing_snapshot: PricingSnapshot | null;
    currency: string | null;
    payment_status: string | null;
    final_price_cents: number | null;
  },
  userId: string
): Promise<void> {
  const refundAmountCents =
    typeof row.final_price_cents === 'number'
      ? row.final_price_cents
      : typeof row.pricing_snapshot?.totalCents === 'number'
        ? row.pricing_snapshot.totalCents
        : 0;
  const refundCurrency = row.currency ?? row.pricing_snapshot?.currency ?? 'USD';
  const refundSnapshot =
    row.pricing_snapshot ??
    ({
      currency: refundCurrency,
      totalCents: refundAmountCents,
      subtotalBeforeDiscountCents: refundAmountCents,
      base: {
        seconds: 0,
        rate: 0,
        unit: 'sec',
        amountCents: refundAmountCents,
      },
      addons: [],
      margin: {
        amountCents: 0,
      },
      membershipTier: 'member',
      meta: {
        surface: 'audio',
      },
    } satisfies PricingSnapshot);

  if (refundAmountCents > 0 && row.payment_status === 'paid_wallet') {
    const existingRefund = await query<{ present: number }>(
      `SELECT 1 AS present
         FROM app_receipts
        WHERE job_id = $1
          AND type = 'refund'
        LIMIT 1`,
      [row.job_id]
    );
    if (!existingRefund[0]) {
      await query(
        `INSERT INTO app_receipts (
           user_id,
           type,
           amount_cents,
           currency,
           description,
           job_id,
           surface,
           billing_product_key,
           pricing_snapshot,
           application_fee_cents,
           vendor_account_id
         )
         VALUES ($1, 'refund', $2, $3, $4, $5, 'audio', $6, $7::jsonb, 0, NULL)`,
        [
          userId,
          refundAmountCents,
          refundCurrency,
          'Refund stale audio render',
          row.job_id,
          row.billing_product_key ?? null,
          JSON.stringify(refundSnapshot),
        ]
      );
    }
  }

  await query(
    `UPDATE app_jobs
        SET status = 'failed',
            progress = 0,
            message = $1,
            payment_status = CASE
              WHEN payment_status = 'paid_wallet' THEN 'refunded_wallet'
              ELSE payment_status
            END,
            updated_at = NOW()
      WHERE job_id = $2`,
    ['Audio render timed out before completion.', row.job_id]
  );
}

const IMAGE_ENGINE_ALIASES = listFalEngines()
  .filter((engine) => (engine.category ?? 'video') === 'image')
  .flatMap((engine) => getEngineAliases(engine));

function buildSurfaceFilterClause(surface: 'video' | 'image' | 'character' | 'angle' | 'audio' | 'upscale', params: Array<string | number | Date | string[]>) {
  params.push(surface);
  const directIndex = params.length;

  if (surface === 'character') {
    return `(surface = $${directIndex} OR settings_snapshot->>'surface' = 'character-builder')`;
  }

  if (surface === 'angle') {
    return `(surface = $${directIndex} OR job_id LIKE 'tool_angle_%' OR settings_snapshot->>'surface' = 'angle')`;
  }

  if (surface === 'upscale') {
    return `(surface = $${directIndex} OR job_id LIKE 'tool_upscale_%' OR settings_snapshot->>'surface' = 'upscale')`;
  }

  if (surface === 'image') {
    params.push(IMAGE_ENGINE_ALIASES);
    const imageAliasIndex = params.length;
    return `(
      surface = $${directIndex}
      OR (
        (
          settings_snapshot->>'surface' = 'image'
          OR render_ids IS NOT NULL
          OR COALESCE(engine_id, '') = ANY($${imageAliasIndex}::text[])
        )
        AND COALESCE(surface, '') NOT IN ('character', 'angle', 'upscale')
        AND COALESCE(settings_snapshot->>'surface', '') NOT IN ('character-builder', 'angle', 'upscale', 'video')
        AND job_id NOT LIKE 'tool_angle_%'
        AND job_id NOT LIKE 'tool_upscale_%'
      )
    )`;
  }

  if (surface === 'video') {
    params.push(IMAGE_ENGINE_ALIASES);
    const imageAliasIndex = params.length;
    return `(
      (
        surface = $${directIndex}
        OR COALESCE(video_url, '') <> ''
        OR settings_snapshot->>'surface' = 'video'
      )
      AND NOT (
        COALESCE(surface, '') = 'audio'
        OR settings_snapshot->>'surface' IN ('image', 'character-builder', 'angle', 'audio', 'upscale')
        OR job_id LIKE 'tool_angle_%'
        OR job_id LIKE 'tool_upscale_%'
        OR render_ids IS NOT NULL
        OR COALESCE(engine_id, '') = ANY($${imageAliasIndex}::text[])
      )
    )`;
  }

  return `surface = $${directIndex}`;
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return json(
      { ok: false, jobs: [], nextCursor: null, error: 'Database unavailable' },
      { status: 503 }
    );
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[api/jobs] schema init failed', error);
    return json(
      { ok: false, jobs: [], nextCursor: null, error: 'Database unavailable' },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '24')));
  const cursor = url.searchParams.get('cursor');
  const typeParam = url.searchParams.get('type');
  const feedType = typeParam === 'image' || typeParam === 'video' ? typeParam : 'all';
  const requestedSurface = normalizeJobSurface(url.searchParams.get('surface'));
  const shouldRefreshStaleFalJobs =
    url.searchParams.get('refreshStale') === '1' || url.searchParams.get('refreshStale') === 'true';
  const { userId } = await getRouteAuthContext(req);

  if (!userId) {
    if (VISITOR_WORKSPACE_ENABLED) {
      if (feedType === 'image' || (requestedSurface && isImageLikeSurface(requestedSurface))) {
        const visitorSurface =
          requestedSurface === 'image' || requestedSurface === 'angle' || requestedSurface === 'character' || requestedSurface === 'upscale'
            ? requestedSurface
            : 'image';
        const jobs = await listVisitorImageLikeJobs(
          limit,
          visitorSurface
        );
        return json({ ok: true, jobs, nextCursor: null });
      }
      if (shouldUseStarterFallback(feedType, cursor)) {
        const jobs = await listVisitorStarterJobs(limit);
        return json({ ok: true, jobs, nextCursor: null });
      }
      return json({ ok: true, jobs: [], nextCursor: null });
    }
    return json({ ok: false, jobs: [], nextCursor: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params: Array<string | number | Date | string[]> = [userId];
    const baseFailureClause =
      "NOT (LOWER(status) IN ('failed','error','errored','cancelled','canceled') AND updated_at < NOW() - INTERVAL '150 seconds')";
    const conditions: string[] = ['user_id = $1', 'hidden IS NOT TRUE'];
    if (feedType === 'image' || feedType === 'all') {
      conditions.push(`(${baseFailureClause} OR render_ids IS NOT NULL)`);
    } else {
      conditions.push(baseFailureClause);
    }

    if (requestedSurface) {
      conditions.push(buildSurfaceFilterClause(requestedSurface, params));
    } else if (IMAGE_ENGINE_ALIASES.length && feedType !== 'all') {
      params.push(IMAGE_ENGINE_ALIASES);
      const aliasIdx = params.length;
      const aliasClause = `COALESCE(engine_id, '') = ANY($${aliasIdx}::text[])`;
      const heuristicClause = `((COALESCE(engine_id, '') = '' OR engine_id IS NULL) AND (render_ids IS NOT NULL OR (video_url IS NULL AND hero_render_id IS NOT NULL)))`;
      if (feedType === 'image') {
        conditions.push(
          `(
            surface IN ('image', 'character', 'angle', 'upscale')
            OR settings_snapshot->>'surface' IN ('image', 'character-builder', 'angle', 'upscale')
            OR job_id LIKE 'tool_angle_%'
            OR job_id LIKE 'tool_upscale_%'
            OR ${aliasClause}
            OR ${heuristicClause}
          )`
        );
      } else if (feedType === 'video') {
        conditions.push(
          `NOT (
            surface IN ('image', 'character', 'angle', 'audio', 'upscale')
            OR settings_snapshot->>'surface' IN ('image', 'character-builder', 'angle', 'audio', 'upscale')
            OR job_id LIKE 'tool_angle_%'
            OR job_id LIKE 'tool_upscale_%'
            OR ${aliasClause}
            OR ${heuristicClause}
          )`
        );
      }
    }

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
      user_id: string | null;
      updated_at: string;
      surface: string | null;
      billing_product_key: string | null;
      settings_snapshot: unknown;
      engine_id: string;
      engine_label: string;
      duration_sec: number;
      prompt: string;
      thumb_url: string;
      video_url: string | null;
      preview_video_url: string | null;
      audio_url: string | null;
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
      provider: string | null;
      provider_job_id: string | null;
    };

    let rows = await query<JobRow>(
    `SELECT id, job_id, user_id, updated_at, surface, billing_product_key, settings_snapshot, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url, preview_video_url, audio_url, created_at, aspect_ratio, has_audio, can_upscale, preview_frame, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, visibility, indexable, status, progress, provider, provider_job_id
      FROM app_jobs
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${limitParamIndex}`,
      params
    );

    const staleAudioJobs = rows.filter((row) => isStaleAudioJob(row));

    if (staleAudioJobs.length) {
      console.info('[api/jobs] expiring stale audio jobs', {
        at: new Date().toISOString(),
        userId,
        count: staleAudioJobs.length,
        samples: staleAudioJobs.slice(0, 5).map((job) => ({
          jobId: job.job_id,
          status: job.status,
          updatedAt: job.updated_at,
        })),
      });
      const expiredIds: string[] = [];
      for (const jobRow of staleAudioJobs) {
        try {
          await expireStaleAudioJob(jobRow, userId);
          expiredIds.push(jobRow.job_id);
        } catch (error) {
          console.warn('[api/jobs] failed to expire stale audio job', jobRow.job_id, error);
        }
      }
      if (expiredIds.length) {
        const refreshedRows = await query<JobRow>(
          `SELECT id, job_id, user_id, updated_at, surface, billing_product_key, settings_snapshot, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url, preview_video_url, audio_url, created_at, aspect_ratio, has_audio, can_upscale, preview_frame, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, visibility, indexable, status, progress, provider, provider_job_id
             FROM app_jobs
            WHERE job_id = ANY($1::text[])`,
          [expiredIds]
        );
        const refreshedMap = new Map(refreshedRows.map((row) => [row.job_id, row]));
        rows = rows.map((row) => refreshedMap.get(row.job_id) ?? row);
      }
    }

    const staleJobs = shouldRefreshStaleFalJobs
      ? rows.filter((row) => {
          const surface = deriveJobSurface({
            surface: row.surface,
            settingsSnapshot: row.settings_snapshot,
            jobId: row.job_id,
            engineId: row.engine_id,
            videoUrl: row.video_url,
            renderIds: row.render_ids,
          });
          if (surface !== 'video') {
            return false;
          }
          if (!row.provider_job_id) return false;
          if ((row.provider ?? 'fal') !== 'fal') return false;
          const status = (row.status ?? '').toLowerCase();
          if (status === 'failed' || status === 'cancelled' || status === 'canceled' || status === 'error') return false;
          const missingVideo = !row.video_url;
          const missingThumb = !row.thumb_url;
          if (!missingVideo && status === 'completed') return false;
          return missingVideo || missingThumb;
        })
      : [];

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
        const markJobFailed = async (
          reason: string,
          options: { autoRefundEligible?: boolean; failureOrigin?: 'provider_terminal' | 'stale_refresh_internal' } = {}
        ) => {
          const autoRefundEligible = options.autoRefundEligible === true;
          console.warn('[api/jobs] marking job as failed after stale refresh', {
            at: new Date().toISOString(),
            jobId: jobRow.job_id,
            providerJobId: jobRow.provider_job_id,
            reason,
            autoRefundEligible,
            failureOrigin: options.failureOrigin ?? 'stale_refresh_internal',
          });
          try {
            await updateJobFromFalWebhook({
              request_id: jobRow.provider_job_id ?? undefined,
              status: 'failed',
              response: { error: reason, status: 'failed' },
              result: { error: reason, status: 'failed' },
              auto_refund_eligible: autoRefundEligible,
              failure_origin: options.failureOrigin ?? 'stale_refresh_internal',
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
            await markJobFailed(providerError ?? 'Fal reported this job as failed.', {
              autoRefundEligible: true,
              failureOrigin: 'provider_terminal',
            });
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
          `SELECT id, job_id, user_id, updated_at, surface, billing_product_key, settings_snapshot, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url, preview_video_url, audio_url, created_at, aspect_ratio, has_audio, can_upscale, preview_frame, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, visibility, indexable, status, progress, provider, provider_job_id
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
    let mapped = items.map((r: Row) => {
      const parsedRenders = parseStoredImageRenders(r.render_ids);
      const renderIds = extractRenderIds(parsedRenders.entries);
      const renderThumbUrls = extractRenderThumbUrls(parsedRenders);
      const primaryImage = renderIds?.[0] ? normalizeMediaUrl(renderIds[0]) ?? renderIds[0] : undefined;
      const primaryThumb = renderThumbUrls?.[0] ? normalizeMediaUrl(renderThumbUrls[0]) ?? renderThumbUrls[0] : undefined;
      const surface = deriveJobSurface({
        surface: r.surface,
        settingsSnapshot: r.settings_snapshot,
        jobId: r.job_id,
        engineId: r.engine_id,
        videoUrl: r.video_url,
        renderIds: r.render_ids,
      });
      return {
        jobId: r.job_id,
        surface,
        billingProductKey: r.billing_product_key ?? undefined,
        settingsSnapshot: r.settings_snapshot ?? undefined,
        engineLabel: r.engine_label,
        durationSec: r.duration_sec,
        prompt: r.prompt,
        thumbUrl: normalizeMediaUrl(r.thumb_url) ?? primaryThumb ?? primaryImage ?? undefined,
        videoUrl: normalizeMediaUrl(r.video_url) ?? undefined,
        previewVideoUrl: normalizeMediaUrl(r.preview_video_url) ?? undefined,
        audioUrl: normalizeMediaUrl(r.audio_url) ?? undefined,
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
        renderThumbUrls,
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

    if (mapped.length) {
      try {
        const jobIds = mapped.map((job) => job.jobId);
        let outputMap = await listJobOutputsByJobIds(jobIds);
        const missingOutputRows = items.filter((row) => !outputMap.has(row.job_id));
        if (missingOutputRows.length) {
          await Promise.all(
            missingOutputRows.map((row) =>
              upsertLegacyJobOutputs({
                job_id: row.job_id,
                user_id: row.user_id,
                surface: row.surface,
                video_url: row.video_url,
                audio_url: row.audio_url,
                thumb_url: row.thumb_url,
                preview_frame: row.preview_frame,
                preview_video_url: row.preview_video_url,
                render_ids: row.render_ids,
                duration_sec: row.duration_sec,
                status: row.status,
              }).catch((error) => {
                console.warn('[api/jobs] failed to backfill media outputs', row.job_id, error);
              })
            )
          );
          outputMap = await listJobOutputsByJobIds(jobIds);
        }
        mapped = mapped.map((job) => applyOutputsToJobPayload(job, outputMap.get(job.jobId)));
      } catch (error) {
        console.warn('[api/jobs] media output enrichment failed', error);
      }
    }

    if (!mapped.length && shouldUseStarterFallback(feedType, cursor)) {
      const starterVideos = await listStarterPlaylistVideos(limit);
      if (starterVideos.length) {
        mapped = starterVideos.map((video) => ({
          jobId: video.id,
          surface: 'video' as const,
          billingProductKey: undefined,
          settingsSnapshot: undefined,
          engineLabel: video.engineLabel,
          durationSec: video.durationSec,
          prompt: video.prompt,
          thumbUrl: video.thumbUrl ?? undefined,
          videoUrl: video.videoUrl ?? undefined,
          previewVideoUrl: video.previewVideoUrl ?? undefined,
          audioUrl: undefined,
          createdAt: video.createdAt,
          engineId: video.engineId,
          aspectRatio: video.aspectRatio,
          hasAudio: video.hasAudio,
          canUpscale: video.canUpscale,
          previewFrame: video.thumbUrl ?? undefined,
          finalPriceCents: video.finalPriceCents ?? undefined,
          currency: video.currency ?? 'USD',
          pricingSnapshot: video.pricingSnapshot,
          vendorAccountId: undefined,
          paymentStatus: 'curated',
          stripePaymentIntentId: undefined,
          stripeChargeId: undefined,
          batchId: undefined,
          groupId: undefined,
          iterationIndex: undefined,
          iterationCount: undefined,
          renderIds: undefined,
          renderThumbUrls: undefined,
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
        return json({ ok: true, jobs: mapped, nextCursor: null });
      }
    }

    return json({ ok: true, jobs: mapped, nextCursor });
  } catch (error) {
    console.warn('[api/jobs] query failed', error);
    return json(
      { ok: false, jobs: [], nextCursor: null, error: 'Database unavailable' },
      { status: 503 }
    );
  }
}
