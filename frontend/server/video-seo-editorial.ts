import {
  VIDEO_SEO_EDITORIAL_ENTRIES,
  VIDEO_SEO_INTENTS,
  VIDEO_SEO_STATUSES,
  getVideoSeoEditorialEntry,
  type VideoSeoEditorialEntry,
  type VideoSeoIntent,
  type VideoSeoStatus,
} from '@/config/video-seo-editorial';
import { isDatabaseConfigured, query } from '@/lib/db';
import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import {
  buildDefaultVideoSeoCanonicalSlug,
  normalizeVideoSeoCanonicalSlug,
} from '@/lib/video-seo-canonical';
import {
  getDuplicateVideoObjectNames,
  validateVideoSeoEditorialEntry,
  type VideoSeoEditorialQaContext,
  type VideoSeoEditorialQaResult,
} from '@/lib/video-seo-editorial-qa';
import type { GalleryVideo } from '@/server/videos';

export type PersistedVideoSeoEditorialEntry = VideoSeoEditorialEntry & {
  source: 'code' | 'database';
  notes: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

type VideoSeoPageRow = {
  video_id: string;
  seo_status: string;
  seo_title: string | null;
  meta_description: string | null;
  h1: string | null;
  video_object_name: string | null;
  short_description: string | null;
  target_keyword: string | null;
  intent: string | null;
  model_slug: string | null;
  examples_slug: string | null;
  canonical_slug: string | null;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type EditableInput = Partial<Omit<VideoSeoEditorialEntry, 'id'>> & {
  id?: string;
  videoId?: string;
  notes?: string | null;
  allowCanonicalSlugChange?: boolean;
};

type VideoSeoEditorialUpdateValidationOptions = {
  videoId: string;
  payload: unknown;
  fallback?: VideoSeoEditorialEntry | null;
  qaContext?: VideoSeoEditorialQaContext;
  otherEntries?: readonly VideoSeoEditorialEntry[];
};

export type VideoSeoEditorialUpdateValidationResult =
  | {
      ok: true;
      entry: VideoSeoEditorialEntry;
      qa: VideoSeoEditorialQaResult;
    }
  | {
      ok: false;
      error: string;
      qa?: VideoSeoEditorialQaResult;
    };

const FALLBACK_PROMPT = 'Review this generated video candidate and replace the draft copy before approving it for video SEO.';
const APPROVED_REQUIRED_FIELDS = [
  'seoTitle',
  'metaDescription',
  'h1',
  'videoObjectName',
  'shortDescription',
  'targetKeyword',
  'intent',
  'modelSlug',
  'examplesSlug',
] as const satisfies readonly (keyof VideoSeoEditorialEntry)[];

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function truncate(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, Math.max(0, maxLength - 1)).trimEnd();
}

function isUndefinedTableError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === '42P01';
}

export function normalizeVideoSeoStatus(value: unknown, fallback: VideoSeoStatus = 'draft'): VideoSeoStatus {
  return VIDEO_SEO_STATUSES.includes(value as VideoSeoStatus) ? (value as VideoSeoStatus) : fallback;
}

export function normalizeVideoSeoIntent(value: unknown, fallback: VideoSeoIntent = 'prompt-example'): VideoSeoIntent {
  return VIDEO_SEO_INTENTS.includes(value as VideoSeoIntent) ? (value as VideoSeoIntent) : fallback;
}

function isEditableInput(value: unknown): value is EditableInput {
  return typeof value === 'object' && value !== null;
}

function isValidSeoStatus(value: unknown): value is VideoSeoStatus {
  return VIDEO_SEO_STATUSES.includes(value as VideoSeoStatus);
}

function isValidSeoIntent(value: unknown): value is VideoSeoIntent {
  return VIDEO_SEO_INTENTS.includes(value as VideoSeoIntent);
}

function buildFallbackCanonicalSlug(videoId: string, entry: Partial<VideoSeoEditorialEntry>): string {
  return buildDefaultVideoSeoCanonicalSlug({
    videoId,
    title: entry.seoTitle,
    h1: entry.h1,
    videoObjectName: entry.videoObjectName,
    targetKeyword: entry.targetKeyword,
  });
}

function resolveCanonicalSlug(videoId: string, entry: Partial<VideoSeoEditorialEntry>, explicit?: unknown): string {
  return normalizeVideoSeoCanonicalSlug(explicit) || normalizeVideoSeoCanonicalSlug(entry.canonicalSlug) || buildFallbackCanonicalSlug(videoId, entry);
}

function mapVideoSeoPageRow(row: VideoSeoPageRow): PersistedVideoSeoEditorialEntry {
  const entry = {
    id: row.video_id,
    seoStatus: normalizeVideoSeoStatus(row.seo_status),
    seoTitle: row.seo_title ?? '',
    metaDescription: row.meta_description ?? '',
    h1: row.h1 ?? '',
    videoObjectName: row.video_object_name ?? '',
    shortDescription: row.short_description ?? '',
    targetKeyword: row.target_keyword ?? '',
    intent: normalizeVideoSeoIntent(row.intent),
    modelSlug: row.model_slug ?? '',
    examplesSlug: row.examples_slug ?? '',
    canonicalSlug: row.canonical_slug ?? '',
    source: 'database' as const,
    notes: row.notes ?? null,
    updatedAt: row.updated_at ?? null,
    updatedBy: row.updated_by ?? null,
  };
  return {
    ...entry,
    canonicalSlug: resolveCanonicalSlug(row.video_id, entry, row.canonical_slug),
  };
}

