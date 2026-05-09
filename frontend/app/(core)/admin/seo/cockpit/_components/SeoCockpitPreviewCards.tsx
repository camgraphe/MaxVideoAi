import {
  Activity,
  ArrowRight,
  ExternalLink,
  FileQuestion,
  Network,
  SearchCheck,
  Stethoscope,
} from 'lucide-react';
import type {
  ContentMomentumItem,
  CtrDoctorItem,
  InternalLinkSuggestion,
  MissingContentItem,
  UrlInspectionItem,
} from '@/lib/seo/internal-seo-types';
import { labelizeMomentumType } from '@/lib/seo/content-momentum';
import { labelizeInternalLinkType } from '@/lib/seo/internal-link-builder';
import { labelizeRecommendation } from '@/lib/seo/missing-content';
import { compactIntentLabel } from '@/lib/seo/seo-intents';
import { stripOrigin } from '@/lib/seo/seo-opportunity-engine';
import { labelizeUrlInspectionStatus } from '@/lib/seo/url-inspection';
import { MetricChip, PriorityPill } from './SeoCockpitActionCards';

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function CtrDoctorCard({ item }: { item: CtrDoctorItem }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <Stethoscope className="h-4 w-4" />
        </span>
        <PriorityPill priority={item.priority} />
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">{item.title}</p>
      <p className="mt-2 text-xs text-text-secondary">
        {item.queryCluster} · {compactIntentLabel(item.detectedIntent)}
      </p>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{item.likelyProblem}</p>
      <div className="mt-3 rounded-xl border border-hairline bg-surface px-3 py-2">
        <p className="text-xs leading-5 text-text-secondary">{item.recommendedTitleDirection}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>{item.currentMetrics.impressions} impr · {(item.currentMetrics.ctr * 100).toFixed(2)}% CTR · pos {item.currentMetrics.averagePosition.toFixed(1)}</span>
        {item.targetUrl ? (
          <a href={item.targetUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 hover:text-text-primary">
            <span className="truncate">{stripOrigin(item.targetUrl)}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function MissingContentCard({ item }: { item: MissingContentItem }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <FileQuestion className="h-4 w-4" />
        </span>
        <PriorityPill priority={item.priority} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {labelizeRecommendation(item.recommendationType)}
        </span>
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {item.family}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">{item.queryCluster}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{item.recommendedAction}</p>
      <div className="mt-3 rounded-xl border border-hairline bg-surface px-3 py-2">
        <p className="text-xs leading-5 text-text-secondary">{item.whyNotCreatePage ?? item.whyThisAction}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>{item.currentMetrics.impressions} impr · {(item.currentMetrics.ctr * 100).toFixed(2)}% CTR · pos {item.currentMetrics.averagePosition.toFixed(1)}</span>
        {item.targetUrl ? (
          <a href={item.targetUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 hover:text-text-primary">
            <span className="truncate">{stripOrigin(item.targetUrl)}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function InternalLinkCard({ item }: { item: InternalLinkSuggestion }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <Network className="h-4 w-4" />
        </span>
        <PriorityPill priority={item.priority} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {labelizeInternalLinkType(item.recommendationType)}
        </span>
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {item.family}
        </span>
      </div>
      <div className="mt-3 rounded-xl border border-hairline bg-surface px-3 py-3">
        <div className="grid gap-2 text-xs text-text-secondary">
          <span className="truncate font-semibold text-text-primary">{item.sourceUrl}</span>
          <span className="inline-flex items-center gap-2 text-text-muted">
            <ArrowRight className="h-3.5 w-3.5" />
            Suggested link
          </span>
          <span className="truncate font-semibold text-text-primary">{item.targetUrl}</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">{item.suggestedAnchor}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{item.reason}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>{item.currentMetrics.impressions} impr · {(item.currentMetrics.ctr * 100).toFixed(2)}% CTR · pos {item.currentMetrics.averagePosition.toFixed(1)}</span>
        {item.verifyExistingLinkFirst ? <span className="font-semibold text-text-muted">Verify first</span> : null}
      </div>
    </article>
  );
}

export function MomentumCard({ item }: { item: ContentMomentumItem }) {
  const rising = item.impressionDelta >= 0 || item.clickDelta >= 0;
  const mixed = item.type === 'mixed_family_momentum';
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <Activity className="h-4 w-4" />
        </span>
        <PriorityPill priority={item.priority} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={mixed ? 'rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary' : rising ? 'rounded-full border border-success/25 bg-success-bg px-2 py-1 text-[11px] font-semibold text-success' : 'rounded-full border border-warning-border bg-warning-bg px-2 py-1 text-[11px] font-semibold text-warning'}>
          {labelizeMomentumType(item.type)}
        </span>
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {item.family}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">
        {item.queryCluster ?? (item.pageUrl ? stripOrigin(item.pageUrl) : item.family)}
      </p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{item.recommendedAction}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MetricChip label="Clicks" value={`${formatSigned(item.clickDelta)} (${item.current.clicks})`} />
        <MetricChip label="Impr." value={`${formatSigned(item.impressionDelta)} (${item.current.impressions})`} />
        <MetricChip label="CTR" value={`${formatSignedPercent(item.ctrDelta)} now ${(item.current.ctr * 100).toFixed(2)}%`} />
        <MetricChip label="Pos." value={`${formatSigned(item.positionDelta)} now ${item.current.averagePosition.toFixed(1)}`} />
      </div>
      {item.pageUrl ? (
        <a href={item.pageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1 text-xs text-text-secondary hover:text-text-primary">
          <span className="truncate">{stripOrigin(item.pageUrl)}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : null}
    </article>
  );
}

export function UrlInspectionPreviewCard({ item }: { item: UrlInspectionItem }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <SearchCheck className="h-4 w-4" />
        </span>
        <span className={item.severity === 'ok' ? 'rounded-full border border-success/25 bg-success-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-success' : item.severity === 'unknown' ? 'rounded-full border border-hairline bg-surface px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted' : 'rounded-full border border-warning-border bg-warning-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-warning'}>
          {item.severity}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">{item.path}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {labelizeUrlInspectionStatus(item.status)}
        </span>
        {item.sources.slice(0, 2).map((source) => (
          <span key={source} className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
            {source.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{item.suggestedAction}</p>
      <p className="mt-3 text-xs text-text-secondary">
        {item.lastInspectedAt ? `Last inspected ${dateTimeFormatter.format(new Date(item.lastInspectedAt))}` : 'Not inspected yet'}
      </p>
    </article>
  );
}

function formatSigned(value: number) {
  if (!Number.isFinite(value)) return '0';
  return `${value > 0 ? '+' : ''}${value.toFixed(Number.isInteger(value) ? 0 : 1)}`;
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) return '+0.00%';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}
