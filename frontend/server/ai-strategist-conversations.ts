import { randomUUID } from 'node:crypto';

import { isDatabaseConfigured, query, withDbTransaction } from '@/lib/db';
import { getUserIdentity } from '@/server/supabase-admin';
import type { AiStrategistPlaygroundInput } from '@/lib/ai-strategist/playground-pipeline';

export type AiStrategistReviewStatus =
  | 'unreviewed'
  | 'reviewed'
  | 'flagged'
  | 'training_candidate'
  | 'ignored';

export type AiStrategistConversationRecordInput = {
  conversationId?: string | null;
  clientSessionId?: string | null;
  userId?: string | null;
  visibleUserText?: string | null;
  request: AiStrategistPlaygroundInput;
  result: Record<string, unknown>;
};

export type AiStrategistConversationRecord = {
  conversation: {
    id: string;
    clientSessionId: string;
    userId: string | null;
    surface: string;
    status: string;
    currentStage: string | null;
    firstUserMessage: string | null;
    lastUserMessage: string | null;
    lastAssistantMessage: string | null;
    lastSelectedModel: string | null;
    lastSelectedWorkflow: string | null;
    lastSelectedTier: string | null;
    lastPrompt: string | null;
    lastNegativePrompt: string | null;
    estimatedLlmCostUsd: number | null;
    promptApplied: boolean;
  };
  turn: {
    userId: string | null;
    role: 'assistant';
    userMessage: string | null;
    assistantMessage: string | null;
    mode: string | null;
    conversationStage: string | null;
    conversationPlan: unknown;
    orchestrationPlan: unknown;
    normalizedBrief: unknown;
    recommendations: unknown;
    alsoConsider: unknown;
    selectedModel: string | null;
    selectedWorkflow: string | null;
    selectedTier: string | null;
    uploadedAsset: SanitizedUploadedAsset | null;
    pageContext: SanitizedPageContext | null;
    promptGenerationContextSummary: Record<string, unknown> | null;
    sanitizedFinalOutput: Record<string, unknown> | null;
    warnings: string[];
    validationIssuesBefore: unknown;
    validationIssuesAfter: unknown;
    uiActions: unknown;
    llm: unknown;
    llmCost: unknown;
    safety: unknown;
  };
};