function withCodeSource(entry: VideoSeoEditorialEntry): PersistedVideoSeoEditorialEntry {
  return {
    ...entry,
    canonicalSlug: resolveCanonicalSlug(entry.id, entry, entry.canonicalSlug),
    source: 'code',
    notes: null,
    updatedAt: null,
    updatedBy: null,
  };
}

export async function listVideoSeoEditorialEntries(): Promise<PersistedVideoSeoEditorialEntry[]> {
  const codeEntries = new Map(VIDEO_SEO_EDITORIAL_ENTRIES.map((entry) => [entry.id, withCodeSource(entry)]));
  if (!isDatabaseConfigured()) {
    return [...codeEntries.values()];
  }

  try {
    const rows = await query<VideoSeoPageRow>(
      `
        SELECT video_id, seo_status, seo_title, meta_description, h1, video_object_name,
               short_description, target_keyword, intent, model_slug, examples_slug,
               to_jsonb(video_seo_pages)->>'canonical_slug' AS canonical_slug,
               notes, updated_at::text AS updated_at, updated_by::text AS updated_by
        FROM video_seo_pages
        ORDER BY updated_at DESC, video_id ASC
      `
    );
    for (const row of rows) {
      codeEntries.set(row.video_id, mapVideoSeoPageRow(row));
    }
  } catch (error) {
    if (!isUndefinedTableError(error)) {
      console.warn('[video-seo-editorial] failed to list persisted pages', error);
    }
  }

  return [...codeEntries.values()];
}

export async function listVideoSeoEditorialEntryMap(): Promise<Map<string, PersistedVideoSeoEditorialEntry>> {
  const entries = await listVideoSeoEditorialEntries();
  return new Map(entries.map((entry) => [entry.id, entry] as const));
}

export async function getResolvedVideoSeoEditorialEntry(id?: string | null): Promise<PersistedVideoSeoEditorialEntry | null> {
  if (!id) return null;
  const entries = await listVideoSeoEditorialEntryMap();
  return entries.get(id) ?? null;
}

export function resolveCodeVideoSeoEditorialEntry(id?: string | null): PersistedVideoSeoEditorialEntry | null {
  const entry = getVideoSeoEditorialEntry(id);
  return entry ? withCodeSource(entry) : null;
}

export function buildDraftVideoSeoEditorialEntry(video: GalleryVideo): VideoSeoEditorialEntry {
  const normalizedEngine = normalizeEngineId(video.engineId) ?? video.engineId;
  const modelSlug = normalizedEngine || '';
  const examplesSlug = resolveExampleCanonicalSlug(modelSlug) ?? '';
  const prompt = video.promptExcerpt || video.prompt || FALLBACK_PROMPT;
  const promptSummary = truncate(prompt || FALLBACK_PROMPT, 96);
  const engineLabel = video.engineLabel || modelSlug || 'AI video engine';
  const draftTitle = truncate(`${engineLabel} video SEO candidate`, 80);
  const shortDescription = truncate(
    `Draft watch page for a ${engineLabel} video candidate. Review the prompt, target keyword, model link and examples family before approval.`,
    220
  );

  return {
    id: video.id,
    seoStatus: 'draft',
    seoTitle: draftTitle,
    metaDescription: truncate(`Review this ${engineLabel} video candidate before approving it for Google video indexing. Prompt: ${promptSummary}`, 160),
    h1: truncate(`${engineLabel} video SEO candidate`, 86),
    videoObjectName: draftTitle,
    shortDescription,
    targetKeyword: '',
    intent: 'prompt-example',
    modelSlug,
    examplesSlug,
    canonicalSlug: buildDefaultVideoSeoCanonicalSlug({
      videoId: video.id,
      title: `${engineLabel} ${promptSummary}`,
    }),
  };
}

export function normalizeVideoSeoEditorialInput(
  videoId: string,
  input: EditableInput,
  fallback?: VideoSeoEditorialEntry | null
): VideoSeoEditorialEntry {
  const source = fallback ?? resolveCodeVideoSeoEditorialEntry(videoId);
  const seoTitle = cleanText(input.seoTitle, source?.seoTitle ?? '');
  const h1 = cleanText(input.h1, source?.h1 ?? '');
  const videoObjectName = cleanText(input.videoObjectName, source?.videoObjectName ?? '');
  const targetKeyword = cleanText(input.targetKeyword, source?.targetKeyword ?? '');
  const canonicalSlug =
    normalizeVideoSeoCanonicalSlug(input.canonicalSlug) ||
    normalizeVideoSeoCanonicalSlug(source?.canonicalSlug) ||
    buildDefaultVideoSeoCanonicalSlug({
      videoId,
      title: seoTitle,
      h1,
      videoObjectName,
      targetKeyword,
    });

  return {
    id: videoId,
    seoStatus: normalizeVideoSeoStatus(input.seoStatus, source?.seoStatus ?? 'draft'),
    seoTitle,
    metaDescription: cleanText(input.metaDescription, source?.metaDescription ?? ''),
    h1,
    videoObjectName,
    shortDescription: cleanText(input.shortDescription, source?.shortDescription ?? ''),
    targetKeyword,
    intent: normalizeVideoSeoIntent(input.intent, source?.intent ?? 'prompt-example'),
    modelSlug: cleanText(input.modelSlug, source?.modelSlug ?? ''),
    examplesSlug: cleanText(input.examplesSlug, source?.examplesSlug ?? ''),
    canonicalSlug,
  };
}

