import { isDatabaseConfigured, query, withDbTransaction } from '@/lib/db';
import { isStablePublicMediaUrl, normalizeMediaUrl } from '@/lib/media';
import { mapGalleryVideoRow, type GalleryVideo, type VideoRow } from '@/server/videos-normalization';
import { parseSnapshot } from '@/server/watch-page-signals/snapshot';

export type PromptReviewVerdict =
  | 'strong_example'
  | 'good_needs_prompt_tweak'
  | 'wrong_model'
  | 'wrong_workflow'
  | 'bad_result'
  | 'avoid_pattern'
  | 'seo_candidate';

export type PromptReviewIntent =
  | 'product_ad'
  | 'social_ad'
  | 'cinematic_scene'
  | 'talking_avatar'
  | 'spokesperson'
  | 'character_animation'
  | 'product_reference_i2v'
  | 'person_reference_i2v'
  | 'video_to_video'
  | 'draft_storyboard'
  | 'seo_watch_page'
  | 'unknown';

export type PromptReviewStatusFilter =
  | 'all'
  | 'unreviewed'
  | 'reviewed'
  | PromptReviewVerdict;

export type PromptReviewSignals = {
  workflow: string;
  resolution: string | null;
  hasProduct: boolean;
  hasPersonOrCharacter: boolean;
  hasTextLogoRisk: boolean;
  hasAudioOrLipSync: boolean;
  hasReferenceInput: boolean;
  hasStableVideoUrl: boolean;
  hasStableThumbUrl: boolean;
  adaptiveScoreKeys: string[];
  suggestedTags: string[];
};

export type PromptResultReview = {
  id: string;
  jobId: string;
  videoId: string;
  engineId: string;
  engineLabel: string;
  workflow: string;
  durationSec: number | null;
  aspectRatio: string | null;
  resolution: string | null;
  promptText: string;
  negativePrompt: string | null;
  promptSource: string;
  promptStructureId: string | null;
  promptStructureVersion: string | null;
  strategistVersion: string | null;
  modelCatalogVersion: string | null;
  intent: PromptReviewIntent;
  verdict: PromptReviewVerdict;
  overallScore: number | null;
  promptMatchScore: number | null;
  modelFitScore: number | null;
  workflowFitScore: number | null;
  visualQualityScore: number | null;
  motionScore: number | null;
  cameraScore: number | null;
  commercialUseScore: number | null;
  seoPotentialScore: number | null;
  productPreservationScore: number | null;
  characterPreservationScore: number | null;
  textLogoAccuracyScore: number | null;
  audioLipSyncScore: number | null;
  qcmAnswersJson: Record<string, unknown>;
  tags: string[];
  blockers: string[];
  improvementSuggestions: string[];
  avoidPatternSummary: string | null;
  notes: string | null;
  updatedAt: string;
};

export type PromptIntelligenceReviewSummary = {
  jobId: string;
  videoId: string;
  userId: string | null;
  engineId: string;
  engineLabel: string;
  workflow: string;
  durationSec: number | null;
  aspectRatio: string | null;
  resolution: string | null;
  promptText: string;
  promptExcerpt: string;
  videoUrl: string | null;
  thumbUrl: string | null;
  previewVideoUrl: string | null;
  createdAt: string;
  hasReview: boolean;
  verdict: PromptReviewVerdict | null;
  overallScore: number | null;
  intent: PromptReviewIntent;
  signals: PromptReviewSignals;
};

export type PromptIntelligenceReviewCandidate = {
  video: GalleryVideo;
  summary: PromptIntelligenceReviewSummary;
  review: PromptResultReview | null;
  signals: PromptReviewSignals;
  settingsSnapshot: unknown;
};

export type PromptIntelligenceReviewFilters = {
  limit?: number;
  reviewStatus?: PromptReviewStatusFilter | null;
  engineId?: string | null;
  search?: string | null;
};

