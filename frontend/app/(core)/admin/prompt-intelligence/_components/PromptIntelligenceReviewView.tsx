import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { AdminFilterBar } from '@/components/admin-system/surfaces/AdminFilterBar';
import type {
  PromptIntelligenceReviewCandidate,
  PromptIntelligenceReviewSummary,
  PromptReviewStatusFilter,
} from '@/server/prompt-intelligence';
import { PromptIntelligenceReviewForm } from './PromptIntelligenceReviewForm';
import {
  formatPromptReviewDate,
  formatPromptReviewLabel,
  formatPromptReviewScore,
  reviewStatuses,
} from '../_lib/prompt-intelligence-format';

type ReviewAction = (formData: FormData) => Promise<void>;

type ReviewFilters = {
  reviewStatus: PromptReviewStatusFilter;
  engineId: string | null;
  q: string | null;
};

export function PromptIntelligenceReviewView({
  queue,
  selected,
  filters,
  reviewAction,
  notice,
}: {
  queue: PromptIntelligenceReviewSummary[];
  selected: PromptIntelligenceReviewCandidate | null;
  filters: ReviewFilters;
  reviewAction: ReviewAction;
  notice?: ReactNode;
}) {
  const strongCount = queue.filter((row) => row.verdict === 'strong_example').length;
  const avoidCount = queue.filter((row) => row.verdict === 'avoid_pattern' || row.verdict === 'bad_result').length;
  const unreviewedCount = queue.filter((row) => !row.hasReview).length;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Prompt Intelligence"
        title="Prompt result reviews"
        description="Review rendered videos against their prompt, model, workflow, settings, and final output. This builds the data layer for better prompt recommendations."
      />

      <AdminSection
        title="Review queue"
        description="Start with completed jobs already in app_jobs. Score the prompt-result pair by model and workflow; mark best prompts, weak prompts, and avoid patterns."
        action={
          <AdminSectionMeta
            title={`${queue.length} loaded`}
            lines={[`${unreviewedCount} unreviewed`, `${strongCount} Best prompts`, `${avoidCount} Avoid patterns`]}
          />
        }
      >
        <div className="space-y-4">
          <ReviewFilters filters={filters} />
          {notice}
          <AdminNotice tone="info">
            This is admin-only review data. It does not publish videos, index watch pages, run generation, or spend credits.
          </AdminNotice>
        </div>
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <AdminSection title="Adaptive QCM" description="The form expands only for relevant risks: product preservation, character consistency, text/logo drift, or audio/lip-sync.">
          {selected ? (
            <div className="space-y-5">
              <SelectedVideoPreview selected={selected} />
              <PromptIntelligenceReviewForm candidate={selected} reviewAction={reviewAction} />
            </div>
          ) : (
            <AdminEmptyState>No completed video is available for review with the current filters.</AdminEmptyState>
          )}
        </AdminSection>

        <AdminSection
          title="Rendered videos"
          description="Open a row to review that prompt/result pair."
          contentClassName="p-0"
        >
          {queue.length ? <QueueTable queue={queue} /> : <AdminEmptyState>No jobs match the current filters.</AdminEmptyState>}
        </AdminSection>
      </div>
    </div>
  );
}

function ReviewFilters({ filters }: { filters: ReviewFilters }) {
  return (
    <AdminFilterBar className="p-3" fieldsClassName="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
        Status
        <select name="reviewStatus" defaultValue={filters.reviewStatus} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary">
          {reviewStatuses.map((status) => (
            <option key={status} value={status}>
              {formatPromptReviewLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
        Model
        <input
          name="engineId"
          defaultValue={filters.engineId ?? ''}
          placeholder="kling-3-pro"
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
        Search
        <input
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="prompt, job id, model label"
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
        />
      </label>
      <button type="submit" className="self-end rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary">
        Filter
      </button>
    </AdminFilterBar>
  );
}

function SelectedVideoPreview({ selected }: { selected: PromptIntelligenceReviewCandidate }) {
  const { summary, video, signals } = selected;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,420px)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-2xl border border-hairline bg-black">
        {video.videoUrl ? (
          <video src={video.videoUrl} poster={video.thumbUrl} controls preload="metadata" className="aspect-video w-full bg-black object-contain" />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-white/70">No video asset</div>
        )}
      </div>
      <div className="space-y-3 rounded-2xl border border-hairline bg-bg/40 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Prompt</p>
          <p className="mt-2 text-sm leading-6 text-text-primary">{summary.promptText}</p>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Meta label="Model" value={summary.engineLabel} />
          <Meta label="Workflow" value={summary.workflow} />
          <Meta label="Duration" value={summary.durationSec ? `${summary.durationSec}s` : 'Unknown'} />
          <Meta label="Resolution" value={summary.resolution ?? 'Unknown'} />
          <Meta label="Aspect" value={summary.aspectRatio ?? 'Unknown'} />
          <Meta label="Review" value={summary.verdict ? formatPromptReviewLabel(summary.verdict) : 'Unreviewed'} />
        </dl>
        <div className="flex flex-wrap gap-2">
          {signals.suggestedTags.map((tag) => (
            <span key={tag} className="rounded-full border border-hairline bg-surface px-2 py-1 text-xs font-medium text-text-secondary">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function QueueTable({ queue }: { queue: PromptIntelligenceReviewSummary[] }) {
  return (
    <AdminDataTable className="rounded-none border-0">
      <thead className="bg-bg/60 text-xs uppercase tracking-[0.14em] text-text-muted">
        <tr>
          <th className="px-4 py-3 font-semibold">Video</th>
          <th className="px-4 py-3 font-semibold">Model</th>
          <th className="px-4 py-3 font-semibold">Score</th>
          <th className="px-4 py-3 font-semibold">Verdict</th>
          <th className="px-4 py-3 font-semibold">Updated</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline">
        {queue.map((row) => (
          <tr key={row.jobId} className="align-top">
            <td className="max-w-[360px] px-4 py-3">
              <Link href={`/admin/prompt-intelligence?jobId=${encodeURIComponent(row.jobId)}`} className="font-semibold text-text-primary hover:text-brand">
                {row.promptExcerpt || row.jobId}
              </Link>
              <p className="mt-1 text-xs text-text-muted">{row.jobId}</p>
            </td>
            <td className="px-4 py-3 text-sm text-text-secondary">
              <span className="font-medium text-text-primary">{row.engineLabel}</span>
              <span className="mt-1 block text-xs text-text-muted">{row.workflow}</span>
            </td>
            <td className="px-4 py-3 text-sm font-semibold text-text-primary">{formatPromptReviewScore(row.overallScore)}</td>
            <td className="px-4 py-3 text-sm text-text-secondary">{row.verdict ? formatPromptReviewLabel(row.verdict) : 'Unreviewed'}</td>
            <td className="px-4 py-3 text-xs text-text-muted">{formatPromptReviewDate(row.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-text-primary">{value}</dd>
    </div>
  );
}
