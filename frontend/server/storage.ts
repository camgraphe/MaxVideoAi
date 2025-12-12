import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { ensureAssetSchema } from '@/lib/schema';
import { query } from '@/lib/db';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type UploadResult = {
  url: string;
  key: string;
  width: number | null;
  height: number | null;
  size: number;
  mime: string;
};

const S3_BUCKET = (process.env.S3_BUCKET || '').trim();
const S3_REGION = (process.env.S3_REGION || '').trim();
const S3_ACCESS_KEY_ID = (process.env.S3_ACCESS_KEY_ID || '').trim();
const S3_SECRET_ACCESS_KEY = (process.env.S3_SECRET_ACCESS_KEY || '').trim();
const S3_PUBLIC_BASE_URL = (process.env.S3_PUBLIC_BASE_URL || '').trim();
const S3_UPLOAD_ACL = (process.env.S3_UPLOAD_ACL || '').trim();
const S3_CACHE_CONTROL = (process.env.S3_CACHE_CONTROL || 'public, max-age=3600').trim();

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!S3_BUCKET) throw new Error('S3_BUCKET is missing');
    if (!S3_REGION) throw new Error('S3_REGION is missing');
    if (!S3_ACCESS_KEY_ID) throw new Error('S3_ACCESS_KEY_ID is missing');
    if (!S3_SECRET_ACCESS_KEY) throw new Error('S3_SECRET_ACCESS_KEY is missing');

    s3Client = new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

function inferExtension(mime: string, fallback = 'bin'): string {
  const match = mime.match(/^[^/]+\/([^;]+)/);
  if (!match) return fallback;
  return match[1].toLowerCase();
}

function getPngDimensions(data: Buffer): { width: number; height: number } | null {
  if (data.length < 24) return null;
  if (data.readUInt32BE(12) !== 0x49484452) return null;
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  return { width, height };
}

function getJpegDimensions(data: Buffer): { width: number; height: number } | null {
  if (data.length < 4 || data.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < data.length) {
    const marker = data.readUInt16BE(offset);
    offset += 2;
    const length = data.readUInt16BE(offset);
    if (length < 2) return null;
    if (marker >= 0xffc0 && marker <= 0xffcf && marker !== 0xffc4 && marker !== 0xffc8 && marker !== 0xffcc) {
      if (offset + 5 >= data.length) return null;
      const height = data.readUInt16BE(offset + 3);
      const width = data.readUInt16BE(offset + 5);
      return { width, height };
    }
    offset += length;
  }
  return null;
}

function getWebpDimensions(data: Buffer): { width: number; height: number } | null {
  if (data.length < 30) return null;
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  const chunkType = data.toString('ascii', 12, 16);
  if (chunkType === 'VP8L') {
    const chunk = data.subarray(21);
    if (chunk.length < 5) return null;
    const width = (chunk[1] | ((chunk[2] & 0x3f) << 8)) + 1;
    const height = ((chunk[2] >> 6) | (chunk[3] << 2) | ((chunk[4] & 0x0f) << 10)) + 1;
    return { width, height };
  }
  if (chunkType === 'VP8X') {
    const width = 1 + data.readUIntLE(24, 3);
    const height = 1 + data.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunkType === 'VP8 ') {
    const rawWidth = data.readUInt16LE(26) & 0x3fff;
    const rawHeight = data.readUInt16LE(28) & 0x3fff;
    return { width: rawWidth, height: rawHeight };
  }
  return null;
}

function getImageDimensions(buffer: Buffer, mime: string): { width: number | null; height: number | null } {
  try {
    if (mime === 'image/png') {
      const dims = getPngDimensions(buffer);
      if (dims) return dims;
    } else if (mime === 'image/jpeg' || mime === 'image/jpg') {
      const dims = getJpegDimensions(buffer);
      if (dims) return dims;
    } else if (mime === 'image/webp') {
      const dims = getWebpDimensions(buffer);
      if (dims) return dims;
    }
  } catch {
    // ignore parse errors
  }
  return { width: null, height: null };
}