export type SavePromptResultReviewInput = {
  jobId: string;
  reviewerId: string;
  intent: PromptReviewIntent;
  verdict: PromptReviewVerdict;
  promptSource: string;
  promptStructureId?: string | null;
  promptStructureVersion?: string | null;
  strategistVersion?: string | null;
  modelCatalogVersion?: string | null;
  overallScore?: number | null;
  promptMatchScore?: number | null;
  modelFitScore?: number | null;
  workflowFitScore?: number | null;
  visualQualityScore?: number | null;
  motionScore?: number | null;
  cameraScore?: number | null;
  commercialUseScore?: number | null;
  seoPotentialScore?: number | null;
  productPreservationScore?: number | null;
  characterPreservationScore?: number | null;
  textLogoAccuracyScore?: number | null;
  audioLipSyncScore?: number | null;
  qcmAnswersJson?: Record<string, unknown>;
  tags?: string[];
  blockers?: string[];
  improvementSuggestions?: string[];
  avoidPatternSummary?: string | null;
  notes?: string | null;
  createPattern?: boolean;
};

type PromptReviewRow = VideoRow & {
  review_id: string | null;
  review_verdict: string | null;
  review_overall_score: number | string | null;
  review_intent: string | null;
};

type PromptReviewDetailRow = PromptReviewRow & {
  prompt_source: string | null;
  prompt_structure_id: string | null;
  prompt_structure_version: string | null;
  strategist_version: string | null;
  model_catalog_version: string | null;
  prompt_match_score: number | string | null;
  model_fit_score: number | string | null;
  workflow_fit_score: number | string | null;
  visual_quality_score: number | string | null;
  motion_score: number | string | null;
  camera_score: number | string | null;
  commercial_use_score: number | string | null;
  seo_potential_score: number | string | null;
  product_preservation_score: number | string | null;
  character_preservation_score: number | string | null;
  text_logo_accuracy_score: number | string | null;
  audio_lip_sync_score: number | string | null;
  qcm_answers_json: Record<string, unknown> | null;
  tags: string[] | null;
  blockers: string[] | null;
  improvement_suggestions: string[] | null;
  avoid_pattern_summary: string | null;
  notes: string | null;
  review_updated_at: string | null;
};

const VERDICTS: readonly PromptReviewVerdict[] = [
  'strong_example',
  'good_needs_prompt_tweak',
  'wrong_model',
  'wrong_workflow',
  'bad_result',
  'avoid_pattern',
  'seo_candidate',
];

const INTENTS: readonly PromptReviewIntent[] = [
  'product_ad',
  'social_ad',
  'cinematic_scene',
  'talking_avatar',
  'spokesperson',
  'character_animation',
  'product_reference_i2v',
  'person_reference_i2v',
  'video_to_video',
  'draft_storyboard',
  'seo_watch_page',
  'unknown',
];

const PRODUCT_PATTERN =
  /\b(product|ad|advert|commercial|perfume|bottle|packaging|label|sneaker|shoe|car|vehicle|watch|jewelry|skincare|cream|serum|sauce|food|dish|chef|headphones?|speaker|device|bag|cosmetic)\b/i;
const PERSON_PATTERN =
  /\b(person|people|human|face|avatar|spokesperson|influencer|creator|character|actor|talking|speaking|lip[-\s]?sync|dialogue|says?)\b/i;
const TEXT_LOGO_PATTERN = /\b(text|logo|label|typography|legal|copy|badge|plate|packaging|brand|readable|lettering)\b/i;
const AUDIO_PATTERN = /\b(audio|voice|voiceover|dialogue|sfx|sound|ambience|lip[-\s]?sync|spoken|says?|speaking)\b/i;

export function normalizePromptReviewVerdict(value: unknown): PromptReviewVerdict {
  return typeof value === 'string' && VERDICTS.includes(value as PromptReviewVerdict)
    ? (value as PromptReviewVerdict)
    : 'good_needs_prompt_tweak';
}

export function normalizePromptReviewIntent(value: unknown): PromptReviewIntent {
  return typeof value === 'string' && INTENTS.includes(value as PromptReviewIntent)
    ? (value as PromptReviewIntent)
    : 'unknown';
}

