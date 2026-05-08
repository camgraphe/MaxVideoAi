import { ExternalLink } from 'lucide-react';
import { SeoCopyButton } from '@/components/admin/SeoCopyButton';
import type {
  CodexSeoAction,
  SeoFamilyTrackerItem,
  SeoIntentType,
  StrategicSeoOpportunity,
  UnifiedPageActionBrief,
} from '@/lib/seo/internal-seo-types';
import { compactIntentLabel } from '@/lib/seo/seo-intents';
import { stripOrigin } from '@/lib/seo/seo-opportunity-engine';
import { labelizeUrlInspectionStatus } from '@/lib/seo/url-inspection';

const numberFormatter = new Intl.NumberFormat('en-US');
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const precisePercentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const positionFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function PageActionBriefCard({ brief, rank, featured = false }: { brief: UnifiedPageActionBrief; rank: number; featured?: boolean }) {
  return (
    <article className={featured ? 'rounded-2xl border border-info/25 bg-info/10 p-4 shadow-card' : 'rounded-2xl border border-hairline bg-bg/60 p-4'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className={featured ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white' : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-sm font-semibold text-text-secondary'}>
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityPill priority={brief.priority} />
              <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{brief.family}</span>
              <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{compactIntentLabel(brief.intent)}</span>
              {brief.pageStatus ? (
                <span className="rounded-full border border-success/25 bg-success-bg px-2 py-1 text-[11px] font-semibold text-success">{labelizeUrlInspectionStatus(brief.pageStatus)}</span>
              ) : null}
            </div>
            <h2 className={featured ? 'mt-3 text-base font-semibold leading-6 text-text-primary' : 'mt-3 text-sm font-semibold leading-6 text-text-primary'}>
              {brief.queryCluster}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{brief.observedProblem}</p>
          </div>
        </div>
        <SeoCopyButton value={brief.copyReadyCodexTask} />
      </div>
      <div className="mt-4 grid gap-4 border-t border-hairline pt-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Recommended implementation</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{brief.recommendedImplementation}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {brief.sourceModules.map((module) => (
              <span key={module} className="rounded-full border border-hairline bg-surface px-2 py-1 text-[11px] font-semibold text-text-secondary">
                {module.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
        <aside className="min-w-0 rounded-xl border border-hairline bg-surface px-3 py-3 text-xs text-text-secondary">
          <p className="font-semibold text-text-primary">{brief.metricsSummary}</p>
          <a href={brief.targetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 hover:text-text-primary">
            <span className="truncate">{brief.targetUrl}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          <p className="mt-3 text-text-muted">{brief.supportingActions.length} supporting actions · {brief.acceptanceCriteria.length} acceptance checks</p>
        </aside>
      </div>
    </article>
  );
}

export function ActionCard({ action, rank, featured = false }: { action: CodexSeoAction; rank: number; featured?: boolean }) {
  return (
    <article className={featured ? 'rounded-2xl border border-warning-border bg-warning-bg/40 p-4 shadow-card' : 'rounded-2xl border border-hairline bg-bg/60 p-4'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span className={featured ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white' : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-sm font-semibold text-text-secondary'}>
            {rank}
          </span>
          <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={action.priority} />
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{action.family}</span>
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{compactIntentLabel(action.intent)}</span>
          </div>
          <h2 className={featured ? 'mt-3 text-base font-semibold leading-6 text-text-primary' : 'mt-3 text-sm font-semibold leading-6 text-text-primary'}>{action.title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{action.observedIssue}</p>
          </div>
        </div>
        <SeoCopyButton value={action.markdown} />
      </div>
      <div className="mt-3 grid gap-3 border-t border-hairline pt-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Recommended implementation</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{action.recommendedImplementation}</p>
        </div>
        <div className="text-xs text-text-secondary">
          <p className="font-semibold text-text-primary">{action.metricsSummary}</p>
          {action.targetUrl ? (
            <a href={action.targetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 hover:text-text-primary">
              <span className="truncate">{stripOrigin(action.targetUrl)}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function FamilyStrategyCard({ family }: { family: SeoFamilyTrackerItem }) {
  return (
    <article className="group rounded-2xl border border-hairline bg-bg/60 p-4 transition hover:border-border hover:bg-surface">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{family.family}</p>
            <FamilyStatusPill status={family.familyStatus} />
          </div>
          <p className="mt-1 text-xs font-semibold text-text-muted">{family.businessPriorityLabel} · {family.momentum}</p>
        </div>
        <span className={family.highPriorityOpportunityCount ? 'rounded-full bg-warning-bg px-2 py-1 text-xs font-semibold text-warning' : 'rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-text-secondary'}>
          {family.opportunityCount} opp · {family.highPriorityOpportunityCount} high
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <MetricChip label="Clicks" value={numberFormatter.format(family.clicks)} />
        <MetricChip label="Impr." value={compactFormatter.format(family.impressions)} />
        <MetricChip label="CTR" value={precisePercentFormatter.format(family.ctr)} />
        <MetricChip label="Pos." value={positionFormatter.format(family.position)} />
      </div>
      <p className="mt-3 text-sm leading-6 text-text-secondary">{family.recommendedNextAction}</p>
      {family.topQueryClusters.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {family.topQueryClusters.slice(0, 3).map((cluster, index) => (
            <span key={`${family.family}-${cluster}-${index}`} className="rounded-full border border-hairline bg-surface px-2 py-1 text-[11px] font-medium text-text-secondary">{cluster}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function CodexPreviewCard({ action }: { action: CodexSeoAction }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={action.priority} />
            <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{action.family}</span>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-text-primary">{action.title}</p>
          <p className="mt-1 text-xs text-text-secondary">{action.metricsSummary}</p>
        </div>
        <SeoCopyButton value={action.markdown} label="Copy" />
      </div>
      <div className="mt-3 rounded-xl border border-hairline bg-surface px-3 py-2">
        <p className="text-xs leading-5 text-text-secondary">{action.recommendedImplementation}</p>
      </div>
    </article>
  );
}

export function OpportunityClusterGrid({ opportunities }: { opportunities: StrategicSeoOpportunity[] }) {
  const groups = buildIntentGroups(opportunities);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <div key={group.label} className="rounded-2xl border border-hairline bg-bg/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">{group.label}</p>
              <p className="mt-1 text-xs text-text-secondary">{group.items.length} opportunities</p>
            </div>
            <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-text-secondary">
              {group.items.filter((item) => item.priority === 'critical' || item.priority === 'high').length} high
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {group.items.slice(0, 4).map((opportunity) => (
              <div key={opportunity.id} className="border-t border-hairline pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{opportunity.queryCluster}</p>
                    <p className="mt-1 text-xs text-text-secondary">{opportunity.modelFamily} · {stripOrigin(opportunity.targetUrl)}</p>
                  </div>
                  <PriorityPill priority={opportunity.priority} />
                </div>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{opportunity.suggestedAction}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-2 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text-primary">{value}</p>
    </div>
  );
}

export function PriorityPill({ priority }: { priority: CodexSeoAction['priority'] }) {
  const base = 'inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]';
  if (priority === 'critical') return <span className={`${base} border-warning-border bg-warning-bg text-warning`}>Critical</span>;
  if (priority === 'high') return <span className={`${base} border-info/25 bg-info/10 text-info`}>High</span>;
  if (priority === 'medium') return <span className={`${base} border-hairline bg-surface-2 text-text-secondary`}>Medium</span>;
  return <span className={`${base} border-hairline bg-surface text-text-muted`}>Low</span>;
}

function buildIntentGroups(opportunities: StrategicSeoOpportunity[]) {
  const definitions: Array<{ label: string; intents: SeoIntentType[] }> = [
    { label: 'Prompt / Examples', intents: ['prompt_examples', 'prompt_guide', 'examples'] },
    { label: 'Comparisons', intents: ['comparison'] },
    { label: 'Pricing / Specs', intents: ['pricing_specs', 'pricing', 'specs', 'max_length'] },
    { label: 'Pay-as-you-go / No subscription', intents: ['pay_as_you_go'] },
    { label: 'Brand / Typos', intents: ['brand', 'brand_typo'] },
    { label: 'Model pages to strengthen', intents: ['model_page', 'generic', 'image_to_video', 'text_to_video'] },
  ];

  return definitions
    .map((definition) => ({
      label: definition.label,
      items: opportunities.filter((opportunity) => definition.intents.includes(opportunity.intent)),
    }))
    .filter((group) => group.items.length > 0);
}

function FamilyStatusPill({ status }: { status: SeoFamilyTrackerItem['familyStatus'] }) {
  const base = 'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]';
  if (status === 'strategic') return <span className={`${base} bg-success-bg text-success`}>Strategic</span>;
  if (status === 'supported') return <span className={`${base} bg-info/10 text-info`}>Supported</span>;
  if (status === 'emerging') return <span className={`${base} bg-surface-2 text-text-secondary`}>Emerging</span>;
  if (status === 'deprioritized') return <span className={`${base} bg-warning-bg text-warning`}>De-prioritized</span>;
  if (status === 'brand') return <span className={`${base} bg-surface-2 text-text-secondary`}>Brand</span>;
  return <span className={`${base} bg-surface-2 text-text-muted`}>Unknown</span>;
}
