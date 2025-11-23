import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { fetchEnginePerformanceMetrics } from '@/server/generate-metrics';

export const dynamic = 'force-dynamic';

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export default async function AdminEnginesPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/engines] access denied', error);
    notFound();
  }

  const metrics = await fetchEnginePerformanceMetrics();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Analytics</p>
        <h1 className="text-3xl font-semibold text-text-primary">Engine performance</h1>
        <p className="text-sm text-text-secondary">
          Rolling 30-day summary of render attempts, rejections, and completion times per engine/mode.
        </p>
      </header>

      <div className="overflow-x-auto rounded-[32px] border border-white/30 bg-white/80 p-6 shadow-card">
        <table className="min-w-full divide-y divide-white/60 text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.3em] text-text-muted">
              <th className="pb-3 text-left">Engine</th>
              <th className="pb-3 text-left">Mode</th>
              <th className="pb-3 text-right">Accepted</th>
              <th className="pb-3 text-right">Rejected</th>
              <th className="pb-3 text-right">Completed</th>
              <th className="pb-3 text-right">Failed</th>
              <th className="pb-3 text-right">Avg duration</th>
              <th className="pb-3 text-right">P95 duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/50">
            {metrics.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-text-secondary">
                  No generate metrics recorded yet.
                </td>
              </tr>
            ) : (
              metrics.map((row) => (
                <tr key={`${row.engineId}-${row.mode}`}>
                  <td className="py-3 font-medium text-text-primary">{row.engineLabel}</td>
                  <td className="py-3 text-text-secondary">{row.mode}</td>
                  <td className="py-3 text-right font-semibold text-text-primary">{formatNumber(row.acceptedCount)}</td>
                  <td className="py-3 text-right text-text-secondary">{formatNumber(row.rejectedCount)}</td>
                  <td className="py-3 text-right text-text-secondary">{formatNumber(row.completedCount)}</td>
                  <td className="py-3 text-right text-text-secondary">{formatNumber(row.failedCount)}</td>
                  <td className="py-3 text-right text-text-primary">{formatDuration(row.averageDurationMs)}</td>
                  <td className="py-3 text-right text-text-primary">{formatDuration(row.p95DurationMs)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