export function buildPromptReviewSignals(input: {
  prompt: string;
  workflow?: string | null;
  hasAudio?: boolean | null;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  settingsSnapshot?: unknown;
}): PromptReviewSignals {
  const settings = asRecord(input.settingsSnapshot);
  const refs = asRecord(settings?.refs);
  const core = asRecord(settings?.core);
  const prompt = input.prompt ?? '';
  const workflow = normalizeWorkflow(input.workflow ?? asString(settings?.inputMode));
  const resolution = asString(core?.resolution);
  const hasReferenceInput = Boolean(
    asString(refs?.imageUrl) ||
      asString(refs?.firstFrameUrl) ||
      asString(refs?.lastFrameUrl) ||
      asString(refs?.endImageUrl) ||
      asNonEmptyArray(refs?.referenceImages) ||
      asNonEmptyArray(refs?.videoUrls)
  );
  const hasProduct = PRODUCT_PATTERN.test(prompt);
  const hasPersonOrCharacter = PERSON_PATTERN.test(prompt);
  const hasTextLogoRisk = TEXT_LOGO_PATTERN.test(prompt);
  const hasAudioOrLipSync = Boolean(input.hasAudio) || AUDIO_PATTERN.test(prompt) || Boolean(asString(refs?.audioUrl));
  const adaptiveScoreKeys = [
    hasProduct ? 'productPreservationScore' : null,
    hasPersonOrCharacter ? 'characterPreservationScore' : null,
    hasTextLogoRisk ? 'textLogoAccuracyScore' : null,
    hasAudioOrLipSync ? 'audioLipSyncScore' : null,
  ].filter((value): value is string => Boolean(value));
  const suggestedTags = [
    hasProduct ? 'product' : null,
    hasPersonOrCharacter ? 'person-or-character' : null,
    hasTextLogoRisk ? 'text-logo-risk' : null,
    hasAudioOrLipSync ? 'audio-or-lipsync' : null,
    hasReferenceInput ? 'reference-input' : null,
    workflow,
  ].filter((value): value is string => Boolean(value));

  return {
    workflow,
    resolution,
    hasProduct,
    hasPersonOrCharacter,
    hasTextLogoRisk,
    hasAudioOrLipSync,
    hasReferenceInput,
    hasStableVideoUrl: isStablePublicMediaUrl(input.videoUrl),
    hasStableThumbUrl: isStablePublicMediaUrl(input.thumbUrl),
    adaptiveScoreKeys,
    suggestedTags,
  };
}

export async function isPromptIntelligenceStorageReady(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  try {
    const [row] = await query<{ reviews_table: string | null; patterns_table: string | null }>(
      `
        SELECT
          to_regclass('public.prompt_result_reviews')::text AS reviews_table,
          to_regclass('public.prompt_patterns')::text AS patterns_table
      `
    );
    return Boolean(row?.reviews_table && row?.patterns_table);
  } catch (error) {
    console.warn('[prompt-intelligence] failed to check storage schema', error);
    return false;
  }
}

export async function fetchPromptIntelligenceReviewQueue({
  limit = 50,
  reviewStatus = 'unreviewed',
  engineId = null,
  search = null,
}: PromptIntelligenceReviewFilters = {}): Promise<PromptIntelligenceReviewSummary[]> {
  if (!isDatabaseConfigured()) return [];
  if (!(await isPromptIntelligenceStorageReady())) return [];

  const { whereClause, values } = buildQueueWhere({ reviewStatus, engineId, search });
  values.push(Math.min(150, Math.max(1, limit)));

  const rows = await query<PromptReviewRow>(
    `
      ${baseReviewSelect()}
      ${whereClause}
      ORDER BY COALESCE(r.updated_at, j.created_at) DESC
      LIMIT $${values.length}
    `,
    values
  );

  return rows.map(mapSummaryRow);
}

export async function fetchPromptIntelligenceReviewCandidate(
  jobId: string
): Promise<PromptIntelligenceReviewCandidate | null> {
  if (!isDatabaseConfigured()) return null;
  if (!(await isPromptIntelligenceStorageReady())) return null;
  const normalizedJobId = jobId.trim();
  if (!normalizedJobId) return null;

  const rows = await query<PromptReviewDetailRow>(
    `
      ${baseReviewSelect({ detail: true })}
      WHERE j.job_id = $1
      LIMIT 1
    `,
    [normalizedJobId]
  );
  const row = rows[0];
  if (!row) return null;

  const video = mapGalleryVideoRow(row);
  const summary = mapSummaryRow(row);
  return {
    video,
    summary,
    review: mapReviewRow(row, summary),
    signals: summary.signals,
    settingsSnapshot: row.settings_snapshot ?? null,
  };
}

