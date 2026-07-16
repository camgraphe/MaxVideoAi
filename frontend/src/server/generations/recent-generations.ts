import { getEngineAliases, listFalEngines } from '@/config/falEngines';
import { query } from '@/lib/db';
import { deriveJobSurface } from '@/lib/job-surface';
import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders } from '@/lib/image-renders';
import { normalizeMediaUrl } from '@/lib/media';
import {
  mapGenerationStatusRecordToAgent,
  type AgentGenerationStatus,
  type GenerationStatusRecord,
} from './generation-status';

export type RecentGenerationSurface =
  | 'video'
  | 'image'
  | 'storyboard'
  | 'character'
  | 'angle'
  | 'audio'
  | 'upscale'
  | 'background-removal';

export type RecentGenerationQueryParam = string | number | Date | string[];

export type RecentGenerationRecord = Omit<GenerationStatusRecord, 'thumb_url'> & {
  updated_at: string;
  thumb_url: string;
  has_audio: boolean | null;
  can_upscale: boolean | null;
  visibility: string | null;
  indexable: boolean | null;
};

export type RecentGenerationsResult = {
  items: AgentGenerationStatus[];
  nextCursor: string | null;
};

export const RECENT_GENERATIONS_SELECT = `id, job_id, user_id, updated_at, surface, billing_product_key, settings_snapshot, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url, preview_video_url, audio_url, created_at, aspect_ratio, has_audio, can_upscale, preview_frame, final_price_cents, pricing_snapshot, currency, vendor_account_id, payment_status, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, visibility, indexable, status, progress, provider, provider_job_id`;

export const RECENT_IMAGE_ENGINE_ALIASES = listFalEngines()
  .filter((engine) => (engine.category ?? 'video') === 'image')
  .flatMap((engine) => getEngineAliases(engine));

const MAX_AGENT_RECENT_LIMIT = 50;
const MAX_WEB_RECENT_LIMIT = 100;
const MAX_CURSOR_CHARS = 256;
const STATUS_VALUES: Record<AgentGenerationStatus['status'], string[]> = {
  accepted: ['accepted', 'created', 'pending', 'queued', 'submitted', 'waiting'],
  running: ['in_progress', 'processing', 'running'],
  completed: ['completed', 'finished', 'success', 'succeeded'],
  failed: ['aborted', 'cancelled', 'canceled', 'error', 'errored', 'expired', 'failed', 'missing', 'not_found', 'timed_out', 'timeout'],
};

type RecentGenerationQuery = (
  sql: string,
  params?: ReadonlyArray<unknown>
) => Promise<RecentGenerationRecord[]>;

export class RecentGenerationInputError extends Error {
  constructor(readonly field: 'cursor', message: string) {
    super(message);
    this.name = 'RecentGenerationInputError';
  }
}

export function parseRecentGenerationCursor(
  value: string | null | undefined,
  options: { strict?: boolean } = {}
): { createdAt: Date | null; id: number | null } {
  if (!value) return { createdAt: null, id: null };
  const strict = options.strict === true;
  if (value.length > MAX_CURSOR_CHARS) {
    if (strict) throw new RecentGenerationInputError('cursor', 'cursor exceeds its size limit.');
    return { createdAt: null, id: null };
  }
  if (value.includes('|')) {
    const parts = value.split('|');
    const [timestampPart, idPart] = parts;
    const parsedDate = timestampPart ? new Date(timestampPart) : null;
    const createdAt = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    const parsedId = idPart ? Number.parseInt(idPart, 10) : NaN;
    const id = Number.isFinite(parsedId) ? parsedId : null;
    if (
      strict &&
      (
        parts.length !== 2 ||
        !createdAt ||
        id === null ||
        !Number.isSafeInteger(id) ||
        id < 0 ||
        String(id) !== idPart?.trim()
      )
    ) {
      if (strict) throw new RecentGenerationInputError('cursor', 'cursor is invalid.');
    }
    return { createdAt, id };
  }
  const parsedId = Number.parseInt(value, 10);
  if (
    Number.isSafeInteger(parsedId) &&
    parsedId >= 0 &&
    (!strict || String(parsedId) === value.trim())
  ) {
    return { createdAt: null, id: parsedId };
  }
  if (strict) throw new RecentGenerationInputError('cursor', 'cursor is invalid.');
  return { createdAt: null, id: null };
}

