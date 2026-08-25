import type { CanonicalReferenceMediaKind } from './generation-types';

const MAX_REFERENCE_MEDIA_DURATION_SEC = 86_400;

export const SUPPORTED_REFERENCE_RASTER_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export type SupportedReferenceRasterMime =
  (typeof SUPPORTED_REFERENCE_RASTER_MIME_TYPES)[number];

export const SUPPORTED_REFERENCE_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
] as const;

export const SUPPORTED_REFERENCE_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
] as const;

export type SupportedReferenceVideoMime =
  (typeof SUPPORTED_REFERENCE_VIDEO_MIME_TYPES)[number];
export type SupportedReferenceAudioMime =
  (typeof SUPPORTED_REFERENCE_AUDIO_MIME_TYPES)[number];
export type SupportedReferenceMediaMime =
  | SupportedReferenceRasterMime
  | SupportedReferenceVideoMime
  | SupportedReferenceAudioMime;

export type SupportedReferenceMedia = Readonly<{
  kind: CanonicalReferenceMediaKind;
  canonicalMime: SupportedReferenceMediaMime;
}>;

const REFERENCE_RASTER_MIME_ALIASES = new Map<string, SupportedReferenceRasterMime>([
  ['image/avif', 'image/avif'],
  ['image/gif', 'image/gif'],
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/pjpeg', 'image/jpeg'],
  ['image/png', 'image/png'],
  ['image/webp', 'image/webp'],
]);

const REFERENCE_MEDIA_MIME_ALIASES = new Map<string, SupportedReferenceMedia>([
  ...Array.from(
    REFERENCE_RASTER_MIME_ALIASES,
    ([mime, canonicalMime]) => [`image:${mime}`, { kind: 'image' as const, canonicalMime }] as const,
  ),
  ['video:video/mp4', { kind: 'video', canonicalMime: 'video/mp4' }],
  ['video:video/quicktime', { kind: 'video', canonicalMime: 'video/quicktime' }],
  ['audio:audio/mpeg', { kind: 'audio', canonicalMime: 'audio/mpeg' }],
  ['audio:audio/wav', { kind: 'audio', canonicalMime: 'audio/wav' }],
  ['audio:audio/x-wav', { kind: 'audio', canonicalMime: 'audio/wav' }],
  ['audio:audio/mp4', { kind: 'audio', canonicalMime: 'audio/mp4' }],
]);

function normalizeMimeValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const mimeType = value.split(';')[0]?.trim().toLowerCase() ?? '';
  return mimeType || null;
}

export function normalizeSupportedReferenceRasterMime(
  value: unknown,
): SupportedReferenceRasterMime | null {
  const mimeType = normalizeMimeValue(value);
  if (!mimeType) return null;
  return REFERENCE_RASTER_MIME_ALIASES.get(mimeType) ?? null;
}

export function resolveSupportedReferenceMedia(
  kind: unknown,
  mimeType: unknown,
): SupportedReferenceMedia | null {
  if (kind !== 'image' && kind !== 'video' && kind !== 'audio') return null;
  const normalizedMime = normalizeMimeValue(mimeType);
  if (!normalizedMime) return null;
  return REFERENCE_MEDIA_MIME_ALIASES.get(`${kind}:${normalizedMime}`) ?? null;
}

export function normalizeSupportedReferenceDuration(
  kind: CanonicalReferenceMediaKind,
  value: unknown,
): { valid: boolean; durationSec: number | null } {
  if (kind === 'image') return { valid: true, durationSec: null };
  if (value === null || value === undefined) return { valid: true, durationSec: null };
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value <= 0
    || value > MAX_REFERENCE_MEDIA_DURATION_SEC
  ) {
    return { valid: false, durationSec: null };
  }
  return { valid: true, durationSec: value };
}