export type AiStrategistConversationReviewSummary = {
  id: string;
  clientSessionId: string;
  userId: string | null;
  userEmail: string | null;
  surface: string;
  status: string;
  currentStage: string | null;
  firstUserMessage: string | null;
  lastUserMessage: string | null;
  lastAssistantMessage: string | null;
  lastSelectedModel: string | null;
  lastSelectedWorkflow: string | null;
  lastSelectedTier: string | null;
  totalTurns: number;
  estimatedLlmCostUsd: number | null;
  promptApplied: boolean;
  reviewStatus: AiStrategistReviewStatus;
  reviewTags: string[];
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiStrategistConversationTurnReview = {
  id: string;
  turnIndex: number;
  userMessage: string | null;
  assistantMessage: string | null;
  mode: string | null;
  conversationStage: string | null;
  conversationPlan: Record<string, unknown> | null;
  orchestrationPlan: Record<string, unknown> | null;
  normalizedBrief: Record<string, unknown> | null;
  recommendations: Record<string, unknown> | null;
  alsoConsider: unknown;
  selectedModel: string | null;
  selectedWorkflow: string | null;
  selectedTier: string | null;
  uploadedAsset: SanitizedUploadedAsset | null;
  pageContext: SanitizedPageContext | null;
  promptGenerationContextSummary: Record<string, unknown> | null;
  sanitizedFinalOutput: Record<string, unknown> | null;
  warnings: string[];
  validationIssuesBefore: unknown;
  validationIssuesAfter: unknown;
  uiActions: unknown;
  llm: unknown;
  llmCost: unknown;
  safety: unknown;
  createdAt: string;
};

export type AiStrategistConversationReviewDetail = {
  conversation: AiStrategistConversationReviewSummary;
  turns: AiStrategistConversationTurnReview[];
};

export type AiStrategistConversationReviewFilters = {
  limit?: number;
  reviewStatus?: AiStrategistReviewStatus | 'all' | null;
  selectedModel?: string | null;
  search?: string | null;
};

type PersistedTurnRow = {
  conversation_id: string;
  turn_id: string;
};

type ConversationRow = {
  id: string;
  client_session_id: string;
  user_id: string | null;
  surface: string;
  status: string;
  current_stage: string | null;
  first_user_message: string | null;
  last_user_message: string | null;
  last_assistant_message: string | null;
  last_selected_model: string | null;
  last_selected_workflow: string | null;
  last_selected_tier: string | null;
  last_prompt: string | null;
  last_negative_prompt: string | null;
  total_turns: number | string | null;
  estimated_llm_cost_usd: number | string | null;
  prompt_applied: boolean | null;
  review_status: string | null;
  review_tags: string[] | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
};

type TurnRow = {
  id: string;
  turn_index: number | string;
  user_message: string | null;
  assistant_message: string | null;
  mode: string | null;
  conversation_stage: string | null;
  conversation_plan: Record<string, unknown> | null;
  orchestration_plan: Record<string, unknown> | null;
  normalized_brief: Record<string, unknown> | null;
  recommendations: Record<string, unknown> | null;
  also_consider: unknown;
  selected_model: string | null;
  selected_workflow: string | null;
  selected_tier: string | null;
  uploaded_asset: SanitizedUploadedAsset | null;
  page_context: SanitizedPageContext | null;
  prompt_generation_context_summary: Record<string, unknown> | null;
  sanitized_final_output: Record<string, unknown> | null;
  warnings: string[] | null;
  validation_issues_before: unknown;
  validation_issues_after: unknown;
  ui_actions: unknown;
  llm: unknown;
  llm_cost: unknown;
  safety: unknown;
  created_at: string;
};

type SanitizedUploadedAsset = {
  type: string | null;
  hasPerson: boolean;
  hasProduct: boolean;
  hasLogo: boolean;
  hasText: boolean;
  isReferenceImage: boolean;
};

type SanitizedPageContext = {
  pathname: string | null;
  surface: string | null;
};

const REVIEW_STATUSES: readonly AiStrategistReviewStatus[] = [
  'unreviewed',
  'reviewed',
  'flagged',
  'training_candidate',
  'ignored',
];

const reviewStatusSet = new Set<string>(REVIEW_STATUSES);

export function normalizeAiStrategistReviewStatus(value: unknown): AiStrategistReviewStatus {
  return typeof value === 'string' && reviewStatusSet.has(value) ? (value as AiStrategistReviewStatus) : 'unreviewed';
}

export function buildAiStrategistConversationRecord(
  input: AiStrategistConversationRecordInput
): AiStrategistConversationRecord {
  const result = toRecord(input.result);
  const output = toRecord(result.sanitizedFinalOutput);
  const conversationId = normalizeUuid(input.conversationId) ?? randomUUID();
  const userId = normalizeUuid(input.userId);
  const userMessage = firstNonEmptyString(
    input.visibleUserText,
    input.request.userMessage,
    stringFromRecord(result.normalizedBrief, 'rawUserMessage')
  );
  const assistantMessage = firstNonEmptyString(result.assistantMessage);
  const selectedModel = firstNonEmptyString(result.selectedModel, input.request.selectedModel);
  const selectedWorkflow = firstNonEmptyString(result.workflow, input.request.selectedWorkflow);
  const selectedTier = firstNonEmptyString(result.selectedTier, input.request.selectedTier);
  const currentStage = firstNonEmptyString(result.conversationStage);
  const finalPrompt = firstNonEmptyString(output.finalPrompt);
  const negativePrompt = firstNonEmptyString(output.negativePrompt);
  const clientSessionId = firstNonEmptyString(input.clientSessionId, input.conversationId, conversationId) ?? conversationId;

  return {
    conversation: {
      id: conversationId,
      clientSessionId,
      userId,
      surface: firstNonEmptyString(input.request.surface, stringFromRecord(input.request.pageContext, 'surface')) ?? 'app_sidebar',
      status: currentStage === 'prompt_ready' ? 'prompt_ready' : 'open',
      currentStage,
      firstUserMessage: userMessage,
      lastUserMessage: userMessage,
      lastAssistantMessage: assistantMessage,
      lastSelectedModel: selectedModel,
      lastSelectedWorkflow: selectedWorkflow,
      lastSelectedTier: selectedTier,
      lastPrompt: finalPrompt,
      lastNegativePrompt: negativePrompt,
      estimatedLlmCostUsd: numberFromRecord(result.llmCost, 'totalUsd'),
      promptApplied: false,
    },
    turn: {
      userId,
      role: 'assistant',
      userMessage,
      assistantMessage,
      mode: firstNonEmptyString(result.mode, input.request.mode),
      conversationStage: currentStage,
      conversationPlan: result.conversationPlan ?? null,
      orchestrationPlan: result.orchestrationPlan ?? null,
      normalizedBrief: result.normalizedBrief ?? null,
      recommendations: result.recommendations ?? null,
      alsoConsider: result.alsoConsider ?? null,
      selectedModel,
      selectedWorkflow,
      selectedTier,
      uploadedAsset: sanitizeUploadedAsset(input.request.uploadedAsset),
      pageContext: sanitizePageContext(input.request.pageContext),
      promptGenerationContextSummary: toNullableRecord(result.promptGenerationContextSummary),
      sanitizedFinalOutput: toNullableRecord(result.sanitizedFinalOutput),
      warnings: normalizeStringArray(result.warnings),
      validationIssuesBefore: result.validationIssuesBeforeSanitizer ?? null,
      validationIssuesAfter: result.validationIssuesAfterSanitizer ?? null,
      uiActions: result.uiActions ?? null,
      llm: result.llm ?? null,
      llmCost: result.llmCost ?? null,
      safety: result.safety ?? null,
    },
  };
}

export async function recordAiStrategistConversationTurn(
  input: AiStrategistConversationRecordInput
): Promise<{ conversationId: string; conversationTurnId: string } | null> {
  if (!isDatabaseConfigured()) return null;

  const payload = buildAiStrategistConversationRecord(input);

  try {
    return await withDbTransaction(async (executor) => {
      await executor.query(
        `
          INSERT INTO ai_strategist_conversations (
            id,
            client_session_id,
            user_id,
            surface,
            status,
            current_stage,
            first_user_message,
            last_user_message,
            last_assistant_message,
            last_selected_model,
            last_selected_workflow,
            last_selected_tier,
            last_prompt,
            last_negative_prompt,
            estimated_llm_cost_usd,
            prompt_applied,
            created_at,
            updated_at
          )
          VALUES (
            $1::uuid,
            $2,
            $3::uuid,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            NOW(),
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = COALESCE(ai_strategist_conversations.user_id, EXCLUDED.user_id),
            surface = EXCLUDED.surface,
            status = EXCLUDED.status,
            current_stage = EXCLUDED.current_stage,
            first_user_message = COALESCE(ai_strategist_conversations.first_user_message, EXCLUDED.first_user_message),
            last_user_message = EXCLUDED.last_user_message,
            last_assistant_message = EXCLUDED.last_assistant_message,
            last_selected_model = COALESCE(EXCLUDED.last_selected_model, ai_strategist_conversations.last_selected_model),
            last_selected_workflow = COALESCE(EXCLUDED.last_selected_workflow, ai_strategist_conversations.last_selected_workflow),
            last_selected_tier = COALESCE(EXCLUDED.last_selected_tier, ai_strategist_conversations.last_selected_tier),
            last_prompt = COALESCE(EXCLUDED.last_prompt, ai_strategist_conversations.last_prompt),
            last_negative_prompt = COALESCE(EXCLUDED.last_negative_prompt, ai_strategist_conversations.last_negative_prompt),
            estimated_llm_cost_usd = COALESCE(EXCLUDED.estimated_llm_cost_usd, ai_strategist_conversations.estimated_llm_cost_usd),
            prompt_applied = ai_strategist_conversations.prompt_applied OR EXCLUDED.prompt_applied,
            updated_at = NOW()
        `,
        [
          payload.conversation.id,
          payload.conversation.clientSessionId,
          payload.conversation.userId,
          payload.conversation.surface,
          payload.conversation.status,
          payload.conversation.currentStage,
          payload.conversation.firstUserMessage,
          payload.conversation.lastUserMessage,
          payload.conversation.lastAssistantMessage,
          payload.conversation.lastSelectedModel,
          payload.conversation.lastSelectedWorkflow,
          payload.conversation.lastSelectedTier,
          payload.conversation.lastPrompt,
          payload.conversation.lastNegativePrompt,
          payload.conversation.estimatedLlmCostUsd,
          payload.conversation.promptApplied,
        ]
      );

      const [turnIndexRow] = await executor.query<{ next_index: number | string }>(
        `
          SELECT COALESCE(MAX(turn_index), 0) + 1 AS next_index
          FROM ai_strategist_conversation_turns
          WHERE conversation_id = $1::uuid
        `,
        [payload.conversation.id]
      );
      const turnIndex = coerceNumber(turnIndexRow?.next_index, 1);

      const [turnRow] = await executor.query<PersistedTurnRow>(
        `
          INSERT INTO ai_strategist_conversation_turns (
            conversation_id,
            turn_index,
            user_id,
            role,
            user_message,
            assistant_message,
            mode,
            conversation_stage,
            conversation_plan,
            orchestration_plan,
            normalized_brief,
            recommendations,
            also_consider,
            selected_model,
            selected_workflow,
            selected_tier,
            uploaded_asset,
            page_context,
            prompt_generation_context_summary,
            sanitized_final_output,
            warnings,
            validation_issues_before,
            validation_issues_after,
            ui_actions,
            llm,
            llm_cost,
            safety,
            created_at
          )
          VALUES (
            $1::uuid,
            $2,
            $3::uuid,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9::jsonb,
            $10::jsonb,
            $11::jsonb,
            $12::jsonb,
            $13::jsonb,
            $14,
            $15,
            $16,
            $17::jsonb,
            $18::jsonb,
            $19::jsonb,
            $20::jsonb,
            $21::text[],
            $22::jsonb,
            $23::jsonb,
            $24::jsonb,
            $25::jsonb,
            $26::jsonb,
            $27::jsonb,
            NOW()
          )
          RETURNING conversation_id, id AS turn_id
        `,
        [
          payload.conversation.id,
          turnIndex,
          payload.turn.userId,
          payload.turn.role,
          payload.turn.userMessage,
          payload.turn.assistantMessage,
          payload.turn.mode,
          payload.turn.conversationStage,
          jsonParam(payload.turn.conversationPlan),
          jsonParam(payload.turn.orchestrationPlan),
          jsonParam(payload.turn.normalizedBrief),
          jsonParam(payload.turn.recommendations),
          jsonParam(payload.turn.alsoConsider),
          payload.turn.selectedModel,
          payload.turn.selectedWorkflow,
          payload.turn.selectedTier,
          jsonParam(payload.turn.uploadedAsset),
          jsonParam(payload.turn.pageContext),
          jsonParam(payload.turn.promptGenerationContextSummary),
          jsonParam(payload.turn.sanitizedFinalOutput),
          payload.turn.warnings,
          jsonParam(payload.turn.validationIssuesBefore),
          jsonParam(payload.turn.validationIssuesAfter),
          jsonParam(payload.turn.uiActions),
          jsonParam(payload.turn.llm),
          jsonParam(payload.turn.llmCost),
          jsonParam(payload.turn.safety),
        ]
      );

      await executor.query(
        `
          UPDATE ai_strategist_conversations
          SET total_turns = (
            SELECT COUNT(*)::integer
            FROM ai_strategist_conversation_turns
            WHERE conversation_id = $1::uuid
          ),
          updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [payload.conversation.id]
      );

      return {
        conversationId: turnRow?.conversation_id ?? payload.conversation.id,
        conversationTurnId: turnRow?.turn_id ?? '',
      };
    });
  } catch (error) {
    console.warn('[ai-strategist-conversations] failed to persist conversation turn', error);
    return null;
  }
}

export async function fetchAiStrategistConversationReviews({
  limit = 100,
  reviewStatus = 'all',
  selectedModel = null,
  search = null,
}: AiStrategistConversationReviewFilters = {}): Promise<AiStrategistConversationReviewSummary[]> {
  if (!isDatabaseConfigured()) return [];
  if (!(await isAiStrategistConversationReviewStorageReady())) return [];

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (reviewStatus && reviewStatus !== 'all') {
    values.push(normalizeAiStrategistReviewStatus(reviewStatus));
    conditions.push(`review_status = $${values.length}`);
  }

  if (selectedModel) {
    values.push(selectedModel);
    conditions.push(`last_selected_model = $${values.length}`);
  }

  if (search?.trim()) {
    values.push(`%${search.trim()}%`);
    conditions.push(`(
      id::text ILIKE $${values.length}
      OR client_session_id ILIKE $${values.length}
      OR COALESCE(first_user_message, '') ILIKE $${values.length}
      OR COALESCE(last_user_message, '') ILIKE $${values.length}
      OR COALESCE(last_assistant_message, '') ILIKE $${values.length}
    )`);
  }

  values.push(Math.min(250, Math.max(1, limit)));
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query<ConversationRow>(
    `
      SELECT
        id,
        client_session_id,
        user_id,
        surface,
        status,
        current_stage,
        first_user_message,
        last_user_message,
        last_assistant_message,
        last_selected_model,
        last_selected_workflow,
        last_selected_tier,
        last_prompt,
        last_negative_prompt,
        total_turns,
        estimated_llm_cost_usd,
        prompt_applied,
        review_status,
        review_tags,
        reviewer_notes,
        created_at,
        updated_at
      FROM ai_strategist_conversations
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${values.length}
    `,
    values
  );

  return hydrateConversationSummaries(rows);
}

export async function fetchAiStrategistConversationReviewDetail(
  conversationId: string
): Promise<AiStrategistConversationReviewDetail | null> {
  if (!isDatabaseConfigured()) return null;
  if (!(await isAiStrategistConversationReviewStorageReady())) return null;
  if (!normalizeUuid(conversationId)) return null;

  const rows = await query<ConversationRow>(
    `
      SELECT
        id,
        client_session_id,
        user_id,
        surface,
        status,
        current_stage,
        first_user_message,
        last_user_message,
        last_assistant_message,
        last_selected_model,
        last_selected_workflow,
        last_selected_tier,
        last_prompt,
        last_negative_prompt,
        total_turns,
        estimated_llm_cost_usd,
        prompt_applied,
        review_status,
        review_tags,
        reviewer_notes,
        created_at,
        updated_at
      FROM ai_strategist_conversations
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [conversationId]
  );

  if (!rows[0]) return null;
  const [conversation] = await hydrateConversationSummaries(rows);
  if (!conversation) return null;

  const turnRows = await query<TurnRow>(
    `
      SELECT
        id,
        turn_index,
        user_message,
        assistant_message,
        mode,
        conversation_stage,
        conversation_plan,
        orchestration_plan,
        normalized_brief,
        recommendations,
        also_consider,
        selected_model,
        selected_workflow,
        selected_tier,
        uploaded_asset,
        page_context,
        prompt_generation_context_summary,
        sanitized_final_output,
        warnings,
        validation_issues_before,
        validation_issues_after,
        ui_actions,
        llm,
        llm_cost,
        safety,
        created_at
      FROM ai_strategist_conversation_turns
      WHERE conversation_id = $1::uuid
      ORDER BY turn_index ASC
    `,
    [conversationId]
  );

  return {
    conversation,
    turns: turnRows.map(mapTurnRow),
  };
}

export async function updateAiStrategistConversationReview({
  conversationId,
  reviewStatus,
  reviewTags,
  reviewerNotes,
  reviewedBy,
}: {
  conversationId: string;
  reviewStatus: AiStrategistReviewStatus;
  reviewTags: string[];
  reviewerNotes: string | null;
  reviewedBy: string;
}): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured');
  }

  await query(
    `
      UPDATE ai_strategist_conversations
      SET review_status = $2,
          review_tags = $3::text[],
          reviewer_notes = $4,
          reviewed_by = $5::uuid,
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [conversationId, reviewStatus, reviewTags, reviewerNotes, reviewedBy]
  );
}

export async function isAiStrategistConversationReviewStorageReady(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  try {
    const [row] = await query<{ conversations_table: string | null; turns_table: string | null }>(
      `
        SELECT
          to_regclass('public.ai_strategist_conversations')::text AS conversations_table,
          to_regclass('public.ai_strategist_conversation_turns')::text AS turns_table
      `
    );
    return Boolean(row?.conversations_table && row?.turns_table);
  } catch (error) {
    console.warn('[ai-strategist-conversations] failed to check review storage schema', error);
    return false;
  }
}

export async function markAiStrategistConversationApplied({
  conversationId,
  userId,
  selectedModel,
  selectedWorkflow,
  target,
}: {
  conversationId: string | null | undefined;
  userId?: string | null;
  selectedModel?: string | null;
  selectedWorkflow?: string | null;
  target?: string | null;
}): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const normalizedConversationId = normalizeUuid(conversationId);
  if (!normalizedConversationId) return false;

  try {
    const rows = await query<{ id: string }>(
      `
        UPDATE ai_strategist_conversations
        SET prompt_applied = TRUE,
            status = 'applied',
            user_id = COALESCE(user_id, $2::uuid),
            last_selected_model = COALESCE($3, last_selected_model),
            last_selected_workflow = COALESCE($4, last_selected_workflow),
            review_tags = CASE
              WHEN $5 IS NOT NULL AND NOT ($5 = ANY(review_tags)) THEN array_append(review_tags, $5)
              ELSE review_tags
            END,
            updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING id
      `,
      [
        normalizedConversationId,
        normalizeUuid(userId),
        firstNonEmptyString(selectedModel),
        firstNonEmptyString(selectedWorkflow),
        target ? `applied:${target}` : null,
      ]
    );
    return Boolean(rows[0]?.id);
  } catch (error) {
    console.warn('[ai-strategist-conversations] failed to mark conversation applied', error);
    return false;
  }
}

async function hydrateConversationSummaries(rows: ConversationRow[]): Promise<AiStrategistConversationReviewSummary[]> {
  const identityMap = new Map<string, string | null>();
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value))));

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const identity = await getUserIdentity(userId);
          identityMap.set(userId, identity?.email ?? null);
        } catch {
          identityMap.set(userId, null);
        }
      })
    );
  }

  return rows.map((row) => mapConversationRow(row, identityMap.get(row.user_id ?? '') ?? null));
}

function mapConversationRow(row: ConversationRow, userEmail: string | null): AiStrategistConversationReviewSummary {
  return {
    id: row.id,
    clientSessionId: row.client_session_id,
    userId: row.user_id,
    userEmail,
    surface: row.surface,
    status: row.status,
    currentStage: row.current_stage,
    firstUserMessage: row.first_user_message,
    lastUserMessage: row.last_user_message,
    lastAssistantMessage: row.last_assistant_message,
    lastSelectedModel: row.last_selected_model,
    lastSelectedWorkflow: row.last_selected_workflow,
    lastSelectedTier: row.last_selected_tier,
    totalTurns: coerceNumber(row.total_turns, 0),
    estimatedLlmCostUsd: coerceNullableNumber(row.estimated_llm_cost_usd),
    promptApplied: Boolean(row.prompt_applied),
    reviewStatus: normalizeAiStrategistReviewStatus(row.review_status),
    reviewTags: normalizeStringArray(row.review_tags),
    reviewerNotes: row.reviewer_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTurnRow(row: TurnRow): AiStrategistConversationTurnReview {
  return {
    id: row.id,
    turnIndex: coerceNumber(row.turn_index, 0),
    userMessage: row.user_message,
    assistantMessage: row.assistant_message,
    mode: row.mode,
    conversationStage: row.conversation_stage,
    conversationPlan: row.conversation_plan,
    orchestrationPlan: row.orchestration_plan,
    normalizedBrief: row.normalized_brief,
    recommendations: row.recommendations,
    alsoConsider: row.also_consider,
    selectedModel: row.selected_model,
    selectedWorkflow: row.selected_workflow,
    selectedTier: row.selected_tier,
    uploadedAsset: row.uploaded_asset,
    pageContext: row.page_context,
    promptGenerationContextSummary: row.prompt_generation_context_summary,
    sanitizedFinalOutput: row.sanitized_final_output,
    warnings: normalizeStringArray(row.warnings),
    validationIssuesBefore: row.validation_issues_before,
    validationIssuesAfter: row.validation_issues_after,
    uiActions: row.ui_actions,
    llm: row.llm,
    llmCost: row.llm_cost,
    safety: row.safety,
    createdAt: row.created_at,
  };
}

function sanitizeUploadedAsset(uploadedAsset: unknown): SanitizedUploadedAsset | null {
  if (!isRecord(uploadedAsset)) return null;
  return {
    type: firstNonEmptyString(uploadedAsset.type) ?? null,
    hasPerson: Boolean(uploadedAsset.hasPerson),
    hasProduct: Boolean(uploadedAsset.hasProduct),
    hasLogo: Boolean(uploadedAsset.hasLogo),
    hasText: Boolean(uploadedAsset.hasText),
    isReferenceImage: Boolean(uploadedAsset.isReferenceImage),
  };
}

function sanitizePageContext(pageContext: unknown): SanitizedPageContext | null {
  if (!isRecord(pageContext)) return null;
  return {
    pathname: firstNonEmptyString(pageContext.pathname) ?? null,
    surface: firstNonEmptyString(pageContext.surface) ?? null,
  };
}

function toNullableRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringFromRecord(value: unknown, key: string): string | null {
  return isRecord(value) ? firstNonEmptyString(value[key]) : null;
}

function numberFromRecord(value: unknown, key: string): number | null {
  return isRecord(value) ? coerceNullableNumber(value[key]) : null;
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, 25);
}

function jsonParam(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : null;
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function coerceNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
