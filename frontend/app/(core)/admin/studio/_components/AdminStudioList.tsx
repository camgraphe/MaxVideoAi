import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import type { ReviewList, ReviewListFilter } from '@/server/admin-studio-review/contracts';
import { reviewProgressLabel, reviewStateLabel } from './StudioReviewStatus';

export function AdminStudioList({ data, filter, invalid = false }: { data?: ReviewList; filter?: ReviewListFilter; invalid?: boolean }) {
  const pageHref = (page: number) => '/admin/studio?' + new URLSearchParams(Object.entries({ ...filter, page }).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return <div className="space-y-6">
    <AdminPageHeader title="Studio interaction review" description="Metadata for retained Studio turns. Recorded user text and the visible assistant reply require an explicit, audited reveal." actions={<Link href="/admin/mcp" prefetch={false} className="text-sm underline">MCP activity</Link>} />
    <AdminNotice>Coverage is partial. Ready means a visible reply was saved. Preparation outcomes require reviewing the recorded actions and any quote. Historical full context and instruction versions are not captured. External MCP host transcripts are unavailable; the MCP page reports server-observed activity.</AdminNotice>
    <AdminSection title="Find a turn" description="Up to 50 metadata rows per page. Deleted projects are excluded.">
      <form action="/admin/studio" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">Account ID<input name="userId" defaultValue={filter?.userId} maxLength={128} className="rounded border border-border bg-bg px-3 py-2" /></label>
        <label className="grid gap-1 text-sm">Project ID<input name="projectId" defaultValue={filter?.projectId} maxLength={128} className="rounded border border-border bg-bg px-3 py-2" /></label>
        <label className="grid gap-1 text-sm">Stored state<select name="state" defaultValue={filter?.state ?? ''} className="rounded border border-border bg-bg px-3 py-2"><option value="">All</option><option value="thinking">In progress (thinking)</option><option value="ready">Reply saved (ready)</option><option value="failed">Turn failed (failed)</option></select></label>
        <label className="grid gap-1 text-sm">Request progress<select name="completion" defaultValue={filter?.completion ?? ''} className="rounded border border-border bg-bg px-3 py-2"><option value="">All</option><option value="incomplete">Needs continuation</option></select></label>
        <button type="submit" className="rounded border border-border px-4 py-2 text-sm">Filter</button>
      </form>
    </AdminSection>
    {invalid ? <AdminNotice tone="error">Invalid filters. Use account/project IDs, a listed state/progress, and page 0–100.</AdminNotice> : data?.status === 'unavailable' ? <AdminNotice tone="warning">Turn evidence is unavailable. Check the database and Studio schema; this is not an empty result.</AdminNotice> : data?.status === 'available' ? <AdminSection title="Recorded turns">
      {!data.turns.length ? <p className="text-sm text-text-secondary">No retained turns match these filters.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Created (UTC)', 'Account / project', 'Stored state', 'Request progress', 'Attempts', 'Review'].map(label => <th key={label} className="border-b border-border p-2">{label}</th>)}</tr></thead><tbody>{data.turns.map(turn => <tr key={`${turn.userId}:${turn.projectId}:${turn.requestId}`}>
        <td className="border-b border-border p-2 whitespace-nowrap">{turn.createdAt.replace('T', ' ').replace('Z', '')}</td><td className="border-b border-border p-2"><div>{turn.userId}</div><div className="text-text-muted">{turn.projectId}</div></td><td className="border-b border-border p-2">{reviewStateLabel(turn.state)}</td><td className="border-b border-border p-2">{reviewProgressLabel(turn)}</td><td className="border-b border-border p-2">{turn.attempts}</td><td className="border-b border-border p-2"><Link prefetch={false} className="underline" href={`/admin/studio/${encodeURIComponent(turn.requestId)}?${new URLSearchParams({ userId: turn.userId, projectId: turn.projectId })}`}>Inspect turn</Link></td>
      </tr>)}</tbody></table></div>}
      <nav aria-label="Review pages" className="mt-4 flex justify-between text-sm">{filter && filter.page > 0 ? <Link prefetch={false} href={pageHref(filter.page - 1)}>Previous</Link> : <span />}{data.hasMore && filter && filter.page < 100 ? <Link prefetch={false} href={pageHref(filter.page + 1)}>Next</Link> : null}</nav>
    </AdminSection> : null}
  </div>;
}
