import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { reviewIssues, type AssistantReviewFilter, type ReviewItem, type ReviewList } from '@/server/admin-assistant-review/contracts';

export const sourceLabels = { composer: 'AI assistants', studio: 'Studio', mcp: 'MCP preparations' };
export const reviewHref = (item: ReviewItem) => `/admin/assistants/${item.requestId}?${new URLSearchParams({ source: item.source, userId: item.userId, scopeId: item.scopeId })}`;
export function AssistantReviewList({ data, filter, invalid }: { data?: ReviewList; filter?: AssistantReviewFilter; invalid?: boolean }) {
  const pageHref = (page: number) => '/admin/assistants?' + new URLSearchParams(Object.entries({ ...filter, page }).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return <div className="space-y-5">
    <AdminPageHeader title="Assistant review" description="Review conversations with their recorded context. Share findings across model guidance, Studio and MCP." actions={<Link href="/admin/mcp" prefetch={false} className="text-sm underline">MCP metrics</Link>} />
    <AdminSection title="Find recorded work" description="Lists contain metadata only. Content opens through an audited reveal. A conversation filter shows turns oldest first.">
      <form action="/admin/assistants" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">Source<select name="source" defaultValue={filter?.source ?? 'composer'} className="rounded border border-border bg-bg px-3 py-2">{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {([['userId', 'Account ID'], ['scopeId', 'Conversation / project / quote ID'], ['mediaModel', 'Media model ID'], ['state', 'Stored state']] as const).map(([key, label]) => <label key={key} className="grid gap-1 text-sm">{label}<input name={key} defaultValue={filter?.[key]} maxLength={128} className="max-w-full rounded border border-border bg-bg px-3 py-2" /></label>)}
        <label className="grid gap-1 text-sm">Human review<select name="verdict" defaultValue={filter?.verdict ?? ''} className="rounded border border-border bg-bg px-3 py-2"><option value="">All</option><option value="unreviewed">Unreviewed</option><option value="useful">Useful</option><option value="needs_work">Needs work</option></select></label>
        <label className="grid gap-1 text-sm">Issue<select name="issue" defaultValue={filter?.issue ?? ''} className="rounded border border-border bg-bg px-3 py-2"><option value="">All</option>{reviewIssues.map(issue => <option value={issue} key={issue}>{issue.replaceAll('_',' ')}</option>)}</select></label>
        <button type="submit" className="rounded border border-border px-4 py-2 text-sm">Filter</button>
      </form>
    </AdminSection>
    <AdminNotice>{filter?.source === 'mcp' ? 'MCP shows retained OAuth video/image preparations and their generation outcome. External host conversations, host model/token use and other tool calls are not reconstructed.' : 'Saved replies and successful API calls do not establish creative quality. Use human reviews and the recorded context to identify improvements.'} Studio may select several media models within one turn; inspect its actions rather than filtering it by one media model.</AdminNotice>
    {invalid ? <AdminNotice tone="error">Invalid filters. Use listed sources, bounded IDs and page 0–100.</AdminNotice> : data?.status === 'unavailable' ? <AdminNotice tone="warning">This evidence source is unavailable. Check its database/schema. This is not an empty result.</AdminNotice> : data?.status === 'available' ? <AdminSection title={filter?.scopeId ? 'Conversation timeline' : 'Recent recorded work'}>
      {data.items.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Created (UTC)', 'Account / context', 'Models', 'State', 'Review'].map(label => <th className="border-b border-border p-2" key={label}>{label}</th>)}</tr></thead><tbody>{data.items.map(item => <tr key={`${item.userId}:${item.scopeId}:${item.requestId}`}>
        <td className="border-b border-border p-2 whitespace-nowrap">{item.createdAt.replace('T', ' ').replace('Z', '')}</td>
        <td className="border-b border-border p-2"><span className="block break-all">{item.userId}</span><Link prefetch={false} className="text-xs underline break-all" href={'/admin/assistants?' + new URLSearchParams({ source: item.source, userId: item.userId, scopeId: item.scopeId })}>{item.source === 'mcp' ? 'Quote' : 'Conversation'} · {item.scopeId}</Link></td>
        <td className="border-b border-border p-2">{item.mediaModel ?? 'See recorded context'}<span className="block text-xs text-text-muted">{item.assistantModel ?? (item.source === 'mcp' ? 'Host model unknown' : 'See per-call usage')}</span></td>
        <td className="border-b border-border p-2">{item.state ?? 'Unknown'}<span className="block text-xs text-text-muted">{item.reviewVerdict?.replaceAll('_',' ') ?? 'Unreviewed'}</span></td><td className="border-b border-border p-2"><Link prefetch={false} className="underline" href={reviewHref(item)}>Inspect</Link></td>
      </tr>)}</tbody></table></div> : <p className="text-sm">No retained records match these filters.</p>}
      <nav aria-label="Assistant review pages" className="mt-4 flex justify-between text-sm">{filter && filter.page > 0 ? <Link prefetch={false} href={pageHref(filter.page - 1)}>Previous</Link> : <span />}{data.hasMore && filter && filter.page < 100 ? <Link prefetch={false} href={pageHref(filter.page + 1)}>Next</Link> : null}</nav>
    </AdminSection> : null}
  </div>;
}
