import { NextResponse, type NextRequest } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { requireAdmin, adminErrorToResponse } from '@/server/admin';
import { normalizeMediaUrl } from '@/lib/media';

type PendingVideoRow = {
  job_id: string;
  user_id: string | null;
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
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get('limit') ?? '30');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;
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
    await ensureBillingSchema();
    const params: unknown[] = [];
    let whereClause = `WHERE visibility = 'public'`;
    if (cursor) {
      const createdIndex = params.length + 1;
      params.push(cursor.createdAt);
      const jobIndex = params.length + 1;
      params.push(cursor.jobId);
      whereClause += ` AND (created_at < $${createdIndex} OR (created_at = $${createdIndex} AND job_id < $${jobIndex}))`;
    }
    const limitIndex = params.length + 1;
    params.push(limit + 1);

    const rows = await query<PendingVideoRow>(
      `
        SELECT job_id, user_id, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url,
               aspect_ratio, created_at, visibility, indexable, featured
        FROM app_jobs
        ${whereClause}
        ORDER BY created_at DESC, job_id DESC
        LIMIT $${limitIndex}
      `,
      params
    );

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const videos = slice.map((row) => ({
      id: row.job_id,
      userId: row.user_id ?? null,
      engineId: row.engine_id,
      engineLabel: row.engine_label,
      durationSec: row.duration_sec,
      prompt: row.prompt,
      thumbUrl: normalizeMediaUrl(row.thumb_url) ?? undefined,
      videoUrl: row.video_url ? normalizeMediaUrl(row.video_url) ?? undefined : undefined,
      aspectRatio: row.aspect_ratio ?? undefined,
      createdAt: row.created_at,
      visibility: row.visibility ?? 'public',
      indexable: row.indexable ?? true,
      featured: row.featured ?? false,
    }));
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

    return NextResponse.json({ ok: true, videos, nextCursor });
  } catch (error) {
    console.error('[admin/videos/pending] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
