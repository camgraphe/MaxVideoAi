import type { WorkspaceAssetRecord, WorkspaceNodeKind } from './workspace-types';

export type WorkspaceLibraryAsset = {
  id: string;
  name: string;
  meta: string;
  kind: 'image' | 'video' | 'audio' | 'text';
  thumbUrl?: string;
  url?: string;
  durationSec?: number;
  dimensions?: string;
};

export type WorkspaceLibraryKind = 'image' | 'video' | 'audio';
export type WorkspaceLibrarySource = 'all' | 'upload' | 'generated' | 'storyboard' | 'character' | 'angle' | 'upscale';

export const WORKSPACE_DEMO_AUDIO_URL =
  'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

export const WORKSPACE_LIBRARY_SOURCE_OPTIONS = [
  'all',
  'upload',
  'generated',
  'storyboard',
  'character',
  'angle',
  'upscale',
] as const satisfies readonly WorkspaceLibrarySource[];

export const WORKSPACE_LIBRARY_SOURCE_LABELS = {
  all: 'All',
  upload: 'Uploaded',
  generated: 'Generated',
  storyboard: 'Storyboard',
  character: 'Character',
  angle: 'Angle',
  upscale: 'Upscale',
} as const satisfies Record<WorkspaceLibrarySource, string>;

export const WORKSPACE_LIBRARY_ASSETS: WorkspaceLibraryAsset[] = [
  {
    id: 'chrono-watch',
    name: 'chrono_watch.png',
    meta: 'Image · 2048x2048',
    kind: 'image',
    thumbUrl: '/storyboard/examples/storyboarder-product-reference.jpg',
    url: '/storyboard/examples/storyboarder-product-reference.jpg',
    dimensions: '2048x2048',
  },
  {
    id: 'turntable',
    name: 'product_turntable.mp4',
    meta: 'Video · 12s',
    kind: 'video',
    thumbUrl: '/hero/kling-3-4k-demo.jpg',
    url: '/hero/pika-22.mp4',
    durationSec: 12,
  },
  {
    id: 'ambient',
    name: 'ambient_moody.mp3',
    meta: 'Audio · 28s',
    kind: 'audio',
    url: WORKSPACE_DEMO_AUDIO_URL,
    durationSec: 28,
  },
  {
    id: 'premium-style',
    name: 'premium_style.txt',
    meta: 'Text prompt',
    kind: 'text',
  },
];

const NODE_KIND_TO_ASSET_KIND: Partial<Record<WorkspaceNodeKind, WorkspaceLibraryKind>> = {
  'asset-image': 'image',
  'asset-video': 'video',
  'asset-audio': 'audio',
};

const NODE_KIND_TO_UPLOAD_ENDPOINT: Partial<Record<WorkspaceNodeKind, string>> = {
  'asset-image': '/api/uploads/image',
  'asset-video': '/api/uploads/video',
  'asset-audio': '/api/uploads/audio',
};

const NODE_KIND_TO_UPLOAD_ACCEPT: Partial<Record<WorkspaceNodeKind, string>> = {
  'asset-image': 'image/*',
  'asset-video': 'video/*',
  'asset-audio': 'audio/*',
};

function fileNameFromUrl(url: string, fallback: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').filter(Boolean).pop();
    return filename ? decodeURIComponent(filename) : fallback;
  } catch {
    const filename = url.split('/').filter(Boolean).pop();
    return filename ? decodeURIComponent(filename.split('?')[0] ?? filename) : fallback;
  }
}

function metaForUserAsset(asset: {
  kind?: string | null;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  source?: string | null;
}): string {
  const kind = asset.kind === 'video' || asset.mime?.startsWith('video/')
    ? 'Video'
    : asset.kind === 'audio' || asset.mime?.startsWith('audio/')
      ? 'Audio'
      : 'Image';
  if (asset.width && asset.height) return `${kind} · ${asset.width}x${asset.height}`;
  if (asset.source) return `${kind} · ${asset.source}`;
  return kind;
}

function resolveUserAssetKind(asset: { kind?: unknown; mime?: string | null }): WorkspaceLibraryKind {
  if (asset.kind === 'video' || asset.mime?.startsWith('video/')) return 'video';
  if (asset.kind === 'audio' || asset.mime?.startsWith('audio/')) return 'audio';
  return 'image';
}

