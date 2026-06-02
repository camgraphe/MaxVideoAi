import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { authFetch } from '@/lib/authFetch';
import { translateError } from '@/lib/error-messages';

export type LibraryView = 'saved' | 'review';
export type LibraryKind = 'image' | 'video' | 'audio';
export type SavedAssetSource = 'all' | 'upload' | 'generated' | 'storyboard' | 'character' | 'angle' | 'upscale';

export type UserAsset = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  previewUrl?: string | null;
  kind?: 'image' | 'video' | 'audio';
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  source?: string | null;
  jobId?: string | null;
  sourceOutputId?: string | null;
  createdAt?: string;
};

export type RecentOutput = {
  id: string;
  jobId: string;
  url: string;
  thumbUrl?: string | null;
  previewUrl?: string | null;
  kind: 'image' | 'video' | 'audio';
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  position?: number | null;
  status?: string | null;
  createdAt?: string;
  isSaved?: boolean;
  savedAssetId?: string | null;
};

export type AssetsResponse = {
  ok: boolean;
  error?: string;
  assets: UserAsset[];
};

export type RecentOutputsResponse = {
  ok: boolean;
  error?: string;
  outputs: RecentOutput[];
};

export interface LibraryCopy {
  auth: {
    eyebrow: string;
    title: string;
    body: string;
    createAccount: string;
    signIn: string;
  };
  hero: {
    title: string;
    subtitle: string;
    ctas: {
      image: string;
      video: string;
    };
  };
  views: {
    saved: string;
    review: string;
  };
  media: {
    images: string;
    videos: string;
    audio: string;
  };
  browser: {
    searchPlaceholder: string;
    sourcesTitle: string;
    toolsTitle: string;
    toolsDescription: string;
    emptySearch: string;
    import: string;
    importing: string;
    importFailed: string;
    refresh: string;
    loadMore: string;
  };
  tabs: {
    all: string;
    upload: string;
    generated: string;
    recent: string;
    storyboard: string;
    character: string;
    angle: string;
    upscale: string;
  };
  review: {
    subtitle: string;
    sourcesTitle: string;
    helper: string;
    empty: string;
    loadError: string;
    saveButton: string;
    saving: string;
    saved: string;
    saveError: string;
    openRender: string;
  };
  assets: {
    title: string;
    countLabel: string;
    loadError: string;
    empty: string;
    emptyUploads: string;
    emptyGenerated: string;
    emptyStoryboard: string;
    emptyCharacter: string;
    emptyAngle: string;
    emptyUpscale: string;
    deleteError: string;
    deleteButton: string;
    downloadButton: string;
    openAssetButton: string;
    useSettingsButton: string;
    deleting: string;
    assetFallback: string;
  };
}

export const DEFAULT_LIBRARY_COPY: LibraryCopy = {
  auth: {
    eyebrow: 'Workspace',
    title: 'Create your workspace account',
    body: 'Sign in to access your saved assets, downloads, and reusable references.',
    createAccount: 'Create account',
    signIn: 'Sign in',
  },
  hero: {
    title: 'Library',
    subtitle: 'Saved media you can reuse across generations.',
    ctas: {
      image: 'Generate image',
      video: 'Generate video',
    },
  },
  views: {
    saved: 'Saved assets',
    review: 'Review recent renders',
  },
  media: {
    images: 'Images',
    videos: 'Videos',
    audio: 'Audio',
  },
  browser: {
    searchPlaceholder: 'Search assets…',
    sourcesTitle: 'Saved Library',
    toolsTitle: 'Create or transform',
    toolsDescription: 'Open another workspace to prepare a better source before importing it here.',
    emptySearch: 'No assets match this search.',
    import: 'Import',
    importing: 'Importing…',
    importFailed: 'Import failed. Please try again.',
    refresh: 'Refresh',
    loadMore: 'Load more',
  },
  tabs: {
    all: 'All images',
    upload: 'Uploaded images',
    generated: 'Saved renders',
    recent: 'Recent renders',
    storyboard: 'Storyboard assets',
    character: 'Character assets',
    angle: 'Angle assets',
    upscale: 'Upscale assets',
  },
  review: {
    subtitle: 'Choose recent renders to save as reusable Library assets.',
    sourcesTitle: 'History',
    helper: 'Choose recent renders to save as reusable Library assets.',
    empty: 'No recent renders yet. Generate something first, then save the outputs you want to reuse.',
    loadError: 'Unable to load recent renders.',
    saveButton: 'Save to Library',
    saving: 'Saving…',
    saved: 'Saved',
    saveError: 'Unable to save this render to Library.',
    openRender: 'Open render',
  },
  assets: {
    title: 'Library assets',
    countLabel: '{count}',
    loadError: 'Unable to load saved assets.',
    empty: 'Your Library is empty. Import media or review recent renders to save reusable assets.',
    emptyUploads: 'No uploaded media yet. Import media from your device to see it here.',
    emptyGenerated: 'No saved renders yet. Review recent renders and save the outputs you want to reuse.',
    emptyStoryboard: 'No storyboard assets saved yet. Save a storyboard image to see it here.',
    emptyCharacter: 'No character assets saved yet. Generate one in Character Builder to see it here.',
    emptyAngle: 'No angle assets saved yet. Generate one in the Angle tool to see it here.',
    emptyUpscale: 'No upscale assets saved yet. Save an upscale result to see it here.',
    deleteError: 'Unable to delete this asset.',
    deleteButton: 'Delete',
    downloadButton: 'Download',
    openAssetButton: 'Open asset',
    useSettingsButton: 'Open source',
    deleting: 'Deleting…',
    assetFallback: 'Asset',
  },
};