export async function savePromptResultReview(input: SavePromptResultReviewInput): Promise<string> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!(await isPromptIntelligenceStorageReady())) {
    throw new Error('Prompt intelligence tables are not installed');
  }

  const jobRows = await query<PromptReviewRow>(
    `
      ${baseReviewSelect()}
      WHERE j.job_id = $1
      LIMIT 1
    `,
    [input.jobId]
  );
  const row = jobRows[0];
  if (!row) {
    throw new Error('Completed video job not found');
  }

  const video = mapGalleryVideoRow(row);
  const snapshot = parseSnapshot(video);
  const workflow = normalizeWorkflow(snapshot.inputMode);
  const signals = buildPromptReviewSignals({
    prompt: snapshot.prompt || video.prompt,
    workflow,
    hasAudio: snapshot.core.audio ?? video.hasAudio,
    videoUrl: video.videoUrl,
    thumbUrl: video.thumbUrl,
    settingsSnapshot: row.settings_snapshot,
  });
  const qcmAnswersJson = {
    ...input.qcmAnswersJson,
    adaptiveScoreKeys: signals.adaptiveScoreKeys,
    signals: {
      hasProduct: signals.hasProduct,
      hasPersonOrCharacter: signals.hasPersonOrCharacter,
      hasTextLogoRisk: signals.hasTextLogoRisk,
      hasAudioOrLipSync: signals.hasAudioOrLipSync,
      hasReferenceInput: signals.hasReferenceInput,
    },
  };

  return withDbTransaction(async (executor) => {
    const reviewRows = await executor.query<{ id: string }>(
      `
        INSERT INTO prompt_result_reviews (
          job_id,
          video_id,
          user_id,
          engine_id,
          engine_label,
          workflow,
          duration_sec,
          aspect_ratio,
          resolution,
          prompt_text,
          negative_prompt,
          settings_snapshot,
          prompt_source,
          prompt_structure_id,
          prompt_structure_version,
          strategist_version,
          model_catalog_version,
          reviewer_type,
          reviewer_id,
          intent,
          verdict,
          overall_score,
          prompt_match_score,
          model_fit_score,
          workflow_fit_score,
          visual_quality_score,
          motion_score,
          camera_score,
          commercial_use_score,
          seo_potential_score,
          product_preservation_score,
          character_preservation_score,
          text_logo_accuracy_score,
          audio_lip_sync_score,
          qcm_answers_json,
          tags,
          blockers,
          improvement_suggestions,
          avoid_pattern_summary,
          notes,
          created_at,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,'admin',$18::uuid,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34::jsonb,$35::text[],$36::text[],$37::text[],$38,$39,NOW(),NOW()
        )
        ON CONFLICT (job_id) DO UPDATE SET
          engine_id = EXCLUDED.engine_id,
          engine_label = EXCLUDED.engine_label,
          workflow = EXCLUDED.workflow,
          duration_sec = EXCLUDED.duration_sec,
          aspect_ratio = EXCLUDED.aspect_ratio,
          resolution = EXCLUDED.resolution,
          prompt_text = EXCLUDED.prompt_text,
          negative_prompt = EXCLUDED.negative_prompt,
          settings_snapshot = EXCLUDED.settings_snapshot,
          prompt_source = EXCLUDED.prompt_source,
          prompt_structure_id = EXCLUDED.prompt_structure_id,
          prompt_structure_version = EXCLUDED.prompt_structure_version,
          strategist_version = EXCLUDED.strategist_version,
          model_catalog_version = EXCLUDED.model_catalog_version,
          reviewer_id = EXCLUDED.reviewer_id,
          intent = EXCLUDED.intent,
          verdict = EXCLUDED.verdict,
          overall_score = EXCLUDED.overall_score,
          prompt_match_score = EXCLUDED.prompt_match_score,
          model_fit_score = EXCLUDED.model_fit_score,
          workflow_fit_score = EXCLUDED.workflow_fit_score,
          visual_quality_score = EXCLUDED.visual_quality_score,
          motion_score = EXCLUDED.motion_score,
          camera_score = EXCLUDED.camera_score,
          commercial_use_score = EXCLUDED.commercial_use_score,
          seo_potential_score = EXCLUDED.seo_potential_score,
          product_preservation_score = EXCLUDED.product_preservation_score,
          character_preservation_score = EXCLUDED.character_preservation_score,
          text_logo_accuracy_score = EXCLUDED.text_logo_accuracy_score,
          audio_lip_sync_score = EXCLUDED.audio_lip_sync_score,
          qcm_answers_json = EXCLUDED.qcm_answers_json,
          tags = EXCLUDED.tags,
          blockers = EXCLUDED.blockers,
          improvement_suggestions = EXCLUDED.improvement_suggestions,
          avoid_pattern_summary = EXCLUDED.avoid_pattern_summary,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        RETURNING id
      `,
      [
        row.job_id,
        row.job_id,
        row.user_id,
        row.engine_id,
        row.engine_label,
        workflow,
        snapshot.core.durationSec ?? row.duration_sec,
        snapshot.core.aspectRatio ?? row.aspect_ratio,
        snapshot.core.resolution,
        snapshot.prompt || row.prompt,
        snapshot.negativePrompt,
        JSON.stringify(row.settings_snapshot ?? {}),
        normalizePromptSource(input.promptSource),
        trimOrNull(input.promptStructureId),
        trimOrNull(input.promptStructureVersion),
        trimOrNull(input.strategistVersion),
        trimOrNull(input.modelCatalogVersion),
        input.reviewerId,
        normalizePromptReviewIntent(input.intent),
        normalizePromptReviewVerdict(input.verdict),
        normalizeScore(input.overallScore),
        normalizeScore(input.promptMatchScore),
        normalizeScore(input.modelFitScore),
        normalizeScore(input.workflowFitScore),
        normalizeScore(input.visualQualityScore),
        normalizeScore(input.motionScore),
        normalizeScore(input.cameraScore),
        normalizeScore(input.commercialUseScore),
        normalizeScore(input.seoPotentialScore),
        normalizeScore(input.productPreservationScore),
        normalizeScore(input.characterPreservationScore),
        normalizeScore(input.textLogoAccuracyScore),
        normalizeScore(input.audioLipSyncScore),
        JSON.stringify(qcmAnswersJson),
        normalizeList(input.tags).slice(0, 20),
        normalizeList(input.blockers).slice(0, 20),
        normalizeList(input.improvementSuggestions).slice(0, 20),
        trimOrNull(input.avoidPatternSummary),
        trimOrNull(input.notes),
      ]
    );
    const reviewId = reviewRows[0]?.id;
    if (!reviewId) {
      throw new Error('Prompt review was not saved');
    }

    if (input.createPattern) {
      const verdict = normalizePromptReviewVerdict(input.verdict);
      const patternType = verdict === 'avoid_pattern' || verdict === 'bad_result' ? 'avoid' : 'recommended';
      await executor.query(
        `
          INSERT INTO prompt_patterns (
            source_review_id,
            type,
            title,
            description,
            engine_id,
            workflow,
            intent,
            prompt_structure_id,
            example_job_ids,
            reason,
            confidence_score,
            created_by,
            created_at,
            updated_at
          )
          VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10,$11,$12::uuid,NOW(),NOW())
        `,
        [
          reviewId,
          patternType,
          buildPatternTitle({ verdict, engineLabel: row.engine_label, intent: input.intent }),
          trimOrNull(input.avoidPatternSummary) ?? trimOrNull(input.notes) ?? '',
          row.engine_id,
          workflow,
          normalizePromptReviewIntent(input.intent),
          trimOrNull(input.promptStructureId),
          [row.job_id],
          normalizeList(input.improvementSuggestions).join('; ') || trimOrNull(input.notes) || '',
          normalizeScore(input.overallScore),
          input.reviewerId,
        ]
      );
    }

    return reviewId;
  });
}

