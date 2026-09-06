import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { MCP_CLIENT_LABELS, type AdminMcpOutcomes } from '@/server/admin-mcp-outcomes';
import { formatMcpNumber } from '../_lib/admin-mcp-helpers';

export function McpGenerationOverview({ outcomes }: { outcomes: AdminMcpOutcomes }) {
  const totals = outcomes.totals;
  return (
    <AdminSection title="MCP accounts and videos" description="Video totals cover jobs submitted in the selected UTC window, using their current status. Images, quotes without jobs and status polling do not count as generated videos.">
      <div className="space-y-4">
        <AdminMetricGrid items={[
          { label: 'MCP accounts (total)', value: formatMcpNumber(totals?.accounts ?? null), helper: 'Distinct accounts observed using MCP before the end of this window' },
          { label: 'New signups using MCP', value: formatMcpNumber(totals?.newSignups ?? null), helper: 'Accounts registered in this window and observed using MCP; this does not establish the signup source' },
          { label: 'Users who generated videos', value: formatMcpNumber(totals?.generators ?? null), helper: 'Distinct users with at least one completed MCP video job', tone: 'info' },
          { label: 'Videos generated', value: formatMcpNumber(totals?.videos ?? null), helper: 'Completed MCP video jobs, counted once per job', tone: 'success' },
        ]} />
        {outcomes.notices.map((notice) => <AdminNotice key={notice} tone="warning">{notice}</AdminNotice>)}
        {totals ? (
          <>
            <p className="text-sm text-text-secondary">
              {formatMcpNumber(totals.submitted)} video jobs submitted · {formatMcpNumber(totals.pending)} in progress · {formatMcpNumber(totals.failed)} failed or cancelled
            </p>
            <div className="overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full text-left text-sm">
                <caption className="px-4 py-3 text-left font-semibold text-text-primary">Application breakdown</caption>
                <thead className="bg-bg/60 text-text-secondary">
                  <tr>{['Application', 'MCP accounts (total)', 'New signups', 'Video creators', 'Videos generated'].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {outcomes.clients.map((row) => (
                    <tr key={row.client}>
                      <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-text-primary">{MCP_CLIENT_LABELS[row.client]}</th>
                      {[row.accounts, row.newSignups, row.generators, row.videos].map((value, index) => <td key={index} className="px-4 py-3 tabular-nums text-text-secondary">{formatMcpNumber(value)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs leading-5 text-text-muted">
              Application names come from self-reported MCP initialization metadata, with recorded connection links and current registered OAuth application names as fallbacks. This is an analytics indication, not a verified identity. Historical attribution from current OAuth names is indicative; missing metadata stays Other / unidentified. A user can appear under several applications; the overall total counts each user once.
            </p>
          </>
        ) : null}
      </div>
    </AdminSection>
  );
}
