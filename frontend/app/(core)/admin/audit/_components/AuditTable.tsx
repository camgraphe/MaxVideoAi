import Link from 'next/link';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import type { AdminAuditLog } from '@/server/admin-audit';
import {
  formatActionLabel,
  formatDateTime,
  truncateId,
} from '../_lib/admin-audit-helpers';

export function AuditTable({ logs }: { logs: AdminAuditLog[] }) {
  return (
    <AdminDataTable>
      <thead className="bg-surface">
        <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
          <th className="px-4 py-3 font-semibold">Timestamp</th>
          <th className="px-4 py-3 font-semibold">Action</th>
          <th className="px-4 py-3 font-semibold">Admin</th>
          <th className="px-4 py-3 font-semibold">Target</th>
          <th className="px-4 py-3 font-semibold">Context</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline bg-bg/30">
        {logs.map((log) => (
          <tr key={log.id} className="align-top text-text-secondary">
            <td className="px-4 py-3 text-xs">{formatDateTime(log.createdAt)}</td>
            <td className="px-4 py-3">
              <AuditActionBadge action={log.action} />
            </td>
            <td className="px-4 py-3">
              <UserIdentityCell userId={log.adminId} email={log.adminEmail} />
            </td>
            <td className="px-4 py-3">
              {log.targetUserId ? <UserIdentityCell userId={log.targetUserId} email={log.targetEmail} /> : <span className="text-text-muted">—</span>}
            </td>
            <td className="px-4 py-3">
              <AuditContextCell log={log} />
            </td>
          </tr>
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function UserIdentityCell({ userId, email }: { userId: string; email: string | null }) {
  return (
    <div className="space-y-1">
      <Link href={`/admin/users/${userId}`} className="block text-sm font-medium text-text-primary underline-offset-2 hover:underline">
        {email ?? truncateId(userId)}
      </Link>
      <p className="font-mono text-[11px] text-text-muted">{userId}</p>
    </div>
  );
}

function AuditActionBadge({ action }: { action: string }) {
  const toneClass =
    action === 'FORCE_RESYNC_JOB'
      ? 'border-warning-border bg-warning-bg text-warning'
      : action === 'SERVICE_NOTICE_UPDATE'
        ? 'border-warning-border bg-warning-bg text-warning'
      : action === 'THEME_TOKENS_UPDATE' || action === 'THEME_TOKENS_RESET'
        ? 'border-info-border bg-info-bg text-info'
      : action === 'HOMEPAGE_SECTION_CREATE' || action === 'HOMEPAGE_SECTION_UPDATE' || action === 'HOMEPAGE_SECTION_DELETE'
        ? 'border-success-border bg-success-bg text-success'
      : action === 'IMPERSONATE_START'
        ? 'border-info-border bg-info-bg text-info'
        : 'border-success-border bg-success-bg text-success';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
      {formatActionLabel(action)}
    </span>
  );
}

function AuditContextCell({ log }: { log: AdminAuditLog }) {
  const metadata = log.metadata ?? null;
  const jobId = typeof metadata?.jobId === 'string' ? metadata.jobId : null;
  const engineId = typeof metadata?.engineId === 'string' ? metadata.engineId : null;
  const redirectTo = typeof metadata?.redirectTo === 'string' ? metadata.redirectTo : null;
  const returnTo = typeof metadata?.returnTo === 'string' ? metadata.returnTo : null;
  const preview = typeof metadata?.preview === 'string' ? metadata.preview : null;
  const messageLength = typeof metadata?.messageLength === 'number' ? metadata.messageLength : null;
  const sectionId = typeof metadata?.sectionId === 'string' ? metadata.sectionId : null;
  const sectionKey = typeof metadata?.sectionKey === 'string' ? metadata.sectionKey : null;
  const sectionType = typeof metadata?.sectionType === 'string' ? metadata.sectionType : null;
  const lightCount = typeof metadata?.lightCount === 'number' ? metadata.lightCount : null;
  const darkCount = typeof metadata?.darkCount === 'number' ? metadata.darkCount : null;
  const advancedCount = typeof metadata?.advancedCount === 'number' ? metadata.advancedCount : null;
  const keysPreview = Array.isArray(metadata?.keysPreview)
    ? metadata.keysPreview.filter((value): value is string => typeof value === 'string')
    : [];

  return (
    <div className="space-y-2">
      <div className="space-y-1 text-xs">
        {log.route ? (
          <p className="font-mono text-text-muted">
            route <span className="text-text-primary">{log.route}</span>
          </p>
        ) : null}
        {jobId ? (
          <p>
            job{' '}
            <Link href={`/admin/jobs?jobId=${encodeURIComponent(jobId)}`} className="font-mono text-text-primary underline-offset-2 hover:underline">
              {jobId}
            </Link>
            {engineId ? <span className="text-text-muted"> · {engineId}</span> : null}
          </p>
        ) : null}
        {sectionId ? <p>section <span className="font-mono text-text-primary">{sectionId}</span></p> : null}
        {sectionKey ? (
          <p>
            homepage <span className="font-mono text-text-primary">{sectionKey}</span>
            {sectionType ? <span className="text-text-muted"> · {sectionType}</span> : null}
          </p>
        ) : null}
        {redirectTo ? <p>redirect <span className="font-mono text-text-primary">{redirectTo}</span></p> : null}
        {returnTo ? <p>return <span className="font-mono text-text-primary">{returnTo}</span></p> : null}
        {messageLength !== null ? <p>message length <span className="text-text-primary">{messageLength}</span></p> : null}
        {lightCount !== null || darkCount !== null ? (
          <p>
            tokens <span className="text-text-primary">{lightCount ?? 0}L / {darkCount ?? 0}D</span>
            {advancedCount !== null ? <span className="text-text-muted"> · advanced {advancedCount}</span> : null}
          </p>
        ) : null}
        {keysPreview.length ? <p className="line-clamp-2">keys <span className="text-text-primary">{keysPreview.join(', ')}</span></p> : null}
        {preview ? <p className="line-clamp-2">preview <span className="text-text-primary">{preview}</span></p> : null}
      </div>

      {metadata ? (
        <details className="rounded-xl border border-hairline bg-bg/50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-text-primary">Raw metadata</summary>
          <pre className="mt-2 max-h-40 overflow-auto text-[11px] leading-5 text-text-secondary">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
