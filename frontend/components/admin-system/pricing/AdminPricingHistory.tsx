'use client';

import type { PricingChangeEvent } from '@/lib/admin/pricing-change-contract';
import { Button } from '@/components/ui/Button';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';

type AdminPricingHistoryProps = {
  events: PricingChangeEvent[];
  title: string;
  description: string;
  emptyLabel: string;
  locked: boolean;
  onPreviewRollback: (event: PricingChangeEvent) => void;
};

function formatDelta(event: PricingChangeEvent): string {
  const minimumDeltaCents = event.previewSummary.minimumDeltaCents;
  const maximumDeltaCents = event.previewSummary.maximumDeltaCents;
  if (
    typeof minimumDeltaCents === 'number' && Number.isFinite(minimumDeltaCents) &&
    typeof maximumDeltaCents === 'number' && Number.isFinite(maximumDeltaCents)
  ) {
    const format = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('en-US')}¢`;
    return minimumDeltaCents === maximumDeltaCents
      ? format(minimumDeltaCents)
      : `${format(minimumDeltaCents)} to ${format(maximumDeltaCents)}`;
  }
  const deltaCents = event.previewSummary.deltaCents;
  if (typeof deltaCents !== 'number' || !Number.isFinite(deltaCents)) return 'Not recorded';
  const sign = deltaCents > 0 ? '+' : '';
  return `${sign}${deltaCents.toLocaleString('en-US')}¢`;
}

export function AdminPricingHistory({
  events,
  title,
  description,
  emptyLabel,
  locked,
  onPreviewRollback,
}: AdminPricingHistoryProps) {
  return (
    <AdminSection title={title} description={description}>
      {events.length ? (
        <AdminDataTable tableClassName="min-w-[900px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">Operation</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Delta</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-t border-hairline text-sm">
                <td className="px-4 py-3 text-text-secondary">{new Date(event.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-primary">{event.targetId}</td>
                <td className="px-4 py-3 font-medium text-text-primary">{event.operation}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-muted">{event.actorId}</td>
                <td className="px-4 py-3 text-text-secondary">{formatDelta(event)}</td>
                <td className="px-4 py-3">
                  {event.previousState ? (
                    <Button type="button" variant="outline" onClick={() => onPreviewRollback(event)} disabled={locked}>
                      Preview rollback
                    </Button>
                  ) : (
                    <span className="text-text-muted">Not restorable</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      ) : (
        <AdminEmptyState>{emptyLabel}</AdminEmptyState>
      )}
    </AdminSection>
  );
}
