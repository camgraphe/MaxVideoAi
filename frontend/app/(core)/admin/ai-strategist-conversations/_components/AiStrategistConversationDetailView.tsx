import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import type {
  AiStrategistConversationReviewDetail,
  AiStrategistConversationTurnReview,
  AiStrategistReviewStatus,
} from '@/server/ai-strategist-conversations';
import {
  formatConversationDate,
  formatReviewStatusLabel,
  formatTagList,
  formatUsd,
  previewText,
} from '../_lib/ai-strategist-conversation-format';

type ReviewAction = (formData: FormData) => Promise<void>;

const reviewStatuses: AiStrategistReviewStatus[] = [
  'unreviewed',
  'flagged',
  'training_candidate',
  'reviewed',
  'ignored',
];

export function AiStrategistConversationDetailView({
  detail,
  reviewAction,
  notice,
}: {
  detail: AiStrategistConversationReviewDetail | null;
  reviewAction: ReviewAction;
  notice?: ReactNode;
}) {
  if (!detail) {
    return (
      <div className="flex flex-col gap-5">
        <AdminPageHeader eyebrow="Analytics" title="AI Strategist conversation" description="Conversation review detail." />
        {notice}
        <AdminEmptyState>No conversation loaded.</AdminEmptyState>
      </div>
    );
  }

  const { conversation, turns } = detail;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Analytics"
        title="AI Strategist conversation"
        description="Inspect the exact customer exchange, deterministic routing context, LLM output, sanitation issues, and UI action previews."
        actions={
          <Link href="/admin/ai-strategist-conversations" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary">
            Back to queue
          </Link>
        }
      />

      {notice}

      <AdminSection
        title="Conversation summary"
        description="High-level review state and routing outcome."
        action={
          <AdminSectionMeta
            title={formatReviewStatusLabel(conversation.reviewStatus)}
            lines={[`${conversation.totalTurns} turns`, `${formatUsd(conversation.estimatedLlmCostUsd)} estimated LLM cost`]}
          />
        }
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <div className="rounded-2xl border border-hairline bg-bg/40 p-4">
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <SummaryItem label="Updated" value={formatConversationDate(conversation.updatedAt)} />
              <SummaryItem label="User" value={conversation.userEmail ?? conversation.userId ?? 'Anonymous beta session'} />
              <SummaryItem label="Model" value={conversation.lastSelectedModel ?? 'No model selected'} />
              <SummaryItem label="Workflow" value={conversation.lastSelectedWorkflow ?? 'No workflow selected'} />
              <SummaryItem label="Tier" value={conversation.lastSelectedTier ?? 'No tier'} />
              <SummaryItem label="Stage" value={conversation.currentStage ?? 'Unknown'} />
            </dl>
            <div className="mt-4 rounded-xl border border-hairline bg-surface p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Latest user message</p>
              <p className="mt-2 text-sm leading-6 text-text-primary">{previewText(conversation.lastUserMessage ?? conversation.firstUserMessage)}</p>
            </div>
          </div>

          <form action={reviewAction} className="rounded-2xl border border-hairline bg-surface p-4">
            <input type="hidden" name="conversationId" value={conversation.id} />
            <div className="space-y-3">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
                Review status
                <select name="reviewStatus" defaultValue={conversation.reviewStatus} className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary">
                  {reviewStatuses.map((status) => (
                    <option key={status} value={status}>{formatReviewStatusLabel(status)}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
                Tags
                <input
                  name="reviewTags"
                  defaultValue={conversation.reviewTags.join(', ')}
                  placeholder="routing, pricing, prompt-quality"
                  className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
                Reviewer notes
                <textarea
                  name="reviewerNotes"
                  defaultValue={conversation.reviewerNotes ?? ''}
                  rows={4}
                  placeholder="What should we improve from this conversation?"
                  className="resize-y rounded-xl border border-border bg-bg px-3 py-2 text-sm leading-5 text-text-primary placeholder:text-text-muted"
                />
              </label>
              <p className="text-xs text-text-muted">Current tags: {formatTagList(conversation.reviewTags)}</p>
              <button type="submit" className="rounded-xl border border-text-primary bg-text-primary px-4 py-2 text-sm font-semibold text-surface">
                Save review
              </button>
            </div>
          </form>
        </div>
      </AdminSection>

      <AdminSection title="Conversation turns" description="Each turn stores only text, metadata, summaries, warnings, validators, and UI action previews. Uploaded assets remain metadata-only.">
        <div className="space-y-4">
          {turns.map((turn) => (
            <TurnCard key={turn.id} turn={turn} />
          ))}
        </div>
      </AdminSection>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-text-primary">{value}</dd>
    </div>
  );
}

function TurnCard({ turn }: { turn: AiStrategistConversationTurnReview }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Turn {turn.turnIndex}</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">{turn.selectedModel ?? 'No selected model'} · {turn.selectedWorkflow ?? 'No workflow'}</p>
          <p className="mt-1 text-xs text-text-secondary">{formatConversationDate(turn.createdAt)} · {turn.conversationStage ?? 'unknown stage'}</p>
        </div>
        <div className="text-right text-xs text-text-secondary">
          <p>{turn.mode ?? 'unknown mode'}</p>
          <p>{turn.selectedTier ?? 'no tier'}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <MessageBlock title="User" text={turn.userMessage} />
        <MessageBlock title="Assistant" text={turn.assistantMessage} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <JsonDetails title="Normalized brief" value={turn.normalizedBrief} />
        <JsonDetails title="Recommendations" value={turn.recommendations} />
        <JsonDetails title="Prompt context summary" value={turn.promptGenerationContextSummary} />
        <JsonDetails title="Sanitized final output" value={turn.sanitizedFinalOutput} />
        <JsonDetails title="Validation before" value={turn.validationIssuesBefore} />
        <JsonDetails title="Validation after" value={turn.validationIssuesAfter} />
        <JsonDetails title="UI actions" value={turn.uiActions} />
        <JsonDetails title="LLM cost" value={turn.llmCost} />
      </div>

      {turn.warnings.length ? (
        <div className="mt-4 rounded-xl border border-warning-border bg-warning-bg p-3 text-sm text-warning">
          <p className="font-semibold">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {turn.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function MessageBlock({ title, text }: { title: string; text: string | null }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-primary">{text || 'No text captured.'}</p>
    </section>
  );
}

function JsonDetails({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded-xl border border-hairline bg-surface">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">{title}</summary>
      <pre className="max-h-72 overflow-auto border-t border-hairline px-3 py-2 text-xs leading-5 text-text-secondary">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </details>
  );
}
