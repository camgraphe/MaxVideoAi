import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'node:crypto';
import { isStorageKeyWithinUserPrefix } from './storage-keys';

const S3_BUCKET = (process.env.S3_BUCKET || '').trim();
const S3_REGION = (process.env.S3_REGION || '').trim();
const S3_ACCESS_KEY_ID = (process.env.S3_ACCESS_KEY_ID || '').trim();
const S3_SECRET_ACCESS_KEY = (process.env.S3_SECRET_ACCESS_KEY || '').trim();
const S3_PUBLIC_BASE_URL = (process.env.S3_PUBLIC_BASE_URL || '').trim();
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

export function extractObjectKeyFromUrl(assetUrl: string): string | null {
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

export async function createSignedDownloadUrl(
  key: string,
  {
    expiresInSeconds,
    downloadFilename,
    method = 'GET',
  }: {
    expiresInSeconds: number;
    downloadFilename?: string;
    method?: 'GET' | 'HEAD';
  },
): Promise<string> {
  const client = getS3Client();
  const safeDownloadFilename = downloadFilename
    ?.trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 160);
  const command = method === 'HEAD' ? new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }) : new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ...(safeDownloadFilename
      ? { ResponseContentDisposition: `attachment; filename="${safeDownloadFilename}"` }
      : {}),
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
const OWNED_MEDIA_STORAGE_PREFIXES = [
  'renders/images',
  'renders/thumbs',
  'renders/previews',
  'renders/keyframes',
  'storyboard-template-references',
  'normalized-references',
  'background-removal',
  'timeline-exports',
  'user-asset-thumbs',
  'media-assets',
  'user-assets',
  'inline',
  'upscale',
  'angle',
  'renders',
  'files',
] as const;

export function isOwnedMediaStorageKey(params: { key: string; userId: string }): boolean {
  if (!params.key || !params.userId) return false;
  const contentOwner = createHash('sha256').update(params.userId).digest('hex').slice(0, 32);
  return OWNED_MEDIA_STORAGE_PREFIXES.some((prefix) =>
    isStorageKeyWithinUserPrefix({ key: params.key, prefix, userId: params.userId })
    || isStorageKeyWithinUserPrefix({ key: params.key, prefix: `${prefix}/by-content`, userId: contentOwner }),
  );
}

export function ownedMediaStorageKeyForUrl(params: { url: string; userId: string }): string | null {
  const key = extractObjectKeyFromUrl(params.url);
  return key && isOwnedMediaStorageKey({ key, userId: params.userId }) ? key : null;
}
