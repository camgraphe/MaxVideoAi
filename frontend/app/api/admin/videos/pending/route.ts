import { NextResponse, type NextRequest } from 'next/server';
import { getEngineAliases, listFalEngines } from '@/config/falEngines';
import { isDatabaseConfigured, query } from '@/lib/db';
import { requireAdmin, adminErrorToResponse } from '@/server/admin';
import { normalizeMediaUrl } from '@/lib/media';
import { getSeoWatchStates } from '@/server/video-seo';
import type { JobSurface } from '@/types/billing';

type PendingVideoRow = {
  job_id: string;
  user_id: string | null;
  status: string | null;
  message: string | null;
  updated_at: string;
  engine_id: string;
  engine_label: string;
  duration_sec: number;
  prompt: string;
  thumb_url: string;
  video_url: string | null;
  aspect_ratio: string | null;
  created_at: string;
  visibility: string | null;
  indexable: boolean | null;
  featured: boolean | null;
  surface: string | null;
};

type PlaylistAssignmentRow = {
  video_id: string;
  playlist_id: string;
  playlist_name: string;
};

type ModerationBucket = 'not-published' | 'published' | 'all';
type PublicationState = 'published' | 'private' | 'legacy-mismatch';
type ModerationSurface = JobSurface;

const FAILURE_STATES = ['failed', 'error', 'errored', 'cancelled', 'canceled', 'aborted'];
const IMAGE_ENGINE_ALIASES = listFalEngines()
  .filter((engine) => (engine.category ?? 'video') === 'image')
  .flatMap((engine) => getEngineAliases(engine));

function parseBucket(value: string | null): ModerationBucket {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'needs-review':
    case 'not-published':
    case 'private':
      return 'not-published';
    case 'public':
    case 'published':
      return 'published';
    case 'all':
      return 'all';
    default:
      return 'not-published';
  }
}

function parseSurface(value: string | null): ModerationSurface {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'image':
      return 'image';
    case 'audio':
      return 'audio';
    case 'character':
      return 'character';
    case 'angle':
      return 'angle';
    default:
      return 'video';
  }
}