export const LIBRARY_PAGE_SIZE = 60;

export function buildSavedAssetsKey({
  userId,
  activeKind,
  activeSource,
  limit,
}: {
  userId: string | null | undefined;
  activeKind: LibraryKind;
  activeSource: SavedAssetSource;
  limit: number;
}) {
  if (!userId) return null;
  const params = new URLSearchParams({
    limit: String(limit),
    kind: activeKind,
  });
  if (activeSource !== 'all') {
    params.set('source', activeSource);
  }
  return `/api/media-library/assets?${params.toString()}`;
}

export function buildRecentOutputsKey({
  userId,
  activeKind,
  activeView,
  limit,
}: {
  userId: string | null | undefined;
  activeKind: LibraryKind;
  activeView: LibraryView;
  limit: number;
}) {
  if (!userId || activeView !== 'review') return null;
  const params = new URLSearchParams({
    limit: String(limit),
    kind: activeKind,
  });
  return `/api/media-library/recent-outputs?${params.toString()}`;
}

export function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

export const assetsFetcher = async (url: string): Promise<AssetsResponse> => {
  const res = await authFetch(url);
  const json = (await res.json().catch(() => null)) as AssetsResponse | null;
  if (!res.ok || !json) {
    throw new Error(json && typeof json.error === 'string' ? json.error : 'Failed to load assets');
  }
  return json;
};

export const recentOutputsFetcher = async (url: string): Promise<RecentOutputsResponse> => {
  const res = await authFetch(url);
  const json = (await res.json().catch(() => null)) as RecentOutputsResponse | null;
  if (!res.ok || !json) {
    throw new Error(json && typeof json.error === 'string' ? json.error : 'Failed to load recent renders');
  }
  return json;
};

export function resolveImageUploadErrorMessage(status: number, errorCode: unknown, fallback: string): string {
  return translateError({
    code: typeof errorCode === 'string' ? errorCode : null,
    status,
    message: fallback,
  }).message;
}

export function inferKind(asset: Pick<UserAsset, 'kind' | 'mime'>): LibraryKind {
  if (asset.kind === 'audio' || asset.mime?.startsWith('audio/')) return 'audio';
  if (asset.kind === 'video' || asset.mime?.startsWith('video/')) return 'video';
  return 'image';
}

function normalizeSourceForHref(source?: string | null): string | null {
  if (source === 'saved_job_output') return 'generated';
  return source ?? null;
}

export function isMaxVideoGeneratedAsset(asset: Pick<AssetBrowserAsset, 'jobId' | 'source'>): boolean {
  if (!asset.jobId) return false;
  const source = normalizeSourceForHref(asset.source);
  return (
    source === 'generated' ||
    source === 'recent' ||
    source === 'storyboard' ||
    source === 'character' ||
    source === 'upscale'
  );
}

export function getAssetJobHref(asset: Pick<AssetBrowserAsset, 'jobId' | 'source' | 'kind'>): string | null {
  if (!isMaxVideoGeneratedAsset(asset)) return null;
  const jobId = asset.jobId;
  if (!jobId) return null;
  const source = normalizeSourceForHref(asset.source);
  if (source === 'angle') return null;
  if (source === 'character') {
    return `/app/tools/character-builder?job=${encodeURIComponent(jobId)}`;
  }
  if (source === 'storyboard') {
    return `/app/image?tool=storyboard&job=${encodeURIComponent(jobId)}`;
  }
  if (source === 'upscale') {
    return `/app/tools/upscale?job=${encodeURIComponent(jobId)}`;
  }
  if (asset.kind === 'image' || jobId.startsWith('img_')) {
    return `/app/image?job=${encodeURIComponent(jobId)}`;
  }
  if (asset.kind === 'audio') {
    return `/app/audio?job=${encodeURIComponent(jobId)}`;
  }
  return `/app?job=${encodeURIComponent(jobId)}`;
}
