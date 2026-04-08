import Link from 'next/link';
import { Inbox, MailCheck, Sheet, UserRound } from 'lucide-react';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { isDatabaseConfigured } from '@/lib/db';
import { fetchMarketingOptIns } from '@/server/admin-marketing';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminMarketingOptInsPage() {
  const csvHref = '/api/admin/marketing/opt-ins?format=csv';

  if (!isDatabaseConfigured()) {
    return (
      <div className="flex flex-col gap-5">
        <AdminPageHeader
          eyebrow="Growth ops"
          title="Marketing opt-ins"
          description="Suivi des consentements marketing exportables vers les outils CRM et emailing."
          actions={
            <>
              <AdminActionLink href="/admin/legal">
                Legal
              </AdminActionLink>
              <AdminActionLink href={csvHref} prefetch={false}>
                Export CSV
              </AdminActionLink>
            </>
          }
        />
        <AdminSection title="Marketing Opt-ins" description="Database access is required to load marketing consent history.">
          <AdminNotice tone="warning">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to view marketing consent stats.
          </AdminNotice>
        </AdminSection>
      </div>
    );
  }

  const records = await fetchMarketingOptIns();
  const now = Date.now();
  const last7 = records.filter((record) => record.optedInAt && new Date(record.optedInAt).getTime() >= now - 7 * DAY_MS).length;
  const last30 = records.filter((record) => record.optedInAt && new Date(record.optedInAt).getTime() >= now - 30 * DAY_MS).length;
  const latestOptIn = records
    .map((record) => record.optedInAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const metrics = buildMarketingMetrics(records.length, last7, last30, latestOptIn);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Growth ops"
        title="Marketing opt-ins"
        description="Tracke les membres qui ont accepté les emails promotionnels. La table reste exportable pour synchroniser CRM, ESP ou campagnes one-off."
        actions={
          <>
            <AdminActionLink href="/admin/legal">
              Legal
            </AdminActionLink>
            <AdminActionLink href="/admin/users">
              Users
            </AdminActionLink>
            <AdminActionLink href={csvHref} prefetch={false}>
              Export CSV
            </AdminActionLink>
          </>
        }
      />

      <AdminSection
        title="Consent Pulse"
        description="Lecture rapide du volume d’opt-ins et de leur fraîcheur avant export ou investigation utilisateur."
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <AdminNotice tone="info">
        This list updates whenever members toggle their marketing preference inside <strong>Settings → Notifications</strong>.
      </AdminNotice>

      <AdminSection
        title="Subscriber Ledger"
        description="Historique exportable des membres ayant accepté les communications marketing."
        action={
          <AdminSectionMeta
            title={`${records.length} subscribed members`}
            lines={[
              latestOptIn ? `Latest opt-in ${formatDate(latestOptIn)}` : 'No opt-ins recorded yet',
              'CSV export is available at any time',
            ]}
          />
        }
      >
        {records.length === 0 ? (
          <AdminEmptyState>No marketing opt-ins recorded yet.</AdminEmptyState>
        ) : (
          <AdminDataTable>
            <thead className="bg-surface">
              <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">User ID</th>
                <th className="px-4 py-3 font-semibold">Opt-in date</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline bg-bg/30">
              {records.map((record) => (
                <tr key={record.userId} className="align-top text-text-secondary hover:bg-bg/50">
                  <td className="px-4 py-3 text-text-primary">{record.email ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{record.userId}</td>
                  <td className="px-4 py-3">{formatDate(record.optedInAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${record.userId}`}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-input border border-hairline px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-border-hover hover:bg-surface-hover"
                    >
                      View member
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminDataTable>
        )}
      </AdminSection>
    </div>
  );
}

function buildMarketingMetrics(
  total: number,
  last7: number,
  last30: number,
  latestOptIn: string | null
): AdminMetricItem[] {
  return [
    {
      label: 'Total opt-ins',
      value: String(total),
      helper: 'Members currently subscribed to marketing updates',
      icon: MailCheck,
    },
    {
      label: 'Last 7 days',
      value: String(last7),
      helper: 'Recent marketing consent captures',
      tone: last7 ? 'success' : 'default',
      icon: Inbox,
    },
    {
      label: 'Last 30 days',
      value: String(last30),
      helper: 'Rolling monthly opt-in volume',
      tone: last30 ? 'info' : 'default',
      icon: Sheet,
    },
    {
      label: 'Latest opt-in',
      value: latestOptIn ? formatDate(latestOptIn) : '—',
      helper: 'Most recent consent event on record',
      icon: UserRound,
    },
  ];
}
