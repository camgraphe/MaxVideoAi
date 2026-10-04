import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import Link from 'next/link';
import { MCP_CLIENT_LABELS, type AdminMcpOutcomes, type McpGenerationItem } from '@/server/admin-mcp-outcomes';
import type { AdminMcpMetrics } from '@/server/admin-mcp-metrics';
import { formatMcpNumber } from '../_lib/admin-mcp-helpers';

type McpGenerationOverviewProps = {
  outcomes: AdminMcpOutcomes;
  activity: AdminMcpMetrics['activity'];
  pollingCalls: AdminMcpMetrics['pollingCalls'];
};

export function McpGenerationOverview({ outcomes, activity, pollingCalls }: McpGenerationOverviewProps) {
  const totals = outcomes.totals;
  const toolCallsHelper = activity === null
    ? 'Authenticated MCP tool calls are unavailable; calls include status polling and are not generations.'
    : pollingCalls === null
      ? 'All authenticated MCP tool calls, including status polling (count unavailable); tool calls are not generations.'
      : `All authenticated MCP tool calls, including ${formatMcpNumber(pollingCalls)} status polling calls; tool calls are not generations.`;
  return (
    <AdminSection title="MCP activity and generations" description="Video and image totals cover jobs submitted in the selected UTC window, using their current status. Quotes without jobs and status polling are excluded from generation totals.">
      <div className="space-y-4">
        <AdminMetricGrid items={[
          { label: 'Videos generated', value: formatMcpNumber(totals?.videos ?? null), helper: 'Completed MCP video jobs, counted once per job', tone: 'success' },
          { label: 'Images generated', value: formatMcpNumber(totals?.images ?? null), helper: 'Completed MCP image jobs, counted once per job', tone: 'success' },
          { label: 'Tool calls', value: formatMcpNumber(activity?.toolCalls ?? null), helper: toolCallsHelper, tone: activity === null ? 'warning' : 'default' },
          { label: 'Active tool users', value: formatMcpNumber(activity?.activeToolUsers ?? null), helper: 'Distinct connected accounts that called at least one MCP tool', tone: activity === null ? 'warning' : 'info' },
          { label: 'MCP accounts (total)', value: formatMcpNumber(totals?.accounts ?? null), helper: 'Distinct accounts observed using MCP before the end of this window' },
          { label: 'New signups using MCP', value: formatMcpNumber(totals?.newSignups ?? null), helper: 'Accounts registered in this window and observed using MCP; this does not establish the signup source' },
          { label: 'Users who generated videos', value: formatMcpNumber(totals?.generators ?? null), helper: 'Distinct users with at least one completed MCP video job', tone: 'info' },
          { label: 'Users who generated images', value: formatMcpNumber(totals?.imageGenerators ?? null), helper: 'Distinct users with at least one completed MCP image job', tone: 'info' },
        ]} />
        {outcomes.notices.map((notice) => <AdminNotice key={notice} tone="warning">{notice}</AdminNotice>)}
        {totals ? (
          <>
            <p className="text-sm text-text-secondary">
              {formatMcpNumber(totals.submitted)} video jobs submitted · {formatMcpNumber(totals.pending)} in progress · {formatMcpNumber(totals.failed)} failed or cancelled
            </p>
            <p className="text-sm text-text-secondary">
              {formatMcpNumber(totals.imagesSubmitted)} image jobs submitted · {formatMcpNumber(totals.imagePending)} in progress · {formatMcpNumber(totals.imageFailed)} failed or cancelled
            </p>
            <div className="overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full text-left text-sm">
                <caption className="px-4 py-3 text-left font-semibold text-text-primary">Application breakdown</caption>
                <thead className="bg-bg/60 text-text-secondary">
                  <tr>{['Application', 'MCP accounts (total)', 'New signups', 'Video creators', 'Videos generated', 'Image creators', 'Images generated'].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {outcomes.clients.map((row) => (
                    <tr key={row.client}>
                      <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-text-primary">{MCP_CLIENT_LABELS[row.client]}</th>
                      {[row.accounts, row.newSignups, row.generators, row.videos, row.imageGenerators, row.images].map((value, index) => <td key={index} className="px-4 py-3 tabular-nums text-text-secondary">{formatMcpNumber(value)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <GenerationItems generations={outcomes.generations} />
            <p className="text-xs leading-5 text-text-muted">
              Application names come from self-reported MCP initialization metadata, with recorded connection links and current registered OAuth application names as fallbacks. This is an analytics indication, not a verified identity. Glama denotes an identified MCP client, not a verified directory referral. Historical attribution from current OAuth names is indicative; missing metadata stays Other / unidentified. A user can appear under several applications; the overall total counts each user once.
            </p>
          </>
        ) : null}
      </div>
    </AdminSection>
  );
}

function GenerationItems({ generations }: { generations: McpGenerationItem[] | null }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline">
      <div className="border-b border-hairline px-4 py-3">
        <p className="font-semibold text-text-primary">Recent MCP generations</p>
        <p className="mt-1 text-xs text-text-muted">Latest 30 jobs in the selected UTC window. Retries linked to the same job appear once.</p>
      </div>
      {generations === null ? (
        <div className="px-4 py-5"><AdminEmptyState>Recent MCP generations are unavailable for this UTC window.</AdminEmptyState></div>
      ) : generations.length ? (
        <table aria-label="Recent MCP generations" className="w-full text-left text-sm">
          <thead className="bg-bg/60 text-text-secondary">
            <tr>{['Created', 'Type', 'Model', 'Status', 'Application', 'Job'].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {generations.map((generation) => <GenerationRow key={generation.jobId} generation={generation} />)}
          </tbody>
        </table>
      ) : <div className="px-4 py-5"><AdminEmptyState>No MCP generation job was recorded in this UTC window.</AdminEmptyState></div>}
    </div>
  );
}

function GenerationRow({ generation }: { generation: McpGenerationItem }) {
  const model = generation.engineLabel || generation.engineId || 'Unknown model';
  const status = (generation.status || 'unknown').toLowerCase();
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-text-secondary">{formatGenerationDate(generation.createdAt)}</td>
      <td className="px-4 py-3"><span className={generation.surface === 'image' ? 'rounded-full border border-info-border bg-info-bg px-2 py-1 text-xs font-semibold text-info' : 'rounded-full border border-border bg-accent-subtle px-2 py-1 text-xs font-semibold text-text-primary'}>{generation.surface}</span></td>
      <td className="px-4 py-3 text-text-primary"><span>{model}</span>{generation.engineLabel && generation.engineId ? <span className="ml-2 font-mono text-xs text-text-muted">{generation.engineId}</span> : null}</td>
      <td className="px-4 py-3"><span className="rounded-full border border-border bg-surface px-2 py-1 text-xs font-semibold text-text-secondary">{status}</span></td>
      <td className="px-4 py-3 text-xs text-text-secondary">{MCP_CLIENT_LABELS[generation.client]}</td>
      <td className="px-4 py-3"><Link href={`/admin/jobs?jobId=${encodeURIComponent(generation.jobId)}`} className="font-mono text-xs text-brand underline-offset-2 hover:underline">{generation.jobId}</Link></td>
    </tr>
  );
}

const generationDateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function formatGenerationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${generationDateFormatter.format(date)} UTC`;
}