export function validateVideoSeoEditorialUpdatePayload({
  videoId,
  payload,
  fallback,
  qaContext,
  otherEntries,
}: VideoSeoEditorialUpdateValidationOptions): VideoSeoEditorialUpdateValidationResult {
  if (!isEditableInput(payload)) {
    return { ok: false, error: 'Invalid payload' };
  }
  if ('seoStatus' in payload && !isValidSeoStatus(payload.seoStatus)) {
    return { ok: false, error: 'Invalid seoStatus' };
  }
  if ('intent' in payload && !isValidSeoIntent(payload.intent)) {
    return { ok: false, error: 'Invalid intent' };
  }

  const source = fallback ?? resolveCodeVideoSeoEditorialEntry(videoId);
  const entry = normalizeVideoSeoEditorialInput(videoId, payload, source);
  const lockedCanonicalSlug = normalizeVideoSeoCanonicalSlug(source?.canonicalSlug);
  if (
    lockedCanonicalSlug &&
    entry.canonicalSlug !== lockedCanonicalSlug &&
    payload.allowCanonicalSlugChange !== true
  ) {
    return {
      ok: false,
      error: 'Canonical slug is locked. Unlock and confirm the canonical URL change before saving.',
    };
  }

  const duplicateVideoObjectNames =
    qaContext?.duplicateVideoObjectNames ??
    (otherEntries
      ? getDuplicateVideoObjectNames([...otherEntries.filter((otherEntry) => otherEntry.id !== videoId), entry])
      : undefined);
  const qa = validateVideoSeoEditorialEntry(entry, {
    ...qaContext,
    ...(duplicateVideoObjectNames ? { duplicateVideoObjectNames } : {}),
  });
  if (entry.seoStatus !== 'approved') {
    return { ok: true, entry, qa };
  }

  const missingFields = APPROVED_REQUIRED_FIELDS.filter((field) => cleanText(entry[field]).length === 0);
  if (missingFields.length) {
    return {
      ok: false,
      error: `Approved video SEO pages require: ${missingFields.join(', ')}`,
      qa,
    };
  }
  if (!qa.passed) {
    return {
      ok: false,
      error: `Approved video SEO page failed QA: ${qa.errors.join(' ')}`,
      qa,
    };
  }

  return { ok: true, entry, qa };
}

export async function upsertVideoSeoEditorialEntry(
  entry: VideoSeoEditorialEntry,
  updatedBy?: string | null,
  notes?: string | null
): Promise<PersistedVideoSeoEditorialEntry> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database unavailable');
  }

  const rows = await query<VideoSeoPageRow>(
    `
      INSERT INTO video_seo_pages (
        video_id, seo_status, seo_title, meta_description, h1, video_object_name,
        short_description, target_keyword, intent, model_slug, examples_slug, canonical_slug, notes, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::uuid)
      ON CONFLICT (video_id) DO UPDATE SET
        seo_status = EXCLUDED.seo_status,
        seo_title = EXCLUDED.seo_title,
        meta_description = EXCLUDED.meta_description,
        h1 = EXCLUDED.h1,
        video_object_name = EXCLUDED.video_object_name,
        short_description = EXCLUDED.short_description,
        target_keyword = EXCLUDED.target_keyword,
        intent = EXCLUDED.intent,
        model_slug = EXCLUDED.model_slug,
        examples_slug = EXCLUDED.examples_slug,
        canonical_slug = EXCLUDED.canonical_slug,
        notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING video_id, seo_status, seo_title, meta_description, h1, video_object_name,
                short_description, target_keyword, intent, model_slug, examples_slug, canonical_slug,
                notes, updated_at::text AS updated_at, updated_by::text AS updated_by
    `,
    [
      entry.id,
      entry.seoStatus,
      entry.seoTitle,
      entry.metaDescription,
      entry.h1,
      entry.videoObjectName,
      entry.shortDescription,
      entry.targetKeyword,
      entry.intent,
      entry.modelSlug,
      entry.examplesSlug,
      entry.canonicalSlug ?? '',
      notes ?? null,
      updatedBy ?? null,
    ]
  );

  if (!rows[0]) {
    throw new Error('Failed to save video SEO page');
  }
  return mapVideoSeoPageRow(rows[0]);
}