function baseReviewSelect(options: { detail?: boolean } = {}): string {
  const detailSelect = options.detail
    ? `,
       r.prompt_source,
       r.prompt_structure_id,
       r.prompt_structure_version,
       r.strategist_version,
       r.model_catalog_version,
       r.prompt_match_score,
       r.model_fit_score,
       r.workflow_fit_score,
       r.visual_quality_score,
       r.motion_score,
       r.camera_score,
       r.commercial_use_score,
       r.seo_potential_score,
       r.product_preservation_score,
       r.character_preservation_score,
       r.text_logo_accuracy_score,
       r.audio_lip_sync_score,
       r.qcm_answers_json,
       r.tags,
       r.blockers,
       r.improvement_suggestions,
       r.avoid_pattern_summary,
       r.notes,
       r.updated_at AS review_updated_at`
    : '';

  return `
    SELECT
      j.job_id,
      j.user_id,
      j.engine_id,
      j.engine_label,
      j.duration_sec,
      j.prompt,
      COALESCE(NULLIF(j.thumb_url, ''), j.preview_frame) AS thumb_url,
      j.video_url,
      to_jsonb(j)->>'preview_video_url' AS preview_video_url,
      to_jsonb(j)->'keyframe_urls' AS keyframe_urls,
      j.aspect_ratio,
      j.has_audio,
      j.can_upscale,
      j.created_at,
      j.visibility,
      j.indexable,
      j.featured,
      j.featured_order,
      j.final_price_cents,
      j.currency,
      j.pricing_snapshot,
      j.settings_snapshot,
      r.id AS review_id,
      r.verdict AS review_verdict,
      r.overall_score AS review_overall_score,
      r.intent AS review_intent
      ${detailSelect}
    FROM app_jobs j
    LEFT JOIN prompt_result_reviews r ON r.job_id = j.job_id
  `;
}

