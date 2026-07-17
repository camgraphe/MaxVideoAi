import { isSignedMediaUrl } from '@/lib/media';
import {
  createSignedDownloadUrl,
  extractStorageKeyFromUrl,
  isAllowedAssetHost,
  isStorageConfigured,
} from '@/server/storage';
import {
  listLibraryAssetPage,
} from '@/server/media-library/assets';
import {
  decodeMediaLibraryCursor,
  type MediaLibraryPage,
} from '@/server/media-library/pagination';
import type { MediaAssetRecord } from '@/server/media-library';

import { AgentApiError } from './errors';
import type { AgentMediaItem } from './media-types';
import type { AgentPrincipal } from './principal';
import { normalizeSupportedReferenceRasterMime } from './reference-media-policy';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;
const MAX_CURSOR_LENGTH = 1_024;
const PRIVATE_PREVIEW_TTL_SECONDS = 5 * 60;

export type ListAgentMediaInput = {
  cursor?: string | null;
  limit?: number;
};

export type AgentMediaPage = MediaLibraryPage<AgentMediaItem>;

export type ListAgentMediaDependencies = {
  listAssetPage: typeof listLibraryAssetPage;
  createPrivatePreviewUrl(asset: MediaAssetRecord): Promise<string | null>;
};

function requirePrincipal(principal: AgentPrincipal): void {
  const userId = principal?.userId;
  if (
    principal?.authMethod !== 'oauth'
    || typeof userId !== 'string'
    || userId.length < 1
    || userId.length > 128
    || userId !== userId.trim()
  ) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before listing media.');
  }
}

function normalizeInput(input: ListAgentMediaInput): { cursor: string | null; limit: number } {
  const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new AgentApiError('PARAMETER_INVALID', 'limit must be an integer between 1 and 50.');
  }
  const cursor = input.cursor ?? null;
  if (
    cursor !== null
    && (
      typeof cursor !== 'string'
      || cursor.length < 1
      || cursor.length > MAX_CURSOR_LENGTH
      || !decodeMediaLibraryCursor(cursor)
    )
  ) {
    throw new AgentApiError('PARAMETER_INVALID', 'cursor is not a valid media-library cursor.');
  }
  return { cursor, limit };
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value.trim();
  if (!label || label.length > 200 || /[\u0000-\u001f\u007f]/u.test(label)) return null;
  return label;
}

function normalizeDimension(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeSource(source: MediaAssetRecord['source']): AgentMediaItem['source'] {
  if (source === 'upload') return 'upload';
  if (source === 'saved_job_output') return 'generated';
  return 'imported';
}

function controlledPrivatePreview(value: string | null): string | null {
  if (!value || value.length > 4_096 || !isSignedMediaUrl(value) || !isAllowedAssetHost(value)) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== 'https:'
      || parsed.username.length > 0
      || parsed.password.length > 0
      || parsed.hash.length > 0
      || (parsed.port.length > 0 && parsed.port !== '443')
    ) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function createStoragePreviewUrl(asset: MediaAssetRecord): Promise<string | null> {
  if (!isStorageConfigured()) return null;
  for (const candidate of [asset.thumbUrl, asset.previewUrl, asset.url]) {
    const key = candidate ? extractStorageKeyFromUrl(candidate) : null;
    if (!key) continue;
    try {
      return await createSignedDownloadUrl(key, { expiresInSeconds: PRIVATE_PREVIEW_TTL_SECONDS });
    } catch {
      return null;
    }
  }
  return null;
}

function isListableImage(asset: MediaAssetRecord, userId: string): boolean {
  return asset.userId === userId
    && asset.kind === 'image'
    && normalizeSupportedReferenceRasterMime(asset.mimeType) !== null
    && asset.status.trim().toLowerCase() === 'ready'
    && typeof asset.id === 'string'
    && asset.id.length > 0
    && typeof asset.createdAt === 'string'
    && Number.isFinite(Date.parse(asset.createdAt));
}

export async function listAgentMedia(
  input: ListAgentMediaInput,
  principal: AgentPrincipal,
  dependencies: Partial<ListAgentMediaDependencies> = {},
): Promise<AgentMediaPage> {
  requirePrincipal(principal);
  const normalized = normalizeInput(input);
  const listAssetPage = dependencies.listAssetPage ?? listLibraryAssetPage;
  const createPrivatePreviewUrl = dependencies.createPrivatePreviewUrl ?? createStoragePreviewUrl;
  const page = await listAssetPage({
    userId: principal.userId,
    kind: 'image',
    cursor: normalized.cursor,
    limit: normalized.limit,
  });
  if (page.hasMore && (!page.nextCursor || !decodeMediaLibraryCursor(page.nextCursor))) {
    throw new Error('The media library returned an invalid pagination cursor.');
  }

  const items = await Promise.all(
    page.items
      .filter((asset) => isListableImage(asset, principal.userId))
      .map(async (asset): Promise<AgentMediaItem> => ({
        assetId: asset.id,
        kind: 'image',
        label: normalizeLabel(asset.metadata.label),
        width: normalizeDimension(asset.width),
        height: normalizeDimension(asset.height),
        mimeType: normalizeSupportedReferenceRasterMime(asset.mimeType),
        previewUrl: controlledPrivatePreview(await createPrivatePreviewUrl(asset)),
        source: normalizeSource(asset.source),
        createdAt: asset.createdAt!,
      })),
  );

  return {
    items,
    nextCursor: page.hasMore ? page.nextCursor : null,
    hasMore: page.hasMore,
  };
}
