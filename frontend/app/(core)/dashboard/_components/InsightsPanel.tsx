import { CalendarDays } from 'lucide-react';
import { DEFAULT_DASHBOARD_COPY, type DashboardCopy } from '../_lib/dashboard-copy';
import { MetricDot, SectionGlyph } from './DashboardGlyphs';

export function InsightsPanel({
  copy,
  spendToday,
  spend30,
  avgCost,
  runway,
  runwayFallback,
  mostUsed,
}: {
  copy: DashboardCopy;
  spendToday: string;
  spend30: string;
  avgCost: string;
  runway: string;
  runwayFallback: string | null;
  mostUsed: string | null;
}) {
  const metrics: Array<{ label: string; value: string; tone: 'brand' | 'accent' | 'success' | 'muted' }> = [
    { label: copy.insights.spendToday, value: spendToday, tone: 'brand' },
    { label: copy.insights.spend30, value: spend30, tone: 'accent' },
    { label: copy.insights.avgCost, value: avgCost, tone: 'muted' },
    { label: copy.insights.runway, value: runway, tone: 'success' },
  ];

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2.5">
          <SectionGlyph />
          <h3 className="text-lg font-semibold text-text-primary">{copy.insights.title}</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-input border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-primary">
          {copy.insights.today ?? DEFAULT_DASHBOARD_COPY.insights.today}
          <CalendarDays className="h-3.5 w-3.5 text-text-muted" aria-hidden />
        </span>
      </div>
      <div className="grid gap-2 px-4 py-3 text-sm">
        {metrics.map((metric) => (
          <InsightRow
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
          />
        ))}
      </div>
      <div className="border-t border-hairline px-4 py-3">
        {runwayFallback ? (
          <p className="text-xs text-text-muted">{runwayFallback}</p>
        ) : null}
        {mostUsed ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
            <MetricDot tone="brand" />
            <span>
              {copy.insights.mostUsed}: <span className="font-semibold text-text-primary">{mostUsed}</span>
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function InsightRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'brand' | 'accent' | 'success' | 'muted';
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-input border border-hairline bg-surface-2/70 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <MetricDot tone={tone} />
        <span className="truncate text-text-muted">{label}</span>
      </div>
      <span className="shrink-0 font-semibold text-text-primary">{value}</span>
    </div>
  );
}