function buildQueueWhere(filters: PromptIntelligenceReviewFilters): { whereClause: string; values: unknown[] } {
  const conditions = [
    `j.status = 'completed'`,
    `COALESCE(j.video_url, '') <> ''`,
    `COALESCE(j.surface, 'video') = 'video'`,
  ];
  const values: unknown[] = [];

  const reviewStatus = filters.reviewStatus ?? 'unreviewed';
  if (reviewStatus === 'unreviewed') {
    conditions.push('r.id IS NULL');
  } else if (reviewStatus === 'reviewed') {
    conditions.push('r.id IS NOT NULL');
  } else if (reviewStatus && reviewStatus !== 'all') {
    values.push(normalizePromptReviewVerdict(reviewStatus));
    conditions.push(`r.verdict = $${values.length}`);
  }

  if (filters.engineId?.trim()) {
    values.push(filters.engineId.trim());
    conditions.push(`j.engine_id = $${values.length}`);
  }

  if (filters.search?.trim()) {
    values.push(`%${filters.search.trim()}%`);
    conditions.push(`(
      j.job_id ILIKE $${values.length}
      OR j.engine_id ILIKE $${values.length}
      OR j.engine_label ILIKE $${values.length}
      OR j.prompt ILIKE $${values.length}
    )`);
  }

  return { whereClause: `WHERE ${conditions.join(' AND ')}`, values };
}

function mapSummaryRow(row: PromptReviewRow): PromptIntelligenceReviewSummary {
  const video = mapGalleryVideoRow(row);
  const snapshot = parseSnapshot(video);
  const workflow = normalizeWorkflow(snapshot.inputMode);
  const signals = buildPromptReviewSignals({
    prompt: snapshot.prompt || row.prompt,
    workflow,
    hasAudio: snapshot.core.audio ?? Boolean(row.has_audio),
    videoUrl: row.video_url,
    thumbUrl: row.thumb_url,
    settingsSnapshot: row.settings_snapshot,
  });

  return {
    jobId: row.job_id,
    videoId: row.job_id,
    userId: row.user_id,
    engineId: row.engine_id,
    engineLabel: row.engine_label,
    workflow,
    durationSec: snapshot.core.durationSec ?? row.duration_sec ?? null,
    aspectRatio: snapshot.core.aspectRatio ?? row.aspect_ratio ?? null,
    resolution: snapshot.core.resolution,
    promptText: snapshot.prompt || row.prompt,
    promptExcerpt: excerpt(snapshot.prompt || row.prompt),
    videoUrl: row.video_url ? normalizeMediaUrl(row.video_url) : null,
    thumbUrl: row.thumb_url ? normalizeMediaUrl(row.thumb_url) : null,
    previewVideoUrl: row.preview_video_url ? normalizeMediaUrl(row.preview_video_url) : null,
    createdAt: row.created_at,
    hasReview: Boolean(row.review_id),
    verdict: row.review_verdict ? normalizePromptReviewVerdict(row.review_verdict) : null,
    overallScore: coerceNullableNumber(row.review_overall_score),
    intent: normalizePromptReviewIntent(row.review_intent),
    signals,
  };
}

