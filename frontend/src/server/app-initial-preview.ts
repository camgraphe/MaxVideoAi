import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { shouldUseStarterFallback } from '@/lib/jobs-feed-policy';
import { listStarterPlaylistVideos } from '@/server/videos';
import type { ResultProvider, VideoGroup, VideoItem } from '@/types/video-groups';

type InitialPreview = {
  id: string;
  videoUrl: string | null;
  previewVideoUrl: string | null;
  thumbUrl: string | null;
  aspectRatio: string | null;
  engineId: string | null;
  engineLabel: string | null;
  durationSec: number | null;
  createdAt: string | null;
};

type InitialPreviewRow = {
  job_id: string;
  engine_id: string | null;
  engine_label: string | null;
  duration_sec: number | null;
  thumb_url: string | null;
  video_url: string | null;
  preview_video_url: string | null;
  aspect_ratio: string | null;
  created_at: string | null;
};

function toVideoAspect(value?: string | null): VideoItem['aspect'] {
  switch (value) {
    case '9:16':
      return '9:16';
    case '1:1':
      return '1:1';
    default:
      return '16:9';
  }
}

function mapInitialPreviewToGroup(preview: InitialPreview, provider: ResultProvider = 'fal'): VideoGroup | null {
  const videoUrl = normalizeMediaUrl(preview.videoUrl) ?? null;
  const thumbUrl = normalizeMediaUrl(preview.thumbUrl) ?? null;
  const previewVideoUrl = normalizeMediaUrl(preview.previewVideoUrl) ?? undefined;
  const url = videoUrl ?? thumbUrl;
  if (!url) return null;

  const item: VideoItem = {
    id: preview.id,
    url,
    previewUrl: previewVideoUrl,
    aspect: toVideoAspect(preview.aspectRatio),
    thumb: thumbUrl ?? undefined,
    jobId: preview.id,
    durationSec: preview.durationSec ?? undefined,
    engineId: preview.engineId ?? undefined,
    meta: {
      mediaType: videoUrl ? 'video' : 'image',
      engineLabel: preview.engineLabel ?? undefined,
    },
  };

  return {
    id: `initial-${preview.id}`,
    items: [item],
    layout: 'x1',
    createdAt: preview.createdAt ?? new Date().toISOString(),
    provider,
    status: 'ready',
    heroItemId: item.id,
    meta: {
      source: 'initial-preview',
    },
  };
}

async function resolveUserInitialPreview(userId: string): Promise<InitialPreview | null> {
  const rows = await query<InitialPreviewRow>(
    `SELECT job_id, engine_id, engine_label, duration_sec, thumb_url, video_url, preview_video_url, aspect_ratio, created_at
       FROM app_jobs
      WHERE user_id = $1
        AND hidden IS NOT TRUE
        AND NOT (LOWER(status) IN ('failed','error','errored','cancelled','canceled') AND updated_at < NOW() - INTERVAL '150 seconds')
        AND NOT (
          surface IN ('image', 'character', 'angle', 'audio', 'upscale')
          OR settings_snapshot->>'surface' IN ('image', 'character-builder', 'angle', 'audio', 'upscale')
          OR job_id LIKE 'tool_angle_%'
          OR job_id LIKE 'tool_upscale_%'
          OR render_ids IS NOT NULL
          OR (video_url IS NULL AND hero_render_id IS NOT NULL)
        )
        AND (video_url IS NOT NULL OR thumb_url IS NOT NULL)
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.job_id,
    videoUrl: row.video_url,
    previewVideoUrl: row.preview_video_url,
    thumbUrl: row.thumb_url,
    aspectRatio: row.aspect_ratio,
    engineId: row.engine_id,
    engineLabel: row.engine_label,
    durationSec: row.duration_sec,
    createdAt: row.created_at,
  };
}

async function resolveStarterInitialPreview(): Promise<InitialPreview | null> {
  if (!shouldUseStarterFallback('video', null)) return null;
  const videos = await listStarterPlaylistVideos(1);
  const video = videos[0];
  if (!video) return null;
  return {
    id: video.id,
    videoUrl: video.videoUrl ?? null,
    previewVideoUrl: video.previewVideoUrl ?? null,
    thumbUrl: video.thumbUrl ?? null,
    aspectRatio: video.aspectRatio ?? null,
    engineId: video.engineId ?? null,
    engineLabel: video.engineLabel ?? null,
    durationSec: video.durationSec ?? null,
    createdAt: video.createdAt ?? null,
  };
}

export async function resolveInitialAppPreviewGroup(): Promise<VideoGroup | null> {
  try {
    const { userId } = await getRouteAuthContext();
    const preview = userId ? await resolveUserInitialPreview(userId) : await resolveStarterInitialPreview();
    return preview ? mapInitialPreviewToGroup(preview) : null;
  } catch (error) {
    console.warn('[app] failed to resolve initial preview', error);
    return null;
  }
}
