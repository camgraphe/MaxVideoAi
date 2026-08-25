import { query, type QueryExecutor } from '@/lib/db';
import { isAllowedAssetHost } from '@/server/storage';

import { AgentApiError } from './errors';
import type { AgentPrincipal } from './principal';
import {
  normalizeSupportedReferenceDuration,
  resolveSupportedReferenceMedia,
} from './reference-media-policy';
import type { ResolvedReference } from './reference-types';

const PUBLIC_ASSET_ID_PATTERN = /^ma_[a-f0-9]{32}$/u;

type ReferenceAssetRow = {
  id: string;
  public_id: string;
  user_id: string | null;
  kind: string;
  url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  status: string | null;
  deleted_at: string | null;
  metadata: unknown;
};

export type OwnedReferenceAsset = Omit<ResolvedReference, 'role'>;

export type ResolveOwnedReferenceAssetDependencies = {
  executor: QueryExecutor;
};

const defaultExecutor: QueryExecutor = { query };

function requirePrincipal(principal: AgentPrincipal): void {
  const userId = principal?.userId;
  if (
    principal?.authMethod !== 'oauth'
    || typeof userId !== 'string'
    || userId.length < 1
    || userId.length > 128
    || userId !== userId.trim()
  ) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before using reference media.');
  }
}

function normalizeAssetId(value: unknown): string {
  if (
    typeof value !== 'string'
    || !PUBLIC_ASSET_ID_PATTERN.test(value)
  ) {
    throw new AgentApiError('REFERENCE_INVALID', 'Reference media is not usable.');
  }
  return value;
}

function validDimension(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value > 0);
}

function validStorageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 4_096 || !isAllowedAssetHost(value)) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && parsed.username.length === 0
      && parsed.password.length === 0
      && parsed.hash.length === 0
      && (parsed.port.length === 0 || parsed.port === '443')
      && parsed.pathname !== '/';
  } catch {
    return false;
  }
}

function hasValidDurationMetadata(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
  if (!Object.hasOwn(value, 'durationSec')) return true;
  const durationSec = (value as Record<string, unknown>).durationSec;
  return normalizeSupportedReferenceDuration('video', durationSec).valid;
}

function invalidReference(): never {
  throw new AgentApiError('REFERENCE_INVALID', 'Reference media is not usable.');
}

export async function resolveOwnedReferenceAsset(
  principal: AgentPrincipal,
  assetId: string,
  dependencies: Partial<ResolveOwnedReferenceAssetDependencies> = {},
): Promise<OwnedReferenceAsset> {
  requirePrincipal(principal);
  const normalizedAssetId = normalizeAssetId(assetId);
  const executor = dependencies.executor ?? defaultExecutor;
  const rows = await executor.query<ReferenceAssetRow>(
    `SELECT id, public_id, user_id, kind, url, mime_type, width, height, status, deleted_at, metadata
       FROM media_assets
      WHERE public_id = $1
        AND user_id = $2
      LIMIT 1`,
    [normalizedAssetId, principal.userId],
  );
  const row = rows[0];
  if (!row) {
    throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference media not found.');
  }
  if (row.user_id !== principal.userId) {
    throw new AgentApiError('REFERENCE_FORBIDDEN', 'Reference media is not available.');
  }

  const media = resolveSupportedReferenceMedia(row.kind, row.mime_type);
  if (
    row.public_id !== normalizedAssetId
    || row.status?.trim().toLowerCase() !== 'ready'
    || row.deleted_at !== null
    || !media
    || !validStorageUrl(row.url)
    || !validDimension(row.width)
    || !validDimension(row.height)
    || !hasValidDurationMetadata(row.metadata)
  ) invalidReference();

  return {
    assetId: row.public_id,
    mediaKind: media.kind,
    storageUrl: row.url,
    width: row.width,
    height: row.height,
    mimeType: media.canonicalMime,
  };
}