function sanitizeSegment(segment: string): string {
  return segment
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-');
}

function buildObjectKey(params: { prefix?: string; userId?: string | null; fileName: string }): string {
  const { prefix, userId, fileName } = params;
  return [prefix || 'uploads', userId ?? 'anonymous', fileName]
    .map((segment) => sanitizeSegment(segment))
    .filter((segment) => segment.length > 0)
    .join('/');
}

function buildPublicUrl(key: string): string {
  if (S3_PUBLIC_BASE_URL) {
    return `${S3_PUBLIC_BASE_URL.replace(/\/+$/, '')}/${key}`;
  }
  const host = S3_REGION ? `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com` : `${S3_BUCKET}.s3.amazonaws.com`;
  return `https://${host}/${key}`;
}

export async function uploadImageToStorage(params: {
  data: Buffer;
  mime: string;
  userId?: string | null;
  fileName?: string | null;
  prefix?: string;
}): Promise<UploadResult> {
  const client = getS3Client();
  const safeMime = params.mime && params.mime.startsWith('image/') ? params.mime : 'image/png';
  const extension = inferExtension(safeMime, 'png');
  const slug = randomUUID();
  const baseName = params.fileName?.replace(/\s+/g, '-')?.replace(/[^a-zA-Z0-9._-]/g, '') || `${slug}.${extension}`;
  const key = buildObjectKey({ prefix: params.prefix, userId: params.userId, fileName: `${slug}-${baseName}` });

  const putCommand = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: params.data,
    ContentType: safeMime,
    CacheControl: S3_CACHE_CONTROL,
  });
  if (S3_UPLOAD_ACL) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - ACL accepts specific string literals; keep runtime flexible via env
    putCommand.input.ACL = S3_UPLOAD_ACL;
  }

  await client.send(putCommand);

  const { width, height } = getImageDimensions(params.data, safeMime);

  return {
    url: buildPublicUrl(key),
    key,
    width,
    height,
    size: params.data.length,
    mime: safeMime,
  };
}

const DEFAULT_ALLOWED_HOSTS = new Set([
  'cdn.maxvideoai.com',
  'blob.vercel-storage.com',
  'storage.googleapis.com',
  's3.amazonaws.com',
]);

function buildHostAllowList(): Set<string> {
  const hosts = new Set(DEFAULT_ALLOWED_HOSTS);
  if (S3_PUBLIC_BASE_URL) {
    try {
      hosts.add(new URL(S3_PUBLIC_BASE_URL).host);
    } catch {
      // ignore invalid URL
    }
  } else if (S3_BUCKET) {
    const regionalHost = S3_REGION ? `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com` : `${S3_BUCKET}.s3.amazonaws.com`;
    hosts.add(regionalHost);
  }
  if (process.env.ASSET_HOST_ALLOWLIST) {
    process.env.ASSET_HOST_ALLOWLIST.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((host) => hosts.add(host));
  }
  return hosts;
}

function extractObjectKeyFromUrl(assetUrl: string): string | null {
  if (!assetUrl) return null;
  try {
    const parsed = new URL(assetUrl);
    const pathname = parsed.pathname || '';
    const normalizedPath = pathname.replace(/^\/+/, '');

    if (S3_PUBLIC_BASE_URL) {
      try {
        const base = new URL(S3_PUBLIC_BASE_URL);
        if (parsed.host !== base.host) {
          return null;
        }
        const basePath = base.pathname.replace(/\/+$/, '');
        if (basePath && !parsed.pathname.startsWith(basePath)) {
          return null;
        }
        const relativePath = basePath
          ? parsed.pathname.slice(basePath.length).replace(/^\/+/, '')
          : normalizedPath;
        return relativePath.length > 0 ? relativePath : null;
      } catch {
        // fall back to default extraction when base URL is invalid
      }
    }

    if (!S3_BUCKET) return null;
    const defaultHost = S3_REGION ? `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com` : `${S3_BUCKET}.s3.amazonaws.com`;
    if (parsed.host !== defaultHost) {
      return null;
    }
    return normalizedPath.length > 0 ? normalizedPath : null;
  } catch {
    return null;
  }
}

