import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { listStarterPlaylistVideos } from '@/server/videos';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { shouldUseStarterFallback } from '@/lib/jobs-feed-policy';
import { VISITOR_WORKSPACE_ENABLED } from '@/lib/visitor-access';
import { listVisitorImageLikeJobs, listVisitorStarterJobs } from '@/server/visitor-workspace';
import { isImageLikeSurface, normalizeJobSurface } from '@/lib/job-surface';
import { applyOutputsToJobPayload, listJobOutputsByJobIds, upsertLegacyJobOutputs } from '@/server/media-library';
import {
  formatRecentGenerationCursor,
  mapRecentGenerationRecordToWeb,
  readOwnedGenerationRecordsByIds,
  readRecentGenerationRecordsForWeb,
} from '@/server/generations/recent-generations';
import { expireStaleAudioJob, isStaleAudioJob } from './_lib/jobs-stale-audio';
import { refreshStaleFalJobs } from './_lib/jobs-fal-refresh';

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
  const requestedLimit = Number(url.searchParams.get('limit') ?? '24');
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
    : 24;
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
    let rows = await readRecentGenerationRecordsForWeb({
      userId,
      feedType,
      requestedSurface,
      cursor,
      limit,
    });

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
        const refreshedRows = await readOwnedGenerationRecordsByIds({ userId, jobIds: expiredIds });
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

    const nextCursor = hasMore && items.length ? formatRecentGenerationCursor(items[items.length - 1]) : null;
    let mapped = items.map(mapRecentGenerationRecordToWeb);

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