function normalizeRecentLimit(value: number, fallback: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

export function formatRecentGenerationCursor(record: { created_at: string; id: number }): string {
  const createdAt = new Date(record.created_at);
  if (Number.isNaN(createdAt.getTime())) return String(record.id);
  return `${createdAt.toISOString()}|${record.id}`;
}

export function buildRecentGenerationSurfaceFilterClause(
  surface: RecentGenerationSurface,
  params: RecentGenerationQueryParam[]
): string {
  params.push(surface);
  const directIndex = params.length;
  if (surface === 'character') {
    return `(surface = $${directIndex} OR settings_snapshot->>'surface' = 'character-builder')`;
  }
  if (surface === 'angle') {
    return `(surface = $${directIndex} OR job_id LIKE 'tool_angle_%' OR settings_snapshot->>'surface' = 'angle')`;
  }
  if (surface === 'upscale') {
    return `(surface = $${directIndex} OR job_id LIKE 'tool_upscale_%' OR settings_snapshot->>'surface' = 'upscale')`;
  }
  if (surface === 'background-removal') {
    return `(surface = $${directIndex} OR job_id LIKE 'tool_background_removal_%' OR settings_snapshot->>'surface' = 'background-removal')`;
  }
  if (surface === 'image') {
    params.push(RECENT_IMAGE_ENGINE_ALIASES);
    const aliasesIndex = params.length;
    return `(
      surface = $${directIndex}
      OR (
        (
          settings_snapshot->>'surface' = 'image'
          OR render_ids IS NOT NULL
          OR COALESCE(engine_id, '') = ANY($${aliasesIndex}::text[])
        )
        AND COALESCE(surface, '') NOT IN ('storyboard', 'character', 'angle', 'upscale', 'background-removal')
        AND COALESCE(settings_snapshot->>'surface', '') NOT IN ('storyboard', 'character-builder', 'angle', 'upscale', 'background-removal', 'video')
        AND job_id NOT LIKE 'tool_angle_%'
        AND job_id NOT LIKE 'tool_upscale_%'
        AND job_id NOT LIKE 'tool_background_removal_%'
        AND job_id NOT LIKE 'storyboard_%'
      )
    )`;
  }
  if (surface === 'video') {
    params.push(RECENT_IMAGE_ENGINE_ALIASES);
    const aliasesIndex = params.length;
    return `(
      (
        surface = $${directIndex}
        OR COALESCE(video_url, '') <> ''
        OR settings_snapshot->>'surface' = 'video'
      )
      AND NOT (
        COALESCE(surface, '') IN ('image', 'storyboard', 'character', 'angle', 'audio', 'upscale', 'background-removal')
        OR settings_snapshot->>'surface' IN ('image', 'storyboard', 'character-builder', 'angle', 'audio', 'upscale', 'background-removal')
        OR job_id LIKE 'tool_angle_%'
        OR job_id LIKE 'tool_upscale_%'
        OR job_id LIKE 'tool_background_removal_%'
        OR job_id LIKE 'storyboard_%'
        OR render_ids IS NOT NULL
        OR COALESCE(engine_id, '') = ANY($${aliasesIndex}::text[])
      )
    )`;
  }
  return `surface = $${directIndex}`;
}

function addFeedFilter(
  feedType: 'all' | 'video' | 'image',
  conditions: string[],
  params: RecentGenerationQueryParam[]
): void {
  if (feedType === 'all') return;
  params.push(RECENT_IMAGE_ENGINE_ALIASES);
  const aliasIndex = params.length;
  const aliasClause = `COALESCE(engine_id, '') = ANY($${aliasIndex}::text[])`;
  const heuristicClause = `((COALESCE(engine_id, '') = '' OR engine_id IS NULL) AND (render_ids IS NOT NULL OR (video_url IS NULL AND hero_render_id IS NOT NULL)))`;
  if (feedType === 'image') {
    conditions.push(`(
      surface IN ('image', 'character', 'angle', 'upscale')
      OR settings_snapshot->>'surface' IN ('image', 'character-builder', 'angle', 'upscale')
      OR job_id LIKE 'tool_angle_%'
      OR job_id LIKE 'tool_upscale_%'
      OR ${aliasClause}
      OR ${heuristicClause}
    )
    AND COALESCE(surface, '') NOT IN ('storyboard')
    AND COALESCE(settings_snapshot->>'surface', '') NOT IN ('storyboard')
    AND job_id NOT LIKE 'storyboard_%'`);
    return;
  }
  conditions.push(`NOT (
    surface IN ('image', 'storyboard', 'character', 'angle', 'audio', 'upscale', 'background-removal')
    OR settings_snapshot->>'surface' IN ('image', 'storyboard', 'character-builder', 'angle', 'audio', 'upscale', 'background-removal')
    OR job_id LIKE 'tool_angle_%'
    OR job_id LIKE 'tool_upscale_%'
    OR job_id LIKE 'tool_background_removal_%'
    OR job_id LIKE 'storyboard_%'
    OR ${aliasClause}
    OR ${heuristicClause}
  )`);
}

async function readRecentGenerationRecords(params: {
  userId: string;
  feedType: 'all' | 'video' | 'image';
  requestedSurface: RecentGenerationSurface | null;
  status?: AgentGenerationStatus['status'] | null;
  cursor?: string | null;
  limit: number;
  maxLimit: number;
  strictCursor: boolean;
  applyWebFailurePolicy: boolean;
  queryFn?: RecentGenerationQuery;
}): Promise<RecentGenerationRecord[]> {
  const userId = params.userId.trim();
  if (!userId) return [];
  const defaultLimit = params.maxLimit === MAX_WEB_RECENT_LIMIT ? 24 : 20;
  const limit = normalizeRecentLimit(params.limit, defaultLimit, params.maxLimit);
  const queryParams: RecentGenerationQueryParam[] = [userId];
  const baseFailureClause =
    "NOT (LOWER(status) IN ('failed','error','errored','cancelled','canceled') AND updated_at < NOW() - INTERVAL '150 seconds')";
  const conditions = ['user_id = $1', 'hidden IS NOT TRUE'];
  if (params.applyWebFailurePolicy) {
    if (params.feedType === 'image' || params.feedType === 'all') {
      conditions.push(`(${baseFailureClause} OR render_ids IS NOT NULL)`);
    } else {
      conditions.push(baseFailureClause);
    }
  }
  if (params.requestedSurface) {
    conditions.push(buildRecentGenerationSurfaceFilterClause(params.requestedSurface, queryParams));
  } else {
    addFeedFilter(params.feedType, conditions, queryParams);
  }
  if (params.status) {
    queryParams.push(STATUS_VALUES[params.status]);
    conditions.push(`LOWER(COALESCE(status, '')) = ANY($${queryParams.length}::text[])`);
  }
  const cursor = parseRecentGenerationCursor(params.cursor, { strict: params.strictCursor });
  if (cursor.createdAt) {
    queryParams.push(cursor.createdAt, cursor.id ?? Number.MAX_SAFE_INTEGER);
    conditions.push(`(created_at, id) < ($${queryParams.length - 1}, $${queryParams.length})`);
  } else if (cursor.id !== null) {
    queryParams.push(cursor.id);
    conditions.push(`id < $${queryParams.length}`);
  }
  queryParams.push(limit + 1);
  const queryFn: RecentGenerationQuery = params.queryFn ?? query;
  const rows = await queryFn(
    `SELECT ${RECENT_GENERATIONS_SELECT}
       FROM app_jobs
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT $${queryParams.length}`,
    queryParams
  );
  return rows.filter((record) => record.user_id === userId);
}

function buildAgentSurfaceClauses(aliasesIndex: number): { image: string; video: string } {
  const classification = `(CASE
    WHEN LOWER(BTRIM(COALESCE(j.surface, ''))) IN ('image', 'storyboard', 'character', 'character-builder', 'angle', 'upscale')
      THEN 'image'
    WHEN LOWER(BTRIM(COALESCE(j.surface, ''))) = 'background-removal'
      THEN 'video'
    WHEN LOWER(BTRIM(COALESCE(j.surface, ''))) = 'audio'
      THEN NULL
    WHEN LOWER(BTRIM(COALESCE(j.settings_snapshot->>'surface', ''))) IN ('image', 'storyboard', 'character', 'character-builder', 'angle', 'upscale')
      THEN 'image'
    WHEN LOWER(BTRIM(COALESCE(j.settings_snapshot->>'surface', ''))) = 'background-removal'
      THEN 'video'
    WHEN LOWER(BTRIM(COALESCE(j.settings_snapshot->>'surface', ''))) = 'audio'
      THEN NULL
    WHEN j.job_id LIKE 'tool_angle_%' OR j.job_id LIKE 'angle_%'
      THEN 'image'
    WHEN j.job_id LIKE 'tool_upscale_%' OR j.job_id LIKE 'upscale_%'
      THEN 'image'
    WHEN j.job_id LIKE 'tool_background_removal_%' OR j.job_id LIKE 'background_removal_%'
      THEN 'video'
    WHEN j.job_id LIKE 'storyboard_%'
      THEN 'image'
    WHEN j.render_ids IS NOT NULL
      THEN 'image'
    WHEN COALESCE(j.engine_id, '') = ANY($${aliasesIndex}::text[])
      THEN 'image'
    ELSE 'video'
  END)`;
  return {
    image: `${classification} = 'image'`,
    video: `${classification} = 'video'`,
  };
}

async function readRecentAgentGenerationRecords(params: {
  userId: string;
  surface: 'video' | 'image' | null;
  status: AgentGenerationStatus['status'] | null;
  cursor?: string | null;
  limit: number;
  queryFn?: RecentGenerationQuery;
}): Promise<RecentGenerationRecord[]> {
  const userId = params.userId.trim();
  if (!userId) return [];
  const limit = normalizeRecentLimit(params.limit, 20, MAX_AGENT_RECENT_LIMIT);
  const queryParams: RecentGenerationQueryParam[] = [userId, RECENT_IMAGE_ENGINE_ALIASES];
  const surfaceClauses = buildAgentSurfaceClauses(2);
  const ownedConditions = [
    'j.user_id = $1',
    'j.hidden IS NOT TRUE',
    params.surface ? surfaceClauses[params.surface] : `(${surfaceClauses.image} OR ${surfaceClauses.video})`,
  ];
  if (params.status) {
    queryParams.push(STATUS_VALUES[params.status]);
    ownedConditions.push(`LOWER(COALESCE(j.status, '')) = ANY($${queryParams.length}::text[])`);
  }

  const cursor = parseRecentGenerationCursor(params.cursor, { strict: true });
  let cursorClause = '';
  if (cursor.createdAt) {
    queryParams.push(cursor.createdAt, cursor.id ?? Number.MAX_SAFE_INTEGER);
    cursorClause = `WHERE (created_at, id) < ($${queryParams.length - 1}, $${queryParams.length})`;
  } else if (cursor.id !== null) {
    queryParams.push(cursor.id);
    cursorClause = `WHERE id < $${queryParams.length}`;
  }
  queryParams.push(limit + 1);
  const queryFn: RecentGenerationQuery = params.queryFn ?? query;
  const rows = await queryFn(
    `WITH ranked AS (
       SELECT ${RECENT_GENERATIONS_SELECT},
              ROW_NUMBER() OVER (
                PARTITION BY CASE
                  WHEN NULLIF(BTRIM(j.provider_job_id), '') IS NOT NULL
                    THEN 'provider:' || BTRIM(j.provider_job_id)
                  ELSE 'job:' || j.job_id
                END
                ORDER BY j.created_at DESC, j.id DESC
              ) AS provider_rank
         FROM app_jobs j
        WHERE ${ownedConditions.join(' AND ')}
     ), deduped AS (
       SELECT ${RECENT_GENERATIONS_SELECT}
         FROM ranked
        WHERE provider_rank = 1
     )
     SELECT ${RECENT_GENERATIONS_SELECT}
       FROM deduped
       ${cursorClause}
      ORDER BY created_at DESC, id DESC
      LIMIT $${queryParams.length}`,
    queryParams
  );
  return rows.filter((record) => record.user_id === userId);
}

export async function readRecentGenerationRecordsForWeb(params: {
  userId: string;
  feedType: 'all' | 'video' | 'image';
  requestedSurface: RecentGenerationSurface | null;
  cursor?: string | null;
  limit: number;
  queryFn?: RecentGenerationQuery;
}): Promise<RecentGenerationRecord[]> {
  return readRecentGenerationRecords({
    ...params,
    maxLimit: MAX_WEB_RECENT_LIMIT,
    strictCursor: false,
    applyWebFailurePolicy: true,
  });
}

export async function readOwnedGenerationRecordsByIds(params: {
  userId: string;
  jobIds: string[];
  queryFn?: RecentGenerationQuery;
}): Promise<RecentGenerationRecord[]> {
  const userId = params.userId.trim();
  const jobIds = Array.from(new Set(params.jobIds.map((jobId) => jobId.trim()).filter(Boolean)));
  if (!userId || !jobIds.length) return [];
  const queryFn: RecentGenerationQuery = params.queryFn ?? query;
  const rows = await queryFn(
    `SELECT ${RECENT_GENERATIONS_SELECT}
       FROM app_jobs
      WHERE user_id = $1
        AND job_id = ANY($2::text[])`,
    [userId, jobIds]
  );
  const allowedIds = new Set(jobIds);
  return rows.filter((record) => record.user_id === userId && allowedIds.has(record.job_id));
}

export async function listRecentGenerations(params: {
  userId: string;
  surface?: 'video' | 'image' | null;
  status?: AgentGenerationStatus['status'] | null;
  cursor?: string | null;
  limit?: number;
  queryFn?: RecentGenerationQuery;
}): Promise<RecentGenerationsResult> {
  const limit = normalizeRecentLimit(params.limit ?? 20, 20, MAX_AGENT_RECENT_LIMIT);
  const rows = await readRecentAgentGenerationRecords({
    userId: params.userId,
    surface: params.surface ?? null,
    status: params.status ?? null,
    cursor: params.cursor,
    limit,
    queryFn: params.queryFn,
  });
  const items: Array<{ record: RecentGenerationRecord; status: AgentGenerationStatus }> = [];
  for (const record of rows) {
    if (record.user_id !== params.userId) continue;
    const status = mapGenerationStatusRecordToAgent(record);
    if (!status) continue;
    items.push({ record, status });
    if (items.length >= limit) break;
  }
  const hasMore = rows.length > limit;
  const last = items.at(-1)?.record;
  return {
    items: items.map((item) => item.status),
    nextCursor: hasMore && last ? formatRecentGenerationCursor(last) : null,
  };
}

export function mapRecentGenerationRecordToWeb(record: RecentGenerationRecord) {
  const parsedRenders = parseStoredImageRenders(record.render_ids);
  const renderIds = extractRenderIds(parsedRenders.entries);
  const renderThumbUrls = extractRenderThumbUrls(parsedRenders);
  const primaryImage = renderIds?.[0] ? normalizeMediaUrl(renderIds[0]) ?? renderIds[0] : undefined;
  const primaryThumb = renderThumbUrls?.[0]
    ? normalizeMediaUrl(renderThumbUrls[0]) ?? renderThumbUrls[0]
    : undefined;
  const surface = deriveJobSurface({
    surface: record.surface,
    settingsSnapshot: record.settings_snapshot,
    jobId: record.job_id,
    engineId: record.engine_id,
    videoUrl: record.video_url,
    renderIds: record.render_ids,
  });
  return {
    jobId: record.job_id,
    surface,
    billingProductKey: record.billing_product_key ?? undefined,
    settingsSnapshot: record.settings_snapshot ?? undefined,
    engineLabel: record.engine_label,
    durationSec: record.duration_sec,
    prompt: record.prompt,
    thumbUrl: normalizeMediaUrl(record.thumb_url) ?? primaryThumb ?? primaryImage ?? undefined,
    videoUrl: normalizeMediaUrl(record.video_url) ?? undefined,
    previewVideoUrl: normalizeMediaUrl(record.preview_video_url) ?? undefined,
    audioUrl: normalizeMediaUrl(record.audio_url) ?? undefined,
    createdAt: record.created_at,
    engineId: record.engine_id,
    aspectRatio: record.aspect_ratio ?? undefined,
    hasAudio: Boolean(record.has_audio ?? false),
    canUpscale: Boolean(record.can_upscale ?? false),
    previewFrame: record.preview_frame ?? undefined,
    finalPriceCents: record.final_price_cents ?? undefined,
    currency: record.currency ?? 'USD',
    pricingSnapshot: record.pricing_snapshot ?? undefined,
    vendorAccountId: record.vendor_account_id ?? undefined,
    paymentStatus: record.payment_status ?? undefined,
    stripePaymentIntentId: record.stripe_payment_intent_id ?? undefined,
    stripeChargeId: record.stripe_charge_id ?? undefined,
    batchId: record.batch_id ?? undefined,
    groupId: record.group_id ?? undefined,
    iterationIndex: record.iteration_index ?? undefined,
    iterationCount: record.iteration_count ?? undefined,
    renderIds,
    renderThumbUrls,
    heroRenderId: record.hero_render_id ?? undefined,
    localKey: record.local_key ?? undefined,
    status: record.status ?? undefined,
    progress: typeof record.progress === 'number' ? record.progress : undefined,
    message: record.message ?? undefined,
    etaSeconds: record.eta_seconds ?? undefined,
    etaLabel: record.eta_label ?? undefined,
    visibility: record.visibility ?? 'public',
    indexable: record.indexable ?? true,
  };
}
