BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_strategist_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_session_id TEXT NOT NULL,
  user_id UUID,
  surface TEXT NOT NULL DEFAULT 'app_sidebar',
  status TEXT NOT NULL DEFAULT 'open',
  current_stage TEXT,
  first_user_message TEXT,
  last_user_message TEXT,
  last_assistant_message TEXT,
  last_selected_model TEXT,
  last_selected_workflow TEXT,
  last_selected_tier TEXT,
  last_prompt TEXT,
  last_negative_prompt TEXT,
  total_turns INTEGER NOT NULL DEFAULT 0,
  estimated_llm_cost_usd NUMERIC(12, 6),
  prompt_applied BOOLEAN NOT NULL DEFAULT FALSE,
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  review_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  reviewer_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_strategist_conversations_status_check
    CHECK (status IN ('open', 'prompt_ready', 'applied', 'abandoned', 'archived')),
  CONSTRAINT ai_strategist_conversations_review_status_check
    CHECK (review_status IN ('unreviewed', 'reviewed', 'flagged', 'training_candidate', 'ignored'))
);

CREATE TABLE IF NOT EXISTS ai_strategist_conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_strategist_conversations(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  user_id UUID,
  role TEXT NOT NULL DEFAULT 'assistant',
  user_message TEXT,
  assistant_message TEXT,
  mode TEXT,
  conversation_stage TEXT,
  conversation_plan JSONB,
  orchestration_plan JSONB,
  normalized_brief JSONB,
  recommendations JSONB,
  also_consider JSONB,
  selected_model TEXT,
  selected_workflow TEXT,
  selected_tier TEXT,
  uploaded_asset JSONB,
  page_context JSONB,
  prompt_generation_context_summary JSONB,
  sanitized_final_output JSONB,
  warnings TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  validation_issues_before JSONB,
  validation_issues_after JSONB,
  ui_actions JSONB,
  llm JSONB,
  llm_cost JSONB,
  safety JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, turn_index)
);

CREATE INDEX IF NOT EXISTS ai_strategist_conversations_user_created_idx
  ON ai_strategist_conversations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_strategist_conversations_session_idx
  ON ai_strategist_conversations (client_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_strategist_conversations_review_status_idx
  ON ai_strategist_conversations (review_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_strategist_conversations_model_idx
  ON ai_strategist_conversations (last_selected_model, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_strategist_conversations_stage_idx
  ON ai_strategist_conversations (current_stage, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_strategist_conversation_turns_conversation_created_idx
  ON ai_strategist_conversation_turns (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS ai_strategist_conversation_turns_model_idx
  ON ai_strategist_conversation_turns (selected_model, created_at DESC);

COMMIT;