function buildSurfaceFilterClause(surface: ModerationSurface, params: Array<string | string[]>) {
  params.push(surface);
  const directIndex = params.length;

  if (surface === 'character') {
    return `(surface = $${directIndex} OR settings_snapshot->>'surface' = 'character-builder')`;
  }

  if (surface === 'angle') {
    return `(surface = $${directIndex} OR job_id LIKE 'tool_angle_%' OR settings_snapshot->>'surface' = 'angle')`;
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
        AND COALESCE(surface, '') NOT IN ('character', 'angle')
        AND COALESCE(settings_snapshot->>'surface', '') NOT IN ('character-builder', 'angle', 'video')
        AND job_id NOT LIKE 'tool_angle_%'
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
        OR settings_snapshot->>'surface' IN ('image', 'character-builder', 'angle', 'audio')
        OR job_id LIKE 'tool_angle_%'
        OR render_ids IS NOT NULL
        OR COALESCE(engine_id, '') = ANY($${imageAliasIndex}::text[])
      )
    )`;
  }

  return `surface = $${directIndex}`;
}

function buildWhereClause(bucket: ModerationBucket, surface: ModerationSurface): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses = [`COALESCE(hidden, FALSE) = FALSE`, buildSurfaceFilterClause(surface, params as Array<string | string[]>)];
  let failedSql: string | null = null;
  const requireFailureStates = () => {
    if (failedSql) {
      return failedSql;
    }
    params.push(FAILURE_STATES);
    failedSql = `LOWER(COALESCE(status, '')) = ANY($${params.length}::text[])`;
    return failedSql;
  };
  clauses.push(`NOT (${requireFailureStates()})`);

  if (bucket === 'published') {
    clauses.push(`COALESCE(visibility, 'public') = 'public'`);
    clauses.push(`COALESCE(indexable, TRUE) = TRUE`);
  } else if (bucket === 'not-published') {
    clauses.push(`(COALESCE(visibility, 'public') <> 'public' OR COALESCE(indexable, TRUE) = FALSE)`);
  }

  return { sql: clauses.join(' AND '), params };
}

function resolvePublicationState(row: PendingVideoRow): PublicationState {
  const visibility = row.visibility === 'private' ? 'private' : 'public';
  const indexable = row.indexable ?? true;
  if (visibility === 'public' && indexable) {
    return 'published';
  }
  if (visibility === 'private' && !indexable) {
    return 'private';
  }
  return 'legacy-mismatch';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get('limit') ?? '30');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;
  const bucket = parseBucket(url.searchParams.get('bucket'));
  const surface = parseSurface(url.searchParams.get('surface'));
  const cursorParam = url.searchParams.get('cursor');
  let cursor: { createdAt: string; jobId: string } | null = null;
  if (cursorParam) {
    const [createdAt, jobId] = cursorParam.split('|');
    if (createdAt && jobId) {
      cursor = { createdAt, jobId };
    }
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  try {
    const where = buildWhereClause(bucket, surface);
    const params: unknown[] = [...where.params];
    const clauses = [where.sql];
    if (cursor) {
      const createdIndex = params.length + 1;
      params.push(cursor.createdAt);
      const jobIndex = params.length + 1;
      params.push(cursor.jobId);
      clauses.push(`(created_at < $${createdIndex} OR (created_at = $${createdIndex} AND job_id < $${jobIndex}))`);
    }
    const limitIndex = params.length + 1;
    params.push(limit + 1);

    const rows = await query<PendingVideoRow>(
      `
        SELECT job_id, user_id, status, message, updated_at, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url,
               aspect_ratio, created_at, visibility, indexable, featured, surface
        FROM app_jobs
        WHERE ${clauses.join(' AND ')}
        ORDER BY created_at DESC, job_id DESC
        LIMIT $${limitIndex}
      `,
      params
    );

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const videoIds = slice.map((row) => row.job_id);
    const assignmentRows = videoIds.length
      ? await query<PlaylistAssignmentRow>(
          `
            SELECT pi.video_id, p.id AS playlist_id, p.name AS playlist_name
            FROM playlist_items pi
            JOIN playlists p ON p.id = pi.playlist_id
            WHERE pi.video_id = ANY($1::text[])
            ORDER BY p.updated_at DESC, p.name ASC
          `,
          [videoIds]
        )
      : [];
    const seoWatchStates = await getSeoWatchStates(videoIds);
    const assignmentsByVideo = assignmentRows.reduce<Record<string, Array<{ id: string; name: string }>>>((acc, row) => {
      if (!acc[row.video_id]) {
        acc[row.video_id] = [];
      }
      acc[row.video_id].push({ id: row.playlist_id, name: row.playlist_name });
      return acc;
    }, {});

    const videos = slice.map((row) => {
      const visibility = row.visibility === 'private' ? 'private' : 'public';
      const indexable = row.indexable ?? true;
      const publicationState = resolvePublicationState(row);
      return {
        id: row.job_id,
        userId: row.user_id ?? null,
        status: row.status ?? null,
        message: row.message ?? undefined,
        updatedAt: row.updated_at,
        engineId: row.engine_id,
        engineLabel: row.engine_label,
        durationSec: row.duration_sec,
        prompt: row.prompt,
        thumbUrl: normalizeMediaUrl(row.thumb_url) ?? undefined,
        videoUrl: row.video_url ? normalizeMediaUrl(row.video_url) ?? undefined : undefined,
        aspectRatio: row.aspect_ratio ?? undefined,
        createdAt: row.created_at,
        visibility,
        indexable,
        featured: row.featured ?? false,
        assignedPlaylists: assignmentsByVideo[row.job_id] ?? [],
        seoWatch: seoWatchStates.get(row.job_id) ?? false,
        publicationState,
        isPublishedOnSite: publicationState === 'published',
        hasLegacyMismatch: publicationState === 'legacy-mismatch',
      };
    });
    const nextCursor = hasMore
      ? (() => {
          const last = slice[slice.length - 1];
          if (!last) return null;
          try {
            const iso = new Date(last.created_at).toISOString();
            return `${iso}|${last.job_id}`;
          } catch {
            return null;
          }
        })()
      : null;

    return NextResponse.json({ ok: true, videos, nextCursor, bucket, surface });
  } catch (error) {
    console.error('[admin/videos/pending] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
