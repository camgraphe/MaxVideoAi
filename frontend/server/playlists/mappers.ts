import { normalizeMediaUrl } from '@/lib/media';
import {
  derivePlaylistRuntimeMeta,
  getPlaylistUsageTargets,
  isLockedPlaylistSlug,
} from './runtime-meta';
import type {
  PlaylistCandidateRecord,
  PlaylistItemRecord,
  PlaylistRecord,
} from './types';

export type PlaylistSummaryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  item_count: string;
  site_visible_count: string;
  with_video_asset_count: string;
  last_added_at: string | null;
};

export type CreatedPlaylistRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type PlaylistItemRow = {
  playlist_id: string;
  video_id: string;
  order_index: number;
  pinned: boolean;
  created_at: string;
  thumb_url: string | null;
  video_url: string | null;
  engine_label: string | null;
  aspect_ratio: string | null;
  prompt: string | null;
  duration_sec: number | null;
  visibility: string | null;
  indexable: boolean | null;
};

export type PlaylistCandidateRow = {
  job_id: string;
  engine_id: string | null;
  engine_label: string | null;
  prompt: string | null;
  created_at: string;
  thumb_url: string | null;
  video_url: string | null;
  aspect_ratio: string | null;
};

export function buildPlaylistRecord(params: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  siteVisibleCount: number;
  withVideoAssetCount: number;
  lastAddedAt: string | null;
}): PlaylistRecord {
  const runtimeMeta = derivePlaylistRuntimeMeta(params.slug, params.itemCount);

  return {
    id: params.id,
    slug: params.slug,
    name: params.name,
    description: params.description,
    isPublic: params.isPublic,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    itemCount: params.itemCount,
    siteVisibleCount: params.siteVisibleCount,
    withVideoAssetCount: params.withVideoAssetCount,
    lastAddedAt: params.lastAddedAt,
    kind: runtimeMeta.kind,
    isLocked: isLockedPlaylistSlug(params.slug),
    usageTargets: getPlaylistUsageTargets(params.slug),
    surfaceRole: runtimeMeta.surfaceRole,
    surfaceStatus: runtimeMeta.surfaceStatus,
    familyId: runtimeMeta.familyId,
    modelSlug: runtimeMeta.modelSlug,
    helperText: runtimeMeta.helperText,
    drivesRoute: runtimeMeta.drivesRoute,
    fallbackModelSlugs: runtimeMeta.fallbackModelSlugs,
  };
}

export function mapPlaylistRow(row: PlaylistSummaryRow): PlaylistRecord {
  return buildPlaylistRecord({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount: Number(row.item_count ?? '0'),
    siteVisibleCount: Number(row.site_visible_count ?? '0'),
    withVideoAssetCount: Number(row.with_video_asset_count ?? '0'),
    lastAddedAt: row.last_added_at ?? null,
  });
}

export function mapCreatedPlaylistRow(row: CreatedPlaylistRow): PlaylistRecord {
  return buildPlaylistRecord({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount: 0,
    siteVisibleCount: 0,
    withVideoAssetCount: 0,
    lastAddedAt: null,
  });
}

export function mapPlaylistItemRow(row: PlaylistItemRow): PlaylistItemRecord {
  const visibility = row.visibility === 'private' ? 'private' : 'public';
  const indexable = Boolean(row.indexable ?? true);
  return {
    playlistId: row.playlist_id,
    videoId: row.video_id,
    orderIndex: row.order_index,
    pinned: row.pinned,
    createdAt: row.created_at,
    thumbUrl: normalizeMediaUrl(row.thumb_url) ?? row.thumb_url ?? null,
    videoUrl: normalizeMediaUrl(row.video_url) ?? row.video_url ?? null,
    engineLabel: row.engine_label ?? null,
    aspectRatio: row.aspect_ratio ?? null,
    prompt: row.prompt ?? null,
    durationSec: row.duration_sec ?? null,
    visibility,
    indexable,
    isPublishedOnSite: visibility === 'public' && indexable,
  };
}

export function mapPlaylistCandidateRow(row: PlaylistCandidateRow): PlaylistCandidateRecord {
  return {
    id: row.job_id,
    engineId: row.engine_id ?? null,
    engineLabel: row.engine_label ?? null,
    prompt: row.prompt?.trim() || 'Untitled render',
    createdAt: row.created_at,
    thumbUrl: normalizeMediaUrl(row.thumb_url) ?? row.thumb_url ?? null,
    videoUrl: normalizeMediaUrl(row.video_url) ?? row.video_url ?? null,
    aspectRatio: row.aspect_ratio ?? null,
  };
}
