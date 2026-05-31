import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migrationPath = join(root, 'neon/migrations/25_ai_strategist_conversations.sql');
const serverPath = join(root, 'frontend/server/ai-strategist-conversations.ts');
const betaRoutePath = join(root, 'frontend/app/api/ai-video-strategist/beta/route.ts');
const betaApplyRoutePath = join(root, 'frontend/app/api/ai-video-strategist/beta/apply/route.ts');
const betaResponsePath = join(root, 'frontend/lib/ai-strategist/beta-response.ts');
const navPath = join(root, 'frontend/lib/admin/navigation.ts');
const sidebarPath = join(root, 'frontend/components/admin/SidebarNav.tsx');
const pagePath = join(root, 'frontend/app/(core)/admin/ai-strategist-conversations/page.tsx');
const detailPagePath = join(root, 'frontend/app/(core)/admin/ai-strategist-conversations/[conversationId]/page.tsx');
const viewPath = join(root, 'frontend/app/(core)/admin/ai-strategist-conversations/_components/AiStrategistConversationReviewView.tsx');
const detailViewPath = join(root, 'frontend/app/(core)/admin/ai-strategist-conversations/_components/AiStrategistConversationDetailView.tsx');
const formatPath = join(root, 'frontend/app/(core)/admin/ai-strategist-conversations/_lib/ai-strategist-conversation-format.ts');
const actionsPath = join(root, 'frontend/app/(core)/admin/ai-strategist-conversations/_actions.ts');
const widgetPath = join(root, 'frontend/components/ai-strategist/AiStrategistBetaSidebarWidget.tsx');

async function loadConversationModule() {
  try {
    return await import('../frontend/server/ai-strategist-conversations.ts');
  } catch (error) {
    assert.fail(`Expected AI Strategist conversation persistence module to be importable: ${(error as Error).message}`);
  }
}

test('AI Strategist conversation review migration creates reviewable conversation tables', () => {
  assert.equal(existsSync(migrationPath), true, 'expected Neon migration for strategist conversations');
  const source = readFileSync(migrationPath, 'utf8');

  assert.match(source, /CREATE TABLE IF NOT EXISTS ai_strategist_conversations/i);
  assert.match(source, /CREATE TABLE IF NOT EXISTS ai_strategist_conversation_turns/i);
  assert.match(source, /review_status/i);
  assert.match(source, /review_tags/i);
  assert.match(source, /reviewer_notes/i);
  assert.match(source, /uploaded_asset/i);
  assert.match(source, /prompt_generation_context_summary/i);
  assert.match(source, /sanitized_final_output/i);
  assert.match(source, /llm_cost/i);
  assert.match(source, /CONSTRAINT ai_strategist_conversations_review_status_check/i);
  assert.match(source, /CREATE INDEX IF NOT EXISTS ai_strategist_conversations_review_status_idx/i);
  assert.match(source, /CREATE INDEX IF NOT EXISTS ai_strategist_conversation_turns_conversation_created_idx/i);
  assert.doesNotMatch(source, /uploaded_file|file_binary|asset_bytes/i, 'migration should store metadata, not uploaded file blobs');
});

test('AI Strategist conversation payload keeps review data but avoids raw debug blobs', async () => {
  const module = await loadConversationModule();
  const payload = module.buildAiStrategistConversationRecord({
    conversationId: 'not-a-valid-uuid',
    clientSessionId: 'local-session-1',
    userId: '11111111-1111-4111-8111-111111111111',
    visibleUserText: 'Luxury perfume ad',
    request: {
      userMessage: 'Luxury perfume ad',
      mode: 'recommend',
      pageContext: {
        pathname: '/app',
        currentPrompt: 'should not be stored from page context',
        unrelatedSecret: 'should not survive',
      },
      uploadedAsset: {
        type: 'image',
        hasProduct: true,
        hasPerson: false,
        isReferenceImage: true,
      },
    },
    result: {
      assistantMessage: 'I recommend Kling.',
      mode: 'recommend',
      workflow: 'text-to-image-then-image-to-video',
      selectedModel: 'kling-3-pro',
      selectedTier: 'best',
      conversationStage: 'awaiting_model_choice',
      conversationPlan: { action: 'recommend_models' },
      normalizedBrief: { normalizedBrief: 'Premium perfume ad', intent: 'product_ad', confidence: 0.9 },
      recommendations: { best: { model: { id: 'kling-3-pro', label: 'Kling 3 Pro' }, reason: 'Product realism.' } },
      promptGenerationContext: { shouldNotPersist: true },
      promptGenerationContextSummary: { selectedModel: 'kling-3-pro', selectedWorkflow: 'text-to-image-then-image-to-video' },
      sanitizedFinalOutput: {
        finalPrompt: 'Starting image prompt:\nProduct bottle.\n\nVideo animation prompt:\nPush in.',
        negativePrompt: 'No warped label.',
        settings: ['8 seconds', '1080p'],
        warnings: ['Labels may drift.'],
        uiActions: [{ type: 'SET_PROMPT', value: 'Prompt' }],
      },
      warnings: ['Labels may drift.'],
      validationIssuesBeforeSanitizer: { prompt: [{ code: 'overclaim' }] },
      validationIssuesAfterSanitizer: { prompt: [] },
      uiActions: [{ type: 'SET_MODEL', value: 'kling-3-pro' }],
      llm: { promptWriter: { used: true, model: 'gemini-3.1-flash-lite' } },
      llmCost: { formattedTotal: '$0.01', totalUsd: 0.01 },
      safety: { autoGeneration: false, creditSpend: false, publishing: false, uiActionsApplied: false },
    },
  });

  assert.match(payload.conversation.id, /^[0-9a-f-]{36}$/i);
  assert.equal(payload.conversation.clientSessionId, 'local-session-1');
  assert.equal(payload.conversation.lastSelectedModel, 'kling-3-pro');
  assert.equal(payload.turn.userMessage, 'Luxury perfume ad');
  assert.equal(payload.turn.assistantMessage, 'I recommend Kling.');
  assert.deepEqual(payload.turn.uploadedAsset, {
    type: 'image',
    hasPerson: false,
    hasProduct: true,
    hasLogo: false,
    hasText: false,
    isReferenceImage: true,
  });
  assert.deepEqual(payload.turn.pageContext, { pathname: '/app', surface: null });
  assert.equal('promptGenerationContext' in payload.turn, false);
  assert.equal(payload.turn.promptGenerationContextSummary.selectedModel, 'kling-3-pro');
  assert.equal(payload.turn.sanitizedFinalOutput.finalPrompt.includes('Starting image prompt:'), true);
});

