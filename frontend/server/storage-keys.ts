export const MAX_SAFE_OBJECT_KEY_BYTES = 1000;
export class StorageUploadError extends Error {
  context: {
    code?: 'precondition-conflict';
    stage?: 'before-upload' | 'put-object';
    key?: string;
    keyBytes?: number;
    prefix?: string;
    userId?: string | null;
    originalFileName?: string | null;
  };

  constructor(
    message: string,
    context: {
      code?: 'precondition-conflict';
      stage?: 'before-upload' | 'put-object';
      key?: string;
      keyBytes?: number;
      prefix?: string;
      userId?: string | null;
      originalFileName?: string | null;
    } = {}
  ) {
    super(message);
    this.name = 'StorageUploadError';
    this.context = context;
  }
}

function sanitizeSegment(segment: string): string {
  return segment
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-');
}

export function getObjectKeySizeBytes(key: string): number {
  return Buffer.byteLength(key, 'utf8');
}

function resolveStoragePrefix(prefix?: string): string {
  const requested = (prefix || 'uploads').replace(/^\/+|\/+$/g, '');
  const referenceNamespace = process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX?.trim().replace(/^\/+|\/+$/g, '');
  if (
    referenceNamespace
    && ['media-assets', 'user-assets', 'user-asset-thumbs'].some(
      (root) => requested === root || requested.startsWith(`${root}/`),
    )
  ) {
    return `${referenceNamespace}/${requested}`;
  }
  const renderNamespace = process.env.VIDEO_RENDER_STORAGE_PREFIX?.trim().replace(/^\/+|\/+$/g, '');
  if (!renderNamespace || (requested !== 'renders' && !requested.startsWith('renders/'))) {
    return requested;
  }
  const suffix = requested.slice('renders'.length).replace(/^\/+/, '');
  return suffix ? `${renderNamespace}/${suffix}` : renderNamespace;
}

export function buildObjectKey(params: { prefix?: string; userId?: string | null; leafName: string }): string {
  const { prefix, userId, leafName } = params;
  const prefixSegments = resolveStoragePrefix(prefix).split('/').map((segment) => sanitizeSegment(segment));
  const key = [...prefixSegments, userId ?? 'anonymous', leafName]
    .map((segment) => sanitizeSegment(segment))
    .filter((segment) => segment.length > 0)
    .join('/');

  const keyBytes = getObjectKeySizeBytes(key);
  if (keyBytes > MAX_SAFE_OBJECT_KEY_BYTES) {
    throw new StorageUploadError('Storage object key is too long.', {
      key,
      keyBytes,
      prefix,
      userId,
    });
  }

  return key;
}

export function isStorageKeyWithinUserPrefix(params: {
  key: string;
  prefix?: string;
  userId?: string | null;
}): boolean {
  const markerKey = buildObjectKey({
    prefix: params.prefix,
    userId: params.userId,
    leafName: '__upload_marker__',
  });
  const expectedPrefix = markerKey.slice(0, markerKey.lastIndexOf('/') + 1);
  return params.key.startsWith(expectedPrefix);
}
