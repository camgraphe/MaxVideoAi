import { query } from '@/lib/db';

/** Generation/bootstrap mutation owner; never called from a polling GET. */
export async function ensureOpenAIImageResultsSchema(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS app_openai_image_results (
    job_id TEXT PRIMARY KEY REFERENCES app_jobs(job_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, provider_request_id TEXT,
    state TEXT NOT NULL CHECK (state IN ('awaiting_response', 'received', 'needs_review', 'completed')),
    completion_context JSONB NOT NULL, images JSONB NOT NULL DEFAULT '[]'::jsonb,
    response_complete BOOLEAN NOT NULL DEFAULT FALSE, stored_images JSONB NOT NULL DEFAULT '[]'::jsonb,
    lease_token TEXT, lease_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await query(`CREATE INDEX IF NOT EXISTS app_openai_image_results_recovery_idx
    ON app_openai_image_results(updated_at) WHERE state = 'received'`);
}