function mapReviewRow(row: PromptReviewDetailRow, summary: PromptIntelligenceReviewSummary): PromptResultReview | null {
  if (!row.review_id) return null;
  const snapshot = parseSnapshot(mapGalleryVideoRow(row));

  return {
    id: row.review_id,
    jobId: row.job_id,
    videoId: row.job_id,
    engineId: row.engine_id,
    engineLabel: row.engine_label,
    workflow: summary.workflow,
    durationSec: summary.durationSec,
    aspectRatio: summary.aspectRatio,
    resolution: summary.resolution,
    promptText: snapshot.prompt || row.prompt,
    negativePrompt: snapshot.negativePrompt,
    promptSource: row.prompt_source ?? 'manual',
    promptStructureId: row.prompt_structure_id,
    promptStructureVersion: row.prompt_structure_version,
    strategistVersion: row.strategist_version,
    modelCatalogVersion: row.model_catalog_version,
    intent: normalizePromptReviewIntent(row.review_intent),
    verdict: normalizePromptReviewVerdict(row.review_verdict),
    overallScore: coerceNullableNumber(row.review_overall_score),
    promptMatchScore: coerceNullableNumber(row.prompt_match_score),
    modelFitScore: coerceNullableNumber(row.model_fit_score),
    workflowFitScore: coerceNullableNumber(row.workflow_fit_score),
    visualQualityScore: coerceNullableNumber(row.visual_quality_score),
    motionScore: coerceNullableNumber(row.motion_score),
    cameraScore: coerceNullableNumber(row.camera_score),
    commercialUseScore: coerceNullableNumber(row.commercial_use_score),
    seoPotentialScore: coerceNullableNumber(row.seo_potential_score),
    productPreservationScore: coerceNullableNumber(row.product_preservation_score),
    characterPreservationScore: coerceNullableNumber(row.character_preservation_score),
    textLogoAccuracyScore: coerceNullableNumber(row.text_logo_accuracy_score),
    audioLipSyncScore: coerceNullableNumber(row.audio_lip_sync_score),
    qcmAnswersJson: row.qcm_answers_json ?? {},
    tags: normalizeList(row.tags),
    blockers: normalizeList(row.blockers),
    improvementSuggestions: normalizeList(row.improvement_suggestions),
    avoidPatternSummary: row.avoid_pattern_summary,
    notes: row.notes,
    updatedAt: row.review_updated_at ?? row.created_at,
  };
}

function normalizeWorkflow(value: unknown): string {
  const workflow = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (workflow === 't2v' || workflow === 'text-to-video') return 'text-to-video';
  if (workflow === 'i2v' || workflow === 'image-to-video') return 'image-to-video';
  if (workflow === 'v2v' || workflow === 'video-to-video' || workflow === 'reframe' || workflow === 'extend' || workflow === 'retake') {
    return 'video-to-video';
  }
  if (workflow === 'ref2v' || workflow === 'reference-to-video') return 'reference-to-video';
  if (workflow === 'fl2v' || workflow === 'first-last-frame') return 'first-last-frame';
  if (workflow === 'a2v' || workflow === 'audio-to-video') return 'audio-to-video';
  return workflow || 'unknown';
}

function normalizePromptSource(value: unknown): string {
  const source = typeof value === 'string' ? value.trim() : '';
  return ['manual', 'ai_strategist', 'prompt_improver', 'template', 'admin', 'unknown'].includes(source) ? source : 'unknown';
}

function buildPatternTitle(input: { verdict: PromptReviewVerdict; engineLabel: string; intent: string }): string {
  const label = input.verdict === 'avoid_pattern' || input.verdict === 'bad_result' ? 'Avoid' : 'Recommended';
  return `${label}: ${input.engineLabel} ${normalizePromptReviewIntent(input.intent)}`.replace(/_/g, ' ');
}

function normalizeScore(value: unknown): number | null {
  const parsed = coerceNullableNumber(value);
  if (parsed === null) return null;
  return Math.max(1, Math.min(5, Math.round(parsed)));
}

function coerceNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter(Boolean);
}

function trimOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function excerpt(value: string, max = 180): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}
