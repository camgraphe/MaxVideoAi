import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureBillingSchema } from '@/lib/schema';
import { listStarterPlaylistVideos } from '@/server/videos';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { shouldUseStarterFallback } from '@/lib/jobs-feed-policy';
import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders } from '@/lib/image-renders';
import { VISITOR_WORKSPACE_ENABLED } from '@/lib/visitor-access';
import { listVisitorImageLikeJobs, listVisitorStarterJobs } from '@/server/visitor-workspace';
import { deriveJobSurface, isImageLikeSurface, normalizeJobSurface } from '@/lib/job-surface';
import { applyOutputsToJobPayload, listJobOutputsByJobIds, upsertLegacyJobOutputs } from '@/server/media-library';
import { parseCursorParam, formatCursorValue } from './_lib/jobs-route-cursor';
import { IMAGE_ENGINE_ALIASES, buildSurfaceFilterClause } from './_lib/jobs-surface-filter';
import { expireStaleAudioJob, isStaleAudioJob } from './_lib/jobs-stale-audio';
import { refreshStaleFalJobs } from './_lib/jobs-fal-refresh';
import { APP_JOBS_SELECT, type JobRow, type JobsRouteParam } from './_lib/jobs-route-types';

export const dynamic = 'force-dynamic';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
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
    const params: JobsRouteParam[] = [userId];
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
          )
          AND COALESCE(surface, '') NOT IN ('storyboard')
          AND COALESCE(settings_snapshot->>'surface', '') NOT IN ('storyboard')
          AND job_id NOT LIKE 'storyboard_%'`
        );
      } else if (feedType === 'video') {
        conditions.push(
          `NOT (
            surface IN ('image', 'storyboard', 'character', 'angle', 'audio', 'upscale', 'background-removal')
            OR settings_snapshot->>'surface' IN ('image', 'storyboard', 'character-builder', 'angle', 'audio', 'upscale', 'background-removal')
            OR job_id LIKE 'tool_angle_%'
            OR job_id LIKE 'tool_upscale_%'
            OR job_id LIKE 'tool_background_removal_%'
            OR job_id LIKE 'storyboard_%'
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

    let rows = await query<JobRow>(
    `SELECT ${APP_JOBS_SELECT}
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
          `SELECT ${APP_JOBS_SELECT}
             FROM app_jobs
            WHERE job_id = ANY($1::text[])`,
          [expiredIds]
        );
        const refreshedMap = new Map(refreshedRows.map((row) => [row.job_id, row]));
        rows = rows.map((row) => refreshedMap.get(row.job_id) ?? row);
      }
    }

    rows = await refreshStaleFalJobs({ rows, shouldRefreshStaleFalJobs, userId });

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
