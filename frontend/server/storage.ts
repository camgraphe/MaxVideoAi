import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { ensureAssetSchema } from '@/lib/schema';
import { query } from '@/lib/db';

type UploadResult = {
  url: string;
  path: string;
  width: number | null;
  height: number | null;
  size: number;
  mime: string;
};

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const ASSETS_BUCKET = (process.env.SUPABASE_ASSETS_BUCKET || 'user-assets').trim();

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing');
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin!;
}

function inferExtension(mime: string, fallback = 'bin'): string {
  const match = mime.match(/^[^/]+\/([^;]+)/);
  if (!match) return fallback;
  return match[1].toLowerCase();
}

function getPngDimensions(data: Buffer): { width: number; height: number } | null {
  if (data.length < 24) return null;
  if (data.readUInt32BE(12) !== 0x49484452) return null; // IHDR
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
  const format = data.toString('ascii', 12, 16);
  if (format === 'VP8L') {
    const vp8lChunk = data.subarray(21);
    if (vp8lChunk.length < 5) return null;
    const width = (vp8lChunk[1] | ((vp8lChunk[2] & 0x3f) << 8)) + 1;
    const height = ((vp8lChunk[2] >> 6) | (vp8lChunk[3] << 2) | ((vp8lChunk[4] & 0x0f) << 10)) + 1;
    return { width, height };
  }
  if (format === 'VP8X') {
    if (data.length < 30) return null;
    const width = 1 + data.readUIntLE(24, 3);
    const height = 1 + data.readUIntLE(27, 3);
    return { width, height };
  }
  if (format === 'VP8 ') {
    // Lossy bitstream
    // Width and height stored as 14-bit values starting at byte 26
    if (data.length < 30) return null;
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
    // ignore parsing errors
  }
  return { width: null, height: null };
}

export async function uploadImageToStorage(params: {
  data: Buffer;
  mime: string;
  userId?: string | null;
  fileName?: string | null;
  prefix?: string;
}): Promise<UploadResult> {
  const { data, mime, userId, fileName, prefix } = params;
  const admin = getSupabaseAdmin();
  const safeMime = mime && mime.startsWith('image/') ? mime : 'image/png';
  const extension = inferExtension(safeMime, 'png');
  const slug = randomUUID();
  const safeName = fileName?.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '') || `${slug}.${extension}`;
  const path = [prefix || 'uploads', userId ?? 'anonymous', `${slug}-${safeName}`]
    .map((entry) => entry.replace(/^\/+|\/+$/g, ''))
    .join('/');

  const { width, height } = getImageDimensions(data, safeMime);

  const uploadResponse = await admin.storage.from(ASSETS_BUCKET).upload(path, data, {
    contentType: safeMime,
    upsert: false,
    cacheControl: '3600',
  });

  if (uploadResponse.error) {
    throw uploadResponse.error;
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(ASSETS_BUCKET).getPublicUrl(path);

  if (!publicUrl) {
    throw new Error('Failed to obtain public URL for uploaded asset');
  }

  return {
    url: publicUrl,
    path,
    width,
    height,
    size: data.length,
    mime: safeMime,
  };
}

const DEFAULT_ALLOWED_HOSTS = [
  'cdn.maxvideoai.com',
  'blob.vercel-storage.com',
  'storage.googleapis.com',
];

function buildHostAllowList(): Set<string> {
  const hosts = new Set<string>();
  DEFAULT_ALLOWED_HOSTS.forEach((host) => hosts.add(host));
  if (SUPABASE_URL) {
    try {
      const supabaseHost = new URL(SUPABASE_URL).host;
      hosts.add(supabaseHost);
    } catch {
      // ignore invalid URL
    }
  }
  if (process.env.ASSET_HOST_ALLOWLIST) {
    process.env.ASSET_HOST_ALLOWLIST.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => hosts.add(entry));
  }
  if (process.env.S3_PUBLIC_BASE_URL) {
    try {
      const s3Host = new URL(process.env.S3_PUBLIC_BASE_URL).host;
      hosts.add(s3Host);
    } catch {
      // ignore
    }
  }
  return hosts;
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
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
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

export type AssetRecord = {
  asset_id: string;
  user_id: string | null;
  url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  source: string | null;
  created_at: string;
};

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