export function extractStorageKeyFromUrl(assetUrl: string): string | null {
  return extractObjectKeyFromUrl(assetUrl);
}

async function deleteObjectFromStorage(key: string): Promise<void> {
  if (!S3_BUCKET) return;
  const client = getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  await client.send(command);
}

export async function deleteUserAsset(params: { assetId: string; userId: string }): Promise<'deleted' | 'not_found'> {
  const { assetId, userId } = params;
  if (!assetId || !userId) return 'not_found';
  await ensureAssetSchema();
  const rows = await query<{ url: string }>(
    `DELETE FROM user_assets WHERE asset_id = $1 AND user_id = $2 RETURNING url`,
    [assetId, userId]
  );

  if (!rows.length) {
    return 'not_found';
  }

  const [record] = rows;
  const key = extractObjectKeyFromUrl(record.url);
  if (key) {
    try {
      await deleteObjectFromStorage(key);
    } catch (error) {
      console.error('[storage] failed to delete object', key, error);
    }
  }

  return 'deleted';
}

const ALLOWED_HOSTS = buildHostAllowList();

export function isAllowedAssetHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return ALLOWED_HOSTS.has(parsed.host);
  } catch {
    return false;
  }
}

export async function probeImageUrl(
  url: string,
  { timeoutMs = 3500 }: { timeoutMs?: number } = {}
): Promise<{ ok: boolean; mime?: string; size?: number }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) {
      return { ok: false };
    }
    const mime = response.headers.get('content-type') ?? undefined;
    const sizeHeader = response.headers.get('content-length');
    const size = sizeHeader ? Number(sizeHeader) : undefined;
    return { ok: true, mime, size: Number.isFinite(size) ? size : undefined };
  } catch {
    return { ok: false };
  }
}

export async function recordUserAsset(params: {
  assetId?: string;
  userId?: string | null;
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  size: number | null;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  const { assetId = randomUUID(), userId, url, mime, width, height, size, source, metadata } = params;
  await ensureAssetSchema();
  await query(
    `INSERT INTO user_assets (asset_id, user_id, url, mime_type, width, height, size_bytes, source, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (asset_id) DO NOTHING`,
    [
      assetId,
      userId ?? null,
      url,
      mime,
      width,
      height,
      size ?? null,
      source,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
  return assetId;
}

export function isStorageConfigured(): boolean {
  return Boolean(S3_BUCKET && S3_REGION && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);
}

export async function uploadFileBuffer(params: {
  data: Buffer;
  mime: string;
  userId?: string | null;
  fileName?: string | null;
  prefix?: string;
  cacheControl?: string;
  acl?: string | null;
}): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const extension = inferExtension(params.mime || 'application/octet-stream', 'bin');
  const slug = randomUUID();
  const baseName =
    params.fileName?.replace(/\s+/g, '-')?.replace(/[^a-zA-Z0-9._-]/g, '') || `${slug}.${extension}`;
  const key = buildObjectKey({
    prefix: params.prefix ?? 'files',
    userId: params.userId ?? 'anonymous',
    fileName: `${slug}-${baseName}`,
  });

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: params.data,
    ContentType: params.mime || 'application/octet-stream',
    CacheControl: params.cacheControl ?? S3_CACHE_CONTROL,
  });

  const acl = params.acl ?? S3_UPLOAD_ACL;
  if (acl) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - ACL accepts specific string literals; keep runtime flexible via env
    command.input.ACL = acl;
  }

  await client.send(command);

  return { key, url: buildPublicUrl(key) };
}

export async function createSignedDownloadUrl(key: string, { expiresInSeconds }: { expiresInSeconds: number }): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
