import Link from 'next/link';
import type { ReactNode } from 'react';
import { CheckCircle2, Eye, Sparkles, ThumbsDown, Wrench } from 'lucide-react';
import clsx from 'clsx';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
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
  const selectedJobId = selected?.summary.jobId ?? queue[0]?.jobId ?? null;

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        eyebrow="Prompt Intelligence"
        title="Prompt result reviews"
        description="Score rendered videos against their prompt, model, workflow, settings, and final output. Use quick verdicts for volume, then open the full QCM when a clip needs detail."
      />

      <AdminSection
        title="Review board"
        description="Latest completed clips from app_jobs. Cards are designed for fast triage: select, score in one click, or open the full adaptive QCM below."
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

      <AdminSection
        title="Rendered videos"
        description="Compact visual cards show more clips at once. Use the one-click score buttons for quick data collection."
        contentClassName="bg-bg/30 p-3 sm:p-4"
      >
        {queue.length ? (
          <QueueCardGrid queue={queue} selectedJobId={selectedJobId} reviewAction={reviewAction} />
        ) : (
          <AdminEmptyState>No jobs match the current filters.</AdminEmptyState>
        )}
      </AdminSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)]">
        <AdminSection
          title="Selected clip"
          description="Use this focused preview to compare the prompt with the rendered video before the detailed score."
          contentClassName="p-4"
        >
          {selected ? <SelectedVideoPreview selected={selected} /> : <AdminEmptyState>No completed video is available for review with the current filters.</AdminEmptyState>}
        </AdminSection>

        <AdminSection
          title="Adaptive QCM"
          description="Detailed review expands only for relevant risks: product preservation, character consistency, text/logo drift, or audio/lip-sync."
          contentClassName="p-4"
        >
          {selected ? <PromptIntelligenceReviewForm candidate={selected} reviewAction={reviewAction} /> : <AdminEmptyState>Select a clip to review.</AdminEmptyState>}
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
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-hairline bg-black shadow-sm">
        {video.videoUrl ? (
          <video src={video.videoUrl} poster={video.thumbUrl} controls preload="metadata" className="max-h-[420px] w-full bg-black object-contain" />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-white/70">No video asset</div>
        )}
      </div>
      <div className="space-y-3 rounded-2xl border border-hairline bg-bg/40 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Prompt</p>
          <p className="mt-2 line-clamp-6 text-sm leading-6 text-text-primary">{summary.promptText}</p>
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

function QueueCardGrid({
  queue,
  selectedJobId,
  reviewAction,
}: {
  queue: PromptIntelligenceReviewSummary[];
  selectedJobId: string | null;
  reviewAction: ReviewAction;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {queue.map((row) => (
        <QueueCard key={row.jobId} row={row} selected={row.jobId === selectedJobId} reviewAction={reviewAction} />
      ))}
    </div>
  );
}

function QueueCard({
  row,
  selected,
  reviewAction,
}: {
  row: PromptIntelligenceReviewSummary;
  selected: boolean;
  reviewAction: ReviewAction;
}) {
  const mediaUrl = row.thumbUrl || row.previewVideoUrl || row.videoUrl;
  const verdictLabel = row.verdict ? formatPromptReviewLabel(row.verdict) : 'Unreviewed';

  return (
    <article
      className={clsx(
        'group overflow-hidden rounded-2xl border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-card',
        selected ? 'border-brand/70 ring-2 ring-brand/10' : 'border-hairline'
      )}
    >
      <Link href={`/admin/prompt-intelligence?jobId=${encodeURIComponent(row.jobId)}`} className="block">
        <div className="relative aspect-video overflow-hidden bg-slate-950">
          {mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-semibold text-white/60">No preview</div>
          )}
          <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
            <Badge tone={row.hasReview ? 'good' : 'muted'}>{verdictLabel}</Badge>
            {selected ? <Badge tone="brand">Selected</Badge> : null}
          </div>
          <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
            {row.durationSec ? `${row.durationSec}s` : 'Duration ?'}
          </div>
        </div>
      </Link>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{row.engineLabel}</p>
            <p className="mt-0.5 text-[11px] font-medium text-text-muted">
              {row.workflow} · {row.aspectRatio ?? 'Aspect ?'} · {row.resolution ?? 'Res ?'}
            </p>
          </div>
          <div className="shrink-0 rounded-full border border-hairline bg-bg px-2 py-1 text-[11px] font-bold text-text-primary">
            {formatPromptReviewScore(row.overallScore)}
          </div>
        </div>

        <Link
          href={`/admin/prompt-intelligence?jobId=${encodeURIComponent(row.jobId)}`}
          className="line-clamp-2 min-h-10 text-xs leading-5 text-text-secondary hover:text-text-primary"
        >
          {row.promptExcerpt || row.jobId}
        </Link>

        <div className="flex flex-wrap gap-1">
          {row.signals.suggestedTags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold text-text-muted">
              {tag}
            </span>
          ))}
        </div>

        <QuickScoreActions row={row} reviewAction={reviewAction} />

        <div className="flex items-center justify-between border-t border-hairline pt-2 text-[11px] text-text-muted">
          <span>{formatPromptReviewDate(row.createdAt)}</span>
          <Link href={`/admin/prompt-intelligence?jobId=${encodeURIComponent(row.jobId)}`} className="inline-flex items-center gap-1 font-semibold text-text-secondary hover:text-brand">
            <Eye className="h-3.5 w-3.5" />
            Review
          </Link>
        </div>
      </div>
    </article>
  );
}

