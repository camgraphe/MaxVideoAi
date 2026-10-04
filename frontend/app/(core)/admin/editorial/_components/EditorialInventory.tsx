import Link from 'next/link';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import type { EditorialDraftSummary } from '@/server/editorial/repository';
import { getEditorialStatusLabel } from '../_lib/editorial-status';

export function EditorialInventory({ drafts }: { drafts: EditorialDraftSummary[] }) {
  if (!drafts.length) return <AdminEmptyState>No articles saved yet.</AdminEmptyState>;
  return <AdminDataTable tableClassName="w-full min-w-[700px]">
    <thead><tr className="text-xs text-text-secondary">
      <th className="px-4 py-3 font-medium">Article</th>
      <th className="px-4 py-3 font-medium">Current version</th>
      <th className="px-4 py-3 font-medium">Last verified publication</th>
      <th className="px-4 py-3 font-medium">Saved</th>
      <th className="px-4 py-3"><span className="sr-only">Review</span></th>
    </tr></thead>
    <tbody>{drafts.map((draft) => <tr key={draft.articleId} className="border-t border-hairline hover:bg-surface-2/50">
      <td className="max-w-sm px-4 py-4"><Link className="text-sm font-medium hover:text-brand" href={`/admin/editorial/${draft.articleId}?version=${draft.version}`}>{draft.title}</Link></td>
      <td className="px-4 py-4 text-sm"><span className="font-medium">v{draft.version}</span><p className="mt-1 text-xs text-text-secondary">{getEditorialStatusLabel(draft.publicationStatus, draft.approvedAt)}</p></td>
      <td className="px-4 py-4 text-sm">{draft.publishedVersion ? <Link className="text-brand" href={`/admin/editorial/${draft.articleId}?version=${draft.publishedVersion}`}>v{draft.publishedVersion} · View</Link> : <span className="text-text-secondary">None recorded</span>}</td>
      <td className="px-4 py-4 text-xs text-text-secondary">{new Date(draft.createdAt).toLocaleString('en-GB', {timeZone:'Europe/Madrid', dateStyle:'medium', timeStyle:'short'})}</td>
      <td className="px-4 py-4 text-right"><Link className="text-sm font-medium text-brand" href={`/admin/editorial/${draft.articleId}?version=${draft.version}`}>Review</Link></td>
    </tr>)}</tbody>
  </AdminDataTable>;
}
