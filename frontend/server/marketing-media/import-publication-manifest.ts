import { isDeepStrictEqual } from 'node:util';
import { isIP } from 'node:net';
import { z } from 'zod';
import { normalizeVideoOperation } from '@/lib/video-operation';
import { sanitizePublicRecreationSnapshot } from './public-recreation';
import { MARKETING_PUBLICATION_IMPORT_SCHEMA, MarketingMediaError, marketingSourceFingerprint, prepareMarketingSnapshot, record } from './snapshot';
import { MARKETING_MIME_EXTENSIONS, MAX_MARKETING_FILE_BYTES } from './storage';

export const MAX_MARKETING_PUBLICATION_BYTES = 512 * 1024 ** 2;
const SHA256 = /^[a-f0-9]{64}$/;
const MARKETING_FILE_PATH = /^\/marketing-media\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/([a-f0-9]{64})\.([a-z0-9]+)$/;
const CLEAN_TEXT = /^[^\u0000\uD800-\uDFFF]*$/u;
const text = z.string().regex(CLEAN_TEXT);
const dateTime = text.max(64).datetime({ offset: true }).refine((value) => Number.isFinite(Date.parse(value)));
const mediaUrl = text.min(1).max(2048);
const dimension = z.number().int().positive().max(2147483647).nullish();
const sourceSchema = z.object({ url: mediaUrl, exportedAt: dateTime }).strict();
const publicationSchema = z.object({
  job_id: text.regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/),
  status: z.literal('completed'),
  surface: z.literal('video'),
  visibility: z.literal('public'),
  user_id: z.null().optional(),
  engine_id: text.regex(/^[a-z0-9][a-z0-9_-]{0,127}$/),
  engine_label: text.min(1).max(256),
  title: text.min(1).max(256).optional(),
  prompt: text,
  created_at: dateTime,
  duration_sec: z.number().int().positive().max(2147483647),
  aspect_ratio: text.max(32).nullish(),
  has_audio: z.boolean().nullish(),
  can_upscale: z.boolean().nullish(),
  currency: text.regex(/^[A-Z]{3}$/).nullish(),
  indexable: z.boolean().nullish(),
  featured: z.boolean().nullish(),
  featured_order: z.number().int().min(-2147483648).max(2147483647).nullish(),
  video_url: mediaUrl,
  thumb_url: mediaUrl.nullish(),
  preview_video_url: mediaUrl.nullish(),
  playback_video_url: mediaUrl.nullish(),
  keyframe_urls: z.object({ start: mediaUrl.nullish(), middle: mediaUrl.nullish(), end: mediaUrl.nullish() }).strict().nullish(),
  marketing_output_width: dimension,
  marketing_output_height: dimension,
  settings_snapshot: z.unknown(),
}).strict();
const recipeSchema = z.object({
  schemaVersion: z.literal(1),
  surface: z.literal('video'),
  engineId: publicationSchema.shape.engine_id,
  engineLabel: text.nullish(),
  inputMode: z.enum(['t2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'r2v', 'a2v', 'extend', 'retake', 'reframe']),
  operation: text.optional(),
  prompt: text,
  negativePrompt: text.nullish(),
  core: z.record(z.unknown()),
  advanced: z.record(z.unknown()).nullish(),
  refs: z.record(z.unknown()),
}).strict();
const fileSchema = z.object({
  url: mediaUrl,
  mime: text.max(64),
  sizeBytes: z.number().int().positive().safe(),
  sha256: text.regex(SHA256),
}).strict();
const manifestSchema = z.object({
  schemaVersion: z.literal(MARKETING_PUBLICATION_IMPORT_SCHEMA),
  source: z.unknown(),
  publication: z.unknown(),
  recreationSnapshot: z.unknown(),
  files: z.array(fileSchema).nonempty(),
}).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new MarketingMediaError(message);
  return result.data;
}

function portableUrl(value: string, message: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MarketingMediaError(message);
  }
  if (
    url.protocol !== 'https:' || url.username || url.password || url.port || url.href !== value ||
    /[?#]/.test(value) || !url.hostname.includes('.') || isIP(url.hostname) ||
    /(?:\.localhost|\.local|\.internal|\.)$/.test(url.hostname)
  ) throw new MarketingMediaError(message);
  return url;
}

const extraPrivateKey = /(?:asset|user|owner|account|job|output|receipt|interaction|request|paymentintent)ids?$/i;
const credentialKey = /secret|password|credential|authorization|apikey|accesstoken|refreshtoken/i;
const literalKey = /^(?:prompt|negativePrompt|negative_prompt|name|label|description)$/;
const referenceKey = /urls?$|^(?:reference_?images|frontal_?image)$/i;
const urlLike = /^(?:\s*[a-z][a-z0-9+.-]*:\/\/|\s*(?:blob:|data:|file:|\/))/i;

function inspectRecipe(value: unknown, media: Set<string>, depth = 0, key = ''): void {
  if (depth > 64) throw new MarketingMediaError('The public recreation settings are nested too deeply.');
  if (typeof value === 'string') {
    if (!CLEAN_TEXT.test(value)) throw new MarketingMediaError('The public recreation settings contain invalid text.');
    if (value && !literalKey.test(key) && (referenceKey.test(key) || urlLike.test(value)))
      media.add(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) inspectRecipe(entry, media, depth + 1, key);
  } else if (value && typeof value === 'object') {
    for (const [name, entry] of Object.entries(value)) {
      const normalized = name.replace(/[_-]/g, '');
      if (extraPrivateKey.test(normalized) || credentialKey.test(normalized))
        throw new MarketingMediaError('The recreation settings contain a private binding or credentials.');
      if (!CLEAN_TEXT.test(name) || ['__proto__', 'prototype', 'constructor'].includes(name))
        throw new MarketingMediaError('The public recreation settings contain an invalid field.');
      inspectRecipe(entry, media, depth + 1, name);
    }
  } else if (value !== null && typeof value !== 'boolean' && !Number.isFinite(value)) {
    throw new MarketingMediaError('The public recreation settings contain an invalid value.');
  }
}

export function prepareMarketingPublicationImport(value: unknown) {
  const manifest = parse(manifestSchema, value, 'The public marketing publication manifest or file declarations are invalid.');
  const source = parse(sourceSchema, manifest.source, 'The public source provenance is invalid.');
  portableUrl(source.url, 'The public source URL must be portable HTTPS.');
  if (record(manifest.publication).user_id != null)
    throw new MarketingMediaError('The publication contains a private account binding.');
  const publication = parse(publicationSchema, manifest.publication, 'The public publication metadata is invalid.');
  const referencedUrls = new Set<string>();
  inspectRecipe(manifest.recreationSnapshot, referencedUrls);
  inspectRecipe(publication.settings_snapshot, referencedUrls);
  const recipe = parse(recipeSchema, manifest.recreationSnapshot, 'The public recreation settings are invalid or incomplete.');
  if (
    !isDeepStrictEqual(recipe, sanitizePublicRecreationSnapshot(recipe)) ||
    !isDeepStrictEqual(publication.settings_snapshot, sanitizePublicRecreationSnapshot(publication.settings_snapshot))
  ) throw new MarketingMediaError('The recreation settings contain a private binding.');
  if (publication.engine_id !== recipe.engineId || !isDeepStrictEqual(publication.settings_snapshot, recipe))
    throw new MarketingMediaError('The publication engine and settings must match the public recreation recipe.');
  try {
    normalizeVideoOperation(recipe.engineId, recipe.inputMode, recipe.operation);
  } catch {
    throw new MarketingMediaError('The recreation operation is missing or unsupported for this engine and mode.');
  }

  const plan = prepareMarketingSnapshot({
    job: { ...publication, settings_snapshot: recipe },
    output: { width: publication.marketing_output_width, height: publication.marketing_output_height },
  }, { requireConsistentMediaKinds: true });
  if (Object.hasOwn(publication, 'playback_video_url')) plan.publication.playback_video_url = publication.playback_video_url;

  const declarations = new Map<string, (typeof manifest.files)[number]>();
  for (const file of manifest.files) {
    const url = portableUrl(file.url, 'Each declared file must use a portable HTTPS marketing-media URL.');
    const match = url.pathname.match(MARKETING_FILE_PATH);
    if (!match || match[1] !== file.sha256)
      throw new MarketingMediaError('Each declared file must use its content-addressed marketing-media URL.');
    if (!Object.hasOwn(MARKETING_MIME_EXTENSIONS, file.mime) || match[2] !== MARKETING_MIME_EXTENSIONS[file.mime])
      throw new MarketingMediaError('A declared file has an unsupported MIME type or extension.');
    if (declarations.has(file.url)) throw new MarketingMediaError('The manifest contains a duplicate file declaration.');
    declarations.set(file.url, file);
  }
  const requiredUrls = new Set(plan.media.map(({ sourceUrl }) => sourceUrl));
  for (const url of referencedUrls) {
    if (!requiredUrls.has(url)) throw new MarketingMediaError('The recreation settings contain an unsupported media reference.');
  }
  const files = plan.media.map((media) => {
    const expected = declarations.get(media.sourceUrl);
    if (!expected) throw new MarketingMediaError('The manifest is missing a required media file.');
    if (expected.sizeBytes > MAX_MARKETING_FILE_BYTES)
      throw new MarketingMediaError('A required media file exceeds the copy size limit.');
    if (!expected.mime.startsWith(media.kind + '/'))
      throw new MarketingMediaError('A required file MIME type does not match its media role.');
    return { media, expected };
  });
  if (files.reduce((total, { expected }) => total + expected.sizeBytes, 0) > MAX_MARKETING_PUBLICATION_BYTES)
    throw new MarketingMediaError('This publication exceeds the total copy size limit.');

  const sourceRecord = { schemaVersion: MARKETING_PUBLICATION_IMPORT_SCHEMA, source, job: publication };
  const fingerprint = marketingSourceFingerprint({
    ...sourceRecord,
    files: files.map(({ expected }) => expected).sort((a, b) => a.url.localeCompare(b.url)),
  });
  const width = publication.marketing_output_width ?? null;
  const height = publication.marketing_output_height ?? null;
  const summary = {
    videoId: plan.videoId,
    name: publication.title ?? publication.engine_label,
    durationSec: publication.duration_sec,
    resolution: width && height ? `${width} × ${height}` : typeof recipe.core.resolution === 'string' ? recipe.core.resolution : null,
    width,
    height,
    fileCount: files.length,
  };
  plan.publication.visibility = 'private';
  plan.publication.indexable = false;
  plan.publication.featured = false;
  plan.publication.featured_order = 0;
  return { plan, files, sourceRecord, fingerprint, summary };
}
