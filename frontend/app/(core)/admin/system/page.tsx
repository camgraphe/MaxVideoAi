import { BellRing, Clock3, Eye, LayoutTemplate } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { getServiceNoticeSetting } from '@/server/app-settings';
import { fetchAdminAuditLogs } from '@/server/admin-audit';
import { ServiceNoticeForm } from '@/components/admin/ServiceNoticeForm';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { ButtonLink } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function AdminSystemPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/system] access denied', error);
    notFound();
  }

  const [notice, auditLogs] = await Promise.all([
    getServiceNoticeSetting(),
    fetchAdminAuditLogs({ limit: 6, action: 'SERVICE_NOTICE_UPDATE' }),
  ]);
  const metrics = buildNoticeMetrics(notice, auditLogs[0]?.createdAt ?? null);
  const databaseConfigured = Boolean(process.env.DATABASE_URL);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Service notice"
        description="Pilotage de la bannière incident visible dans le workspace. On garde ici la rédaction, l’activation et l’historique opérationnel de ce canal."
        actions={
          <>
            <ButtonLink href="/admin/audit?action=SERVICE_NOTICE_UPDATE" variant="outline" size="sm" className="border-border bg-surface">
              Audit
            </ButtonLink>
            <ButtonLink href="/admin/insights" variant="outline" size="sm" className="border-border bg-surface">
              Insights
            </ButtonLink>
            <ButtonLink href="/admin/theme" variant="outline" size="sm" className="border-border bg-surface">
              Theme
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Notice Pulse"
        description="Statut, portée et fraîcheur de la bannière pour savoir si une communication incident est réellement en production."
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_340px] xl:items-start">
        <AdminSection
          title="Notice Workspace"
          description="Rédige le message, active la bannière et visualise immédiatement le rendu qui sera vu par les membres."
          action={
            <AdminSectionMeta
              title={notice.enabled ? 'Banner currently live' : 'Banner currently off'}
              lines={[
                notice.message ? `${notice.message.length}/500 characters` : 'No active copy',
                'Changes apply to the workspace header',
              ]}
            />
          }
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-hairline bg-bg/40 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Live preview</p>
              {notice.enabled ? (
                <div className="mt-3 rounded-2xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning">
                  {notice.message}
                </div>
              ) : (
                <AdminEmptyState>No incident banner is currently shown to members.</AdminEmptyState>
              )}
            </div>

            {databaseConfigured ? (
              <ServiceNoticeForm initialNotice={notice} embedded />
            ) : (
              <AdminNotice tone="warning">
                Database access is not configured. The banner preview is read-only until <code className="font-mono text-xs">DATABASE_URL</code> is restored.
              </AdminNotice>
            )}
          </div>
        </AdminSection>

        <div className="xl:sticky xl:top-[5.75rem]">
          <AdminSection title="Guidance" description="Rappels de diffusion pour garder la bannière utile et courte.">
            <div className="space-y-4">
              <AdminNotice tone={notice.enabled ? 'warning' : 'default'}>
                {notice.enabled
                  ? 'The service banner is live. Keep the copy short and actionable, then remove it as soon as the incident is resolved.'
                  : 'The service banner is currently off. Use it only for workspace-wide impact, not for isolated support cases.'}
              </AdminNotice>

              <div className="space-y-3 rounded-2xl border border-hairline bg-bg/40 px-4 py-4 text-sm text-text-secondary">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">When to use it</p>
                  <p className="mt-1">Provider outage, queue degradation, billing disruption or any issue affecting a broad slice of members.</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Copy pattern</p>
                  <p className="mt-1">State the impact, mention whether new renders are delayed, and avoid internal jargon or speculative timing.</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Follow-up</p>
                  <p className="mt-1">Pair banner changes with the audit trail and remove the message as soon as the incident is resolved.</p>
                </div>
              </div>
            </div>
          </AdminSection>
        </div>
      </div>

      <AdminSection
        title="Recent Updates"
        description="Dernières modifications de bannière pour comprendre qui a publié quoi et à quel moment."
      >
        {auditLogs.length ? (
          <div className="overflow-x-auto rounded-2xl border border-hairline">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface">
                <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold">Admin</th>
                  <th className="px-4 py-3 font-semibold">State</th>
                  <th className="px-4 py-3 font-semibold">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline bg-bg/30">
                {auditLogs.map((log) => {
                  const preview = typeof log.metadata?.preview === 'string' ? log.metadata.preview : '';
                  const enabled = log.metadata?.enabled === true;
                  const messageLength = typeof log.metadata?.messageLength === 'number' ? log.metadata.messageLength : 0;

                  return (
                    <tr key={log.id} className="align-top text-text-secondary">
                      <td className="px-4 py-3 text-xs">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-primary">{log.adminEmail ?? truncateId(log.adminId)}</p>
                        <p className="font-mono text-[11px] text-text-muted">{log.adminId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                          enabled ? 'border-warning-border bg-warning-bg text-warning' : 'border-border bg-surface text-text-secondary'
                        }`}>
                          {enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <p className="mt-2 text-xs text-text-muted">{messageLength} characters</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{preview || 'Banner cleared'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState>No service-notice updates recorded yet.</AdminEmptyState>
        )}
      </AdminSection>
    </div>
  );
}

function buildNoticeMetrics(
  notice: Awaited<ReturnType<typeof getServiceNoticeSetting>>,
  lastUpdatedAt: string | null
): AdminMetricItem[] {
  return [
    {
      label: 'Status',
      value: notice.enabled ? 'Live' : 'Off',
      helper: notice.enabled ? 'Members currently see the banner' : 'No workspace-wide incident copy',
      tone: notice.enabled ? 'warning' : 'default',
      icon: BellRing,
    },
    {
      label: 'Message length',
      value: String(notice.message.length),
      helper: 'Keep copy concise and actionable',
      icon: Eye,
    },
    {
      label: 'Visibility',
      value: 'Workspace',
      helper: 'Displayed to all app members',
      icon: LayoutTemplate,
    },
    {
      label: 'Last update',
      value: lastUpdatedAt ? formatDateTime(lastUpdatedAt) : 'No log',
      helper: 'Recent admin publication event',
      icon: Clock3,
    },
  ];
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateTimeFormatter.format(parsed);
}

function truncateId(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
