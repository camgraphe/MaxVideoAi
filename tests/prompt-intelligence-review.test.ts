import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migrationPath = join(root, 'neon/migrations/26_prompt_intelligence_reviews.sql');
const serverPath = join(root, 'frontend/server/prompt-intelligence.ts');
const navPath = join(root, 'frontend/lib/admin/navigation.ts');
const pagePath = join(root, 'frontend/app/(core)/admin/prompt-intelligence/page.tsx');
const viewPath = join(root, 'frontend/app/(core)/admin/prompt-intelligence/_components/PromptIntelligenceReviewView.tsx');
const formPath = join(root, 'frontend/app/(core)/admin/prompt-intelligence/_components/PromptIntelligenceReviewForm.tsx');
const actionsPath = join(root, 'frontend/app/(core)/admin/prompt-intelligence/_actions.ts');
const formatPath = join(root, 'frontend/app/(core)/admin/prompt-intelligence/_lib/prompt-intelligence-format.ts');

async function loadPromptIntelligenceModule() {
  try {
    return await import('../frontend/server/prompt-intelligence.ts');
  } catch (error) {
    assert.fail(`Expected prompt intelligence server module to be importable: ${(error as Error).message}`);
  }
}

test('prompt intelligence migration creates review and pattern storage', () => {
  assert.equal(existsSync(migrationPath), true, 'expected prompt intelligence Neon migration');
  const source = readFileSync(migrationPath, 'utf8');

  assert.match(source, /CREATE TABLE IF NOT EXISTS prompt_result_reviews/i);
  assert.match(source, /CREATE TABLE IF NOT EXISTS prompt_patterns/i);
  assert.match(source, /job_id TEXT NOT NULL REFERENCES app_jobs\(job_id\)/i);
  assert.match(source, /prompt_source/i);
  assert.match(source, /prompt_structure_id/i);
  assert.match(source, /model_catalog_version/i);
  assert.match(source, /overall_score/i);
  assert.match(source, /prompt_match_score/i);
  assert.match(source, /model_fit_score/i);
  assert.match(source, /workflow_fit_score/i);
  assert.match(source, /product_preservation_score/i);
  assert.match(source, /text_logo_accuracy_score/i);
  assert.match(source, /audio_lip_sync_score/i);
  assert.match(source, /qcm_answers_json/i);
  assert.match(source, /verdict/i);
  assert.match(source, /strong_example/i);
  assert.match(source, /avoid_pattern/i);
  assert.match(source, /recommended|avoid/i);
  assert.match(source, /CREATE INDEX IF NOT EXISTS prompt_result_reviews_engine_idx/i);
  assert.match(source, /CREATE INDEX IF NOT EXISTS prompt_patterns_lookup_idx/i);
  assert.doesNotMatch(source, /video_binary|media_bytes|uploaded_file/i, 'review storage should not persist media binaries');
});

test('prompt intelligence server module exposes review queue and adaptive QCM contracts', async () => {
  assert.equal(existsSync(serverPath), true, 'expected prompt intelligence server module');
  const source = readFileSync(serverPath, 'utf8');

  assert.match(source, /export async function isPromptIntelligenceStorageReady/);
  assert.match(source, /export async function fetchPromptIntelligenceReviewQueue/);
  assert.match(source, /export async function fetchPromptIntelligenceReviewCandidate/);
  assert.match(source, /export async function savePromptResultReview/);
  assert.match(source, /export function buildPromptReviewSignals/);
  assert.match(source, /export function normalizePromptReviewVerdict/);
  assert.match(source, /parseSnapshot/);
  assert.match(source, /isStablePublicMediaUrl/);
  assert.match(source, /prompt_result_reviews/);
  assert.match(source, /prompt_patterns/);

  const module = await loadPromptIntelligenceModule();
  const signals = module.buildPromptReviewSignals({
    prompt: 'A 9:16 influencer holds headphones and says the sound is amazing with clean lip sync.',
    workflow: 'image-to-video',
    hasAudio: true,
    settingsSnapshot: {
      refs: { imageUrl: 'https://cdn.maxvideoai.test/product.jpg' },
      core: { resolution: '1080p', aspectRatio: '9:16' },
    },
  });

  assert.equal(signals.hasProduct, true);
  assert.equal(signals.hasPersonOrCharacter, true);
  assert.equal(signals.hasAudioOrLipSync, true);
  assert.equal(signals.hasReferenceInput, true);
  assert.equal(signals.adaptiveScoreKeys.includes('productPreservationScore'), true);
  assert.equal(signals.adaptiveScoreKeys.includes('characterPreservationScore'), true);
  assert.equal(signals.adaptiveScoreKeys.includes('audioLipSyncScore'), true);
});

test('prompt intelligence admin route is internal, thin, and review-focused', () => {
  for (const file of [pagePath, viewPath, formPath, actionsPath, formatPath]) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }

  const pageSource = readFileSync(pagePath, 'utf8');
  const viewSource = readFileSync(viewPath, 'utf8');
  const formSource = readFileSync(formPath, 'utf8');
  const actionsSource = readFileSync(actionsPath, 'utf8');
  const formatSource = readFileSync(formatPath, 'utf8');
  const navSource = readFileSync(navPath, 'utf8');

  assert.match(pageSource, /requireAdmin\(\)/);
  assert.match(pageSource, /isPromptIntelligenceStorageReady/);
  assert.match(pageSource, /fetchPromptIntelligenceReviewQueue/);
  assert.match(pageSource, /fetchPromptIntelligenceReviewCandidate/);
  assert.match(pageSource, /PromptIntelligenceReviewView/);
  assert.doesNotMatch(pageSource, /<table|AdminDataTable/);
  assert.ok(pageSource.split('\n').length <= 120, 'prompt intelligence page should stay a thin route');

  assert.match(viewSource, /export function PromptIntelligenceReviewView/);
  assert.match(viewSource, /Review board/);
  assert.match(viewSource, /QueueCardGrid/);
  assert.match(viewSource, /QuickScoreActions/);
  assert.match(viewSource, /one_click/);
  assert.match(viewSource, /Strong/);
  assert.match(viewSource, /Avoid/);
  assert.match(viewSource, /Best prompts/);
  assert.match(viewSource, /Avoid patterns/);
  assert.match(formSource, /Prompt match/);
  assert.match(formSource, /Model fit/);
  assert.match(formSource, /Workflow fit/);
  assert.match(formSource, /Product preservation/);
  assert.match(formSource, /Text\/logo accuracy/);
  assert.match(formSource, /Audio\/lip-sync/);
  assert.match(formSource, /Save and next/);
  assert.match(actionsSource, /'use server'/);
  assert.match(actionsSource, /savePromptResultReview/);
  assert.match(actionsSource, /requireAdmin/);
  assert.match(formatSource, /parsePromptReviewTags/);
  assert.match(navSource, /prompt-intelligence/);
});
