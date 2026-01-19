import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { fetchAdminAuditLogs } from '@/server/admin-audit';

export const dynamic = 'force-dynamic';

export default async function AdminAuditLogPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/audit] access denied', error);
    notFound();
  }

  const logs = await fetchAdminAuditLogs(100);

  return (
    <div className="stack-gap-lg">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text-primary">Admin audit log</h1>
        <p className="text-sm text-text-secondary">
          Mirror of sensitive actions (impersonation, resync, etc.). Entries are stored in Postgres for internal traceability.
        </p>
      </header>
      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-surface-glass-95 p-4 shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
              <th className="py-2 font-semibold">Timestamp</th>
              <th className="py-2 font-semibold">Admin</th>
              <th className="py-2 font-semibold">Action</th>
              <th className="py-2 font-semibold">Target</th>
              <th className="py-2 font-semibold">Route</th>
              <th className="py-2 font-semibold">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logs.length ? (
              logs.map((log) => (
                <tr key={log.id} className="border-t border-border/40 text-text-secondary">
                  <td className="py-2 text-xs">{formatDate(log.createdAt)}</td>
                  <td className="py-2">
                    <div className="text-sm text-text-primary">{log.adminEmail ?? log.adminId}</div>
                    <div className="text-xs text-text-muted">#{log.adminId}</div>
                  </td>
                  <td className="py-2 font-semibold text-text-primary">{log.action}</td>
                  <td className="py-2">
                    {log.targetUserId ? (
                      <>
                        <div className="text-sm text-text-primary">{log.targetEmail ?? log.targetUserId}</div>
                        <div className="text-xs text-text-muted">#{log.targetUserId}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 text-xs font-mono">{log.route ?? '—'}</td>
                  <td className="py-2">
                    {log.metadata ? (
                      <pre className="max-h-32 overflow-auto rounded bg-bg px-3 py-2 text-xs">{JSON.stringify(log.metadata, null, 2)}</pre>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-4 text-center text-text-secondary">
                  No audit events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}
