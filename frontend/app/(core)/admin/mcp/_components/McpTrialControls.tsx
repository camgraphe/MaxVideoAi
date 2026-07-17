import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { requireAdmin } from '@/server/admin';
import {
  loadAdminMcpTrialOperations,
  manualReleaseMcpTrial,
} from '@/server/admin-mcp-trial-operations';

type HeaderReader = Pick<Headers, 'get'>;

export function assertSameOrigin(requestHeaders: HeaderReader): void {
  const origin = requestHeaders.get('origin')?.trim() ?? '';
  const host = (
    requestHeaders.get('x-forwarded-host')
    ?? requestHeaders.get('host')
    ?? ''
  ).trim().toLowerCase();
  const forwardedProtocol = requestHeaders.get('x-forwarded-proto')?.trim().toLowerCase();
  const local = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/u.test(host);
  const protocol = forwardedProtocol === 'http' && local ? 'http' : 'https';
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error('Invalid admin action origin.');
  }
  if (!host
    || parsed.username
    || parsed.password
    || parsed.host.toLowerCase() !== host
    || parsed.protocol !== `${protocol}:`
    || parsed.origin !== origin) {
    throw new Error('Invalid admin action origin.');
  }
}

export function normalizeManualReleaseFormData(formData: FormData): {
  userId: string;
  jobId: string;
  reason: string;
} {
  const entries = Array.from(formData.entries());
  const expected = new Set(['userId', 'jobId', 'reason']);
  if (entries.length !== expected.size
    || entries.some(([key, value]) => !expected.has(key) || typeof value !== 'string')
    || new Set(entries.map(([key]) => key)).size !== expected.size) {
    throw new Error('Invalid MCP trial manual release input.');
  }
  const values = Object.fromEntries(entries) as Record<string, string>;
  return {
    userId: values.userId ?? '',
    jobId: values.jobId ?? '',
    reason: values.reason ?? '',
  };
}

export async function releaseTrialAction(formData: FormData): Promise<void> {
  'use server';
  const adminId = await requireAdmin();
  assertSameOrigin(await headers());
  const input = normalizeManualReleaseFormData(formData);
  await manualReleaseMcpTrial({
    adminId,
    userId: input.userId,
    jobId: input.jobId,
    reason: input.reason as 'provider_confirmed_no_output' | 'support_verified_no_output',
  });
  revalidatePath('/admin/mcp');
}

function integer(value: number | null): string {
  return value === null ? 'Unavailable' : new Intl.NumberFormat('en-US').format(value);
}

function money(value: number | null): string {
  return value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
}

export async function McpTrialControls({
  inspectionUserId = null,
}: {
  inspectionUserId?: string | null;
}) {
  await requireAdmin();
  const operations = await loadAdminMcpTrialOperations({ inspectionUserId });
  const inspection = operations.inspection;
  const releaseAvailable = operations.availability === 'available'
    && inspection?.entitlementState === 'reserved'
    && inspection.outputPresent === false
    && inspection.jobId !== null;

  return (
    <AdminSection
      title="Included trial operations"
      description="Fail-closed lifecycle inspection and support correction. No raw request, media, or fraud identifiers are shown."
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <OperationValue label="Checked-in kill switch" value={operations.killSwitch.checkedIn ? 'Enabled' : 'Disabled'} />
          <OperationValue label="Runtime kill switch" value={operations.killSwitch.runtime ? 'Enabled' : 'Disabled'} />
          <OperationValue label="Effective trial state" value={operations.killSwitch.effective ? 'Enabled' : 'Disabled'} />
        </div>

        {operations.availability === 'unavailable' ? (
          <AdminNotice tone="warning">
            Trial operations are unavailable ({operations.reasonCode}). Counts are hidden rather than shown as zero.
          </AdminNotice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <OperationValue label="Accepted" value={integer(operations.counts?.accepted ?? null)} />
            <OperationValue label="Reserved" value={integer(operations.counts?.reserved ?? null)} />
            <OperationValue label="Completed / Consumed" value={integer(operations.counts?.consumed ?? null)} />
            <OperationValue label="Released" value={integer(operations.counts?.released ?? null)} />
            <OperationValue label="Provider cost" value={money(operations.providerCostCents)} />
            <OperationValue label="Suspicious velocity (24h)" value={integer(operations.suspiciousVelocity)} />
          </div>
        )}

        <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-hairline bg-bg/60 p-4">
          <label className="min-w-64 flex-1 text-sm text-text-secondary">
            Exact user ID
            <input
              name="trialUserId"
              defaultValue={inspectionUserId ?? ''}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-text-primary"
            />
          </label>
          <button type="submit" className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary">
            Inspect user
          </button>
        </form>

        {inspectionUserId && !inspection ? (
          <AdminEmptyState>No exact trial entitlement was found, or inspection is unavailable.</AdminEmptyState>
        ) : null}

        {inspection ? (
          <div className="rounded-xl border border-hairline bg-bg/60 p-4">
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OperationValue label="User" value={inspection.userId} mono />
              <OperationValue label="Entitlement" value={inspection.entitlementState} />
              <OperationValue label="Quote" value={inspection.quoteState ?? 'None'} />
              <OperationValue label="Job state" value={inspection.jobState ?? 'None'} />
              <OperationValue label="Output present" value={inspection.outputPresent ? 'Yes' : 'No'} />
              <OperationValue label="Reserved at" value={inspection.reservedAt ?? 'Not reserved'} />
            </dl>
            {releaseAvailable ? (
              <form action={releaseTrialAction} className="mt-4 flex flex-wrap items-end gap-3 border-t border-hairline pt-4">
                <input type="hidden" name="userId" value={inspection.userId} />
                <input type="hidden" name="jobId" value={inspection.jobId ?? ''} />
                <label className="text-sm text-text-secondary">
                  Allowlisted reason
                  <select name="reason" className="mt-1 block rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary">
                    <option value="support_verified_no_output">Support verified no output</option>
                    <option value="provider_confirmed_no_output">Provider confirmed no output</option>
                  </select>
                </label>
                <button type="submit" className="rounded-lg border border-danger/40 px-4 py-2 text-sm font-semibold text-danger">
                  Release reserved trial
                </button>
              </form>
            ) : (
              <AdminNotice tone="info">Manual release is unavailable unless the entitlement is reserved, consistent, and has no output.</AdminNotice>
            )}
          </div>
        ) : null}
      </div>
    </AdminSection>
  );
}

function OperationValue({ label, value, mono = false }: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-3 py-2">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className={mono ? 'mt-1 break-all font-mono text-xs text-text-primary' : 'mt-1 text-sm font-semibold text-text-primary'}>{value}</dd>
    </div>
  );
}
