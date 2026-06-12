import { NextResponse } from 'next/server';
import { isStorageKeyWithinUserPrefix } from '@/server/storage';

export type UploadedVideoPart = {
  partNumber: number;
  key: string;
  etag: string;
  size: number;
};

export function multipartTempPrefix(uploadId: string): string {
  return `user-assets/video-upload-parts/${uploadId}`;
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function readSize(value: unknown): number {
  const size = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(size) ? size : 0;
}

export function readPositiveInteger(value: unknown): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isInteger(number) && number > 0 ? number : 0;
}

export function readUploadFileName(value: unknown): string {
  return readString(value) || 'video-upload.mp4';
}

export function readUploadMime(value: unknown): string {
  return readString(value).toLowerCase() || 'application/octet-stream';
}

export function isValidUploadId(uploadId: string): boolean {
  return /^[a-zA-Z0-9._-]{8,120}$/.test(uploadId);
}

export function isValidFinalUploadKey(params: { key: string; userId: string }): boolean {
  return Boolean(params.key) && isStorageKeyWithinUserPrefix({ key: params.key, prefix: 'user-assets', userId: params.userId });
}

export function isValidPartUploadKey(params: { key: string; uploadId: string; userId: string }): boolean {
  return (
    Boolean(params.key) &&
    isValidUploadId(params.uploadId) &&
    isStorageKeyWithinUserPrefix({
      key: params.key,
      prefix: multipartTempPrefix(params.uploadId),
      userId: params.userId,
    })
  );
}

export function readUploadedVideoParts(value: unknown): UploadedVideoPart[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parts = value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const partNumber = readPositiveInteger((entry as { partNumber?: unknown }).partNumber);
    const key = readString((entry as { key?: unknown }).key);
    const etag = readString((entry as { etag?: unknown }).etag);
    const size = readSize((entry as { size?: unknown }).size);
    if (!partNumber || !key || size <= 0) return null;
    return { partNumber, key, etag: etag || key, size };
  });
  if (parts.some((part) => part === null)) return null;
  const sorted = (parts as UploadedVideoPart[]).sort((a, b) => a.partNumber - b.partNumber);
  const seen = new Set<number>();
  for (let index = 0; index < sorted.length; index += 1) {
    const part = sorted[index];
    if (seen.has(part.partNumber) || part.partNumber !== index + 1) return null;
    seen.add(part.partNumber);
  }
  return sorted;
}

export function uploadJsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...(extra ?? {}) }, { status });
}