test('AI Strategist beta route persists review turns without blocking the chat response', () => {
  const routeSource = readFileSync(betaRoutePath, 'utf8');
  const responseSource = readFileSync(betaResponsePath, 'utf8');

  assert.match(routeSource, /getUserIdFromRequest/);
  assert.match(routeSource, /recordAiStrategistConversationTurn/);
  assert.match(routeSource, /conversationId: persistedTurn\?\.conversationId/);
  assert.match(responseSource, /conversationId\?: string/);
  assert.match(responseSource, /conversationTurnId\?: string/);
});

test('AI Strategist apply telemetry marks review conversations without running generation', () => {
  assert.equal(existsSync(betaApplyRoutePath), true, 'expected beta apply telemetry route');

  const serverSource = readFileSync(serverPath, 'utf8');
  const routeSource = readFileSync(betaApplyRoutePath, 'utf8');
  const widgetSource = readFileSync(widgetPath, 'utf8');

  assert.match(serverSource, /export async function markAiStrategistConversationApplied/);
  assert.match(serverSource, /export async function isAiStrategistConversationReviewStorageReady/);
  assert.match(serverSource, /to_regclass\('public\.ai_strategist_conversations'\)/);
  assert.match(routeSource, /isAiStrategistBetaApiEnabled/);
  assert.match(routeSource, /markAiStrategistConversationApplied/);
  assert.match(routeSource, /getUserIdFromRequest/);
  assert.match(routeSource, /NextResponse\.json\(\{ ok: true/);
  assert.match(widgetSource, /recordAiStrategistApplyDecision/);
  assert.match(widgetSource, /\/api\/ai-video-strategist\/beta\/apply/);
  assert.doesNotMatch(routeSource, /startRender|generateVideo|spendCredits/);
  assert.doesNotMatch(widgetSource, /startRender/);
});

test('AI Strategist review admin route follows admin route contracts', () => {
  for (const file of [pagePath, detailPagePath, viewPath, detailViewPath, formatPath, actionsPath]) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }

  const pageSource = readFileSync(pagePath, 'utf8');
  const detailPageSource = readFileSync(detailPagePath, 'utf8');
  const viewSource = readFileSync(viewPath, 'utf8');
  const detailViewSource = readFileSync(detailViewPath, 'utf8');
  const formatSource = readFileSync(formatPath, 'utf8');
  const actionsSource = readFileSync(actionsPath, 'utf8');
  const navSource = readFileSync(navPath, 'utf8');
  const sidebarSource = readFileSync(sidebarPath, 'utf8');

  assert.match(pageSource, /requireAdmin\(\)/);
  assert.match(pageSource, /isAiStrategistConversationReviewStorageReady/);
  assert.match(pageSource, /AI Strategist review tables are not installed yet/);
  assert.match(pageSource, /fetchAiStrategistConversationReviews/);
  assert.match(pageSource, /AiStrategistConversationReviewView/);
  assert.doesNotMatch(pageSource, /AdminDataTable/);
  assert.ok(pageSource.split('\n').length <= 85, 'list page should stay a thin server route');

  assert.match(detailPageSource, /requireAdmin\(\)/);
  assert.match(detailPageSource, /fetchAiStrategistConversationReviewDetail/);
  assert.match(detailPageSource, /AiStrategistConversationDetailView/);
  assert.doesNotMatch(detailPageSource, /AdminDataTable/);
  assert.ok(detailPageSource.split('\n').length <= 90, 'detail page should stay a thin server route');

  assert.match(viewSource, /export function AiStrategistConversationReviewView/);
  assert.match(viewSource, /AdminPageHeader/);
  assert.match(viewSource, /AdminDataTable/);
  assert.match(detailViewSource, /export function AiStrategistConversationDetailView/);
  assert.match(detailViewSource, /reviewAction/);
  assert.match(formatSource, /export function formatConversationDate/);
  assert.match(formatSource, /export function formatReviewStatusLabel/);
  assert.match(actionsSource, /'use server'/);
  assert.match(actionsSource, /updateAiStrategistConversationReview/);
  assert.match(navSource, /ai-strategist-conversations/);
  assert.match(sidebarSource, /MessageSquareText/);
});