export function workspaceLibraryKindForNodeKind(kind: WorkspaceNodeKind): WorkspaceLibraryKind | null {
  return NODE_KIND_TO_ASSET_KIND[kind] ?? null;
}

export function workspaceUploadEndpointForNodeKind(kind: WorkspaceNodeKind): string | null {
  return NODE_KIND_TO_UPLOAD_ENDPOINT[kind] ?? null;
}

export function workspaceUploadAcceptForNodeKind(kind: WorkspaceNodeKind): string | undefined {
  return NODE_KIND_TO_UPLOAD_ACCEPT[kind];
}

export function workspaceLibrarySourceOptionsForKind(kind: WorkspaceLibraryKind | null): readonly WorkspaceLibrarySource[] {
  if (kind === 'audio') return ['all', 'upload', 'generated'];
  if (kind === 'video') return ['all', 'upload', 'generated', 'upscale'];
  return WORKSPACE_LIBRARY_SOURCE_OPTIONS;
}

export function buildWorkspaceUserLibraryUrl(kind: WorkspaceLibraryKind | null, source: WorkspaceLibrarySource = 'all'): string {
  const params = new URLSearchParams({ limit: '60' });
  if (kind) params.set('kind', kind);
  if (source !== 'all') params.set('source', source);
  return `/api/media-library/assets?${params.toString()}`;
}

export function workspaceLibraryAssetFromUploadedAsset(
  item: unknown,
  kind: WorkspaceLibraryKind | null
): WorkspaceLibraryAsset | null {
  const asset = item as {
    id?: unknown;
    url?: unknown;
    thumbUrl?: unknown;
    previewUrl?: unknown;
    kind?: unknown;
    mime?: unknown;
    width?: unknown;
    height?: unknown;
    durationSec?: unknown;
    duration?: unknown;
    source?: unknown;
  };
  const url = typeof asset.url === 'string' ? asset.url : '';
  if (!url) return null;
  const mime = typeof asset.mime === 'string' ? asset.mime : null;
  const resolvedKind = resolveUserAssetKind({ kind: asset.kind, mime });
  if (kind && resolvedKind !== kind) return null;
  const width = typeof asset.width === 'number' ? asset.width : null;
  const height = typeof asset.height === 'number' ? asset.height : null;
  const durationSec =
    typeof asset.durationSec === 'number'
      ? asset.durationSec
      : typeof asset.duration === 'number'
        ? asset.duration
        : undefined;
  return {
    id: typeof asset.id === 'string' ? asset.id : url,
    name: fileNameFromUrl(url, resolvedKind === 'video' ? 'Video asset' : resolvedKind === 'audio' ? 'Audio asset' : 'Image asset'),
    meta: metaForUserAsset({
      kind: resolvedKind,
      mime,
      width,
      height,
      source: typeof asset.source === 'string' ? asset.source : null,
    }),
    kind: resolvedKind,
    thumbUrl: typeof asset.thumbUrl === 'string' ? asset.thumbUrl : typeof asset.previewUrl === 'string' ? asset.previewUrl : undefined,
    url,
    durationSec,
    dimensions: width && height ? `${width}x${height}` : undefined,
  };
}

export function normalizeWorkspaceUserLibraryPayload(
  payload: unknown,
  kind: WorkspaceLibraryKind | null
): WorkspaceLibraryAsset[] {
  const record = payload && typeof payload === 'object' ? (payload as { assets?: unknown }) : {};
  if (!Array.isArray(record.assets)) return [];
  return record.assets
    .map((item) => workspaceLibraryAssetFromUploadedAsset(item, kind))
    .filter((asset): asset is WorkspaceLibraryAsset => Boolean(asset));
}

export function workspaceLibraryAssetsForNodeKind(kind: WorkspaceNodeKind): WorkspaceLibraryAsset[] {
  const assetKind = workspaceLibraryKindForNodeKind(kind);
  if (!assetKind) return [];
  return WORKSPACE_LIBRARY_ASSETS.filter((asset) => asset.kind === assetKind);
}

export function workspaceAssetRecordFromLibraryAsset(asset: WorkspaceLibraryAsset): WorkspaceAssetRecord {
  return {
    id: asset.id,
    kind: asset.kind,
    filename: asset.name,
    subtitle: asset.meta,
    url: asset.url ?? asset.thumbUrl,
    thumbUrl: asset.thumbUrl,
    durationSec: asset.durationSec,
    dimensions: asset.dimensions,
  };
}
