import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { listEditorialDrafts } from '@/server/editorial/repository';
import { requireAdmin } from '@/server/admin';
import { EditorialInventory } from './_components/EditorialInventory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EditorialDraftListPage() {
  await requireAdmin();
  const drafts = await listEditorialDrafts();
  return <div className="space-y-5">
    <AdminPageHeader eyebrow="Content" title="Articles" description="Review saved versions and track verified publication across EN, FR and ES." />
    <p className="text-xs text-text-secondary">{drafts.length} articles · Latest saved versions · Dates in Europe/Madrid</p>
    <EditorialInventory drafts={drafts} />
  </div>;
}
