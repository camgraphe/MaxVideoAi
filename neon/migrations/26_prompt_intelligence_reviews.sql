BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS prompt_result_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL REFERENCES app_jobs(job_id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  user_id TEXT,
  engine_id TEXT NOT NULL,
  engine_label TEXT NOT NULL,
  workflow TEXT NOT NULL DEFAULT 'unknown',
  duration_sec INTEGER,
  aspect_ratio TEXT,
  resolution TEXT,
  prompt_text TEXT NOT NULL,
  negative_prompt TEXT,
  settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (prompt_source IN ('manual', 'ai_strategist', 'prompt_improver', 'template', 'admin', 'unknown')),
  prompt_structure_id TEXT,
  prompt_structure_version TEXT,
  strategist_version TEXT,
  model_catalog_version TEXT,
  reviewer_type TEXT NOT NULL DEFAULT 'admin'
    CHECK (reviewer_type IN ('admin', 'customer', 'auto')),
  reviewer_id UUID,
  intent TEXT NOT NULL DEFAULT 'unknown',
  verdict TEXT NOT NULL DEFAULT 'good_needs_prompt_tweak'
    CHECK (
      verdict IN (
        'strong_example',
        'good_needs_prompt_tweak',
        'wrong_model',
        'wrong_workflow',
        'bad_result',
        'avoid_pattern',
        'seo_candidate'
      )
    ),
  overall_score SMALLINT CHECK (overall_score BETWEEN 1 AND 5),
  prompt_match_score SMALLINT CHECK (prompt_match_score BETWEEN 1 AND 5),
  model_fit_score SMALLINT CHECK (model_fit_score BETWEEN 1 AND 5),
  workflow_fit_score SMALLINT CHECK (workflow_fit_score BETWEEN 1 AND 5),
  visual_quality_score SMALLINT CHECK (visual_quality_score BETWEEN 1 AND 5),
  motion_score SMALLINT CHECK (motion_score BETWEEN 1 AND 5),
  camera_score SMALLINT CHECK (camera_score BETWEEN 1 AND 5),
  commercial_use_score SMALLINT CHECK (commercial_use_score BETWEEN 1 AND 5),
  seo_potential_score SMALLINT CHECK (seo_potential_score BETWEEN 1 AND 5),
  product_preservation_score SMALLINT CHECK (product_preservation_score BETWEEN 1 AND 5),
  character_preservation_score SMALLINT CHECK (character_preservation_score BETWEEN 1 AND 5),
  text_logo_accuracy_score SMALLINT CHECK (text_logo_accuracy_score BETWEEN 1 AND 5),
  audio_lip_sync_score SMALLINT CHECK (audio_lip_sync_score BETWEEN 1 AND 5),
  qcm_answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  blockers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  improvement_suggestions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  avoid_pattern_summary TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id)
);

CREATE TABLE IF NOT EXISTS prompt_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_review_id UUID REFERENCES prompt_result_reviews(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('recommended', 'avoid')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  engine_id TEXT,
  workflow TEXT,
  intent TEXT,
  prompt_structure_id TEXT,
  example_job_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  reason TEXT NOT NULL DEFAULT '',
  confidence_score SMALLINT CHECK (confidence_score BETWEEN 1 AND 5),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prompt_result_reviews_engine_idx
  ON prompt_result_reviews (engine_id, workflow, updated_at DESC);

CREATE INDEX IF NOT EXISTS prompt_result_reviews_verdict_idx
  ON prompt_result_reviews (verdict, updated_at DESC);

CREATE INDEX IF NOT EXISTS prompt_result_reviews_intent_idx
  ON prompt_result_reviews (intent, updated_at DESC);

CREATE INDEX IF NOT EXISTS prompt_result_reviews_overall_idx
  ON prompt_result_reviews (overall_score DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS prompt_patterns_lookup_idx
  ON prompt_patterns (type, engine_id, workflow, intent, status);

COMMIT;