function QuickScoreActions({
  row,
  reviewAction,
}: {
  row: PromptIntelligenceReviewSummary;
  reviewAction: ReviewAction;
}) {
  const actions = [
    {
      label: 'Strong',
      icon: Sparkles,
      tone: 'strong',
      hidden: {
        verdict: 'strong_example',
        overallScore: '5',
        promptMatchScore: '5',
        modelFitScore: '5',
        workflowFitScore: '5',
        visualQualityScore: '5',
        motionScore: '5',
        cameraScore: '5',
        commercialUseScore: '5',
        seoPotentialScore: '4',
        nextAction: 'use_as_example',
        tags: mergeTags(row, ['strong-example']),
      },
    },
    {
      label: 'Good',
      icon: CheckCircle2,
      tone: 'good',
      hidden: {
        verdict: 'good_needs_prompt_tweak',
        overallScore: '4',
        promptMatchScore: '4',
        modelFitScore: '4',
        workflowFitScore: '4',
        visualQualityScore: '4',
        motionScore: '4',
        cameraScore: '4',
        commercialUseScore: '4',
        seoPotentialScore: '3',
        nextAction: 'improve_prompt',
        tags: mergeTags(row, ['good-result']),
      },
    },
    {
      label: 'Weak',
      icon: Wrench,
      tone: 'weak',
      hidden: {
        verdict: 'bad_result',
        overallScore: '2',
        promptMatchScore: '2',
        modelFitScore: '3',
        workflowFitScore: '3',
        visualQualityScore: '2',
        motionScore: '2',
        cameraScore: '2',
        commercialUseScore: '2',
        seoPotentialScore: '1',
        nextAction: 'improve_prompt',
        mainIssue: 'prompt_too_vague',
        tags: mergeTags(row, ['weak-result']),
      },
    },
    {
      label: 'Avoid',
      icon: ThumbsDown,
      tone: 'avoid',
      hidden: {
        verdict: 'avoid_pattern',
        overallScore: '1',
        promptMatchScore: '1',
        modelFitScore: '2',
        workflowFitScore: '2',
        visualQualityScore: '1',
        motionScore: '1',
        cameraScore: '1',
        commercialUseScore: '1',
        seoPotentialScore: '1',
        nextAction: 'avoid_this_pattern',
        mainIssue: 'model_limitation',
        tags: mergeTags(row, ['avoid-pattern']),
      },
    },
  ] as const;

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {actions.map(({ label, icon: Icon, tone, hidden }) => (
        <form key={label} action={reviewAction}>
          <input type="hidden" name="jobId" value={row.jobId} />
          <input type="hidden" name="intent" value={row.intent} />
          <input type="hidden" name="promptSource" value="manual" />
          <input type="hidden" name="reviewDepth" value="one_click" />
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {row.signals.adaptiveScoreKeys.map((key) => (
            <input key={key} type="hidden" name={key} value={adaptiveQuickScore(tone)} />
          ))}
          <button
            type="submit"
            className={clsx(
              'flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition hover:-translate-y-0.5',
              tone === 'strong' && 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
              tone === 'good' && 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
              tone === 'weak' && 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
              tone === 'avoid' && 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
            )}
            title={`One-click score as ${label}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}

function Badge({ tone, children }: { tone: 'brand' | 'good' | 'muted'; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-1 text-[10px] font-bold shadow-sm backdrop-blur',
        tone === 'brand' && 'bg-brand text-on-brand',
        tone === 'good' && 'bg-emerald-500 text-white',
        tone === 'muted' && 'bg-white/90 text-text-secondary'
      )}
    >
      {children}
    </span>
  );
}

function mergeTags(row: PromptIntelligenceReviewSummary, extra: string[]): string {
  return Array.from(new Set([...row.signals.suggestedTags, ...extra])).join(', ');
}

function adaptiveQuickScore(tone: 'strong' | 'good' | 'weak' | 'avoid'): string {
  if (tone === 'strong') return '5';
  if (tone === 'good') return '4';
  if (tone === 'weak') return '2';
  return '1';
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-text-primary">{value}</dd>
    </div>
  );
}
