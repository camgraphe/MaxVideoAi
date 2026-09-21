import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { listEditorialDrafts } from '@/server/editorial/repository';
import { requireAdmin } from '@/server/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EditorialDraftListPage() {
  await requireAdmin();
  const drafts = await listEditorialDrafts();
  return <div className="space-y-6">
    <AdminPageHeader eyebrow="Editorial" title="Blog drafts" description="Private, versioned article previews. Publication requires a separate human action." />
    <div className="grid gap-3">{drafts.map((draft) => <Link key={draft.articleId} href={`/admin/editorial/${draft.articleId}?version=${draft.version}`} className="rounded-xl border border-hairline bg-surface p-5 transition hover:border-border-hover hover:bg-surface-hover">
      <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Draft · version {draft.version} · {new Date(draft.createdAt).toLocaleDateString()}</span>
      <h2 className="mt-2 text-lg font-bold text-text-primary">{draft.title}</h2>
      <p className="mt-2 font-mono text-xs text-text-muted">SHA-256 {draft.digest}</p>
    </Link>)}{drafts.length === 0 && <p className="rounded-xl border border-hairline p-5 text-text-secondary">No editorial drafts yet.</p>}</div>
  </div>;
}
