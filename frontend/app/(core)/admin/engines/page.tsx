import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { AdminEnginesView } from './_components/AdminEnginesView';
import { loadAdminEnginesViewModel } from './_lib/admin-engines-view-model';

export const dynamic = 'force-dynamic';

export default async function AdminEnginesPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/engines] access denied', error);
    notFound();
  }

  const model = await loadAdminEnginesViewModel({
    databaseAvailable: Boolean(process.env.DATABASE_URL),
  });

  return <AdminEnginesView model={model} />;
}
