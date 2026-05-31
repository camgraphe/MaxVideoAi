import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { AdminFilterBar } from '@/components/admin-system/surfaces/AdminFilterBar';
import type {
  AiStrategistConversationReviewSummary,
  AiStrategistReviewStatus,
} from '@/server/ai-strategist-conversations';
import {
  formatConversationDate,
  formatReviewStatusLabel,
  formatTagList,
  formatUsd,
  previewText,
} from '../_lib/ai-strategist-conversation-format';

type ReviewFilters = {
  reviewStatus: AiStrategistReviewStatus | 'all';
  model: string | null;
  q: string | null;
};

const reviewStatuses: Array<AiStrategistReviewStatus | 'all'> = [
  'all',
  'unreviewed',
  'flagged',
  'training_candidate',
  'reviewed',
  'ignored',
];

export function AiStrategistConversationReviewView({
  conversations,
  filters,
  notice,
}: {
  conversations: AiStrategistConversationReviewSummary[];
  filters: ReviewFilters;
  notice?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Analytics"
        title="AI Strategist conversation reviews"
        description="Review beta conversations, spot routing mistakes, collect training candidates, and track prompt assistant quality without storing uploaded media binaries."
      />

      <AdminSection
        title="Review queue"
        description="Filter by review status, model, or customer wording. Open a conversation to inspect normalized briefs, routing, warnings, prompts, and UI action previews."
        action={
          <AdminSectionMeta
            title={`${conversations.length} loaded`}
            lines={[filters.reviewStatus === 'all' ? 'All review states' : formatReviewStatusLabel(filters.reviewStatus)]}
          />
        }
      >
        <div className="space-y-4">
          <ReviewFilters filters={filters} />
          {notice}
          {conversations.length ? <ConversationTable conversations={conversations} /> : <AdminEmptyState>No strategist conversations found.</AdminEmptyState>}
        </div>
      </AdminSection>
    </div>
  );
}

function ReviewFilters({ filters }: { filters: ReviewFilters }) {
  return (
    <AdminFilterBar className="p-3" fieldsClassName="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
        Status
        <select name="reviewStatus" defaultValue={filters.reviewStatus} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary">
          {reviewStatuses.map((status) => (
            <option key={status} value={status}>
              {status === 'all' ? 'All statuses' : formatReviewStatusLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
        Model
        <input
          name="model"
          defaultValue={filters.model ?? ''}
          placeholder="kling-3-pro"
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
        Search
        <input
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="user wording, session, conversation id"
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
        />
      </label>
      <button type="submit" className="self-end rounded-xl border border-border bg-text-primary px-4 py-2 text-sm font-semibold text-surface">
        Filter
      </button>
    </AdminFilterBar>
  );
}

function ConversationTable({ conversations }: { conversations: AiStrategistConversationReviewSummary[] }) {
  return (
    <AdminDataTable tone="muted" tableClassName="w-full min-w-[1120px]">
      <thead className="bg-surface">
        <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
          <th className="px-4 py-3 font-semibold">Conversation</th>
          <th className="px-4 py-3 font-semibold">Latest user intent</th>
          <th className="px-4 py-3 font-semibold">Routing</th>
          <th className="px-4 py-3 font-semibold">Review</th>
          <th className="px-4 py-3 text-right font-semibold">Open</th>
        </tr>
      </thead>
      <tbody>
        {conversations.map((conversation) => (
          <tr key={conversation.id} className="border-t border-hairline align-top transition hover:bg-bg">
            <td className="px-4 py-3">
              <p className="font-semibold text-text-primary">{formatConversationDate(conversation.updatedAt)}</p>
              <p className="mt-1 text-xs text-text-secondary">{conversation.userEmail ?? conversation.userId ?? 'Anonymous beta session'}</p>
              <p className="mt-1 font-mono text-[11px] text-text-muted">{conversation.id}</p>
            </td>
            <td className="px-4 py-3">
              <p className="max-w-md text-sm leading-5 text-text-primary">{previewText(conversation.lastUserMessage ?? conversation.firstUserMessage)}</p>
              <p className="mt-2 text-xs text-text-secondary">{conversation.totalTurns} turns · {conversation.currentStage ?? 'unknown stage'} · {formatUsd(conversation.estimatedLlmCostUsd)} est. LLM</p>
            </td>
            <td className="px-4 py-3 text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">{conversation.lastSelectedModel ?? 'No model selected'}</p>
              <p className="mt-1">{conversation.lastSelectedWorkflow ?? 'No workflow'} · {conversation.lastSelectedTier ?? 'no tier'}</p>
            </td>
            <td className="px-4 py-3 text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">{formatReviewStatusLabel(conversation.reviewStatus)}</p>
              <p className="mt-1">{formatTagList(conversation.reviewTags)}</p>
            </td>
            <td className="px-4 py-3 text-right">
              <Link
                href={`/admin/ai-strategist-conversations/${conversation.id}`}
                className="inline-flex rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-bg"
              >
                Review
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}
