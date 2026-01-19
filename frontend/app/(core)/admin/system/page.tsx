import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { getServiceNoticeSetting } from '@/server/app-settings';
import { ServiceNoticeForm } from '@/components/admin/ServiceNoticeForm';

export const dynamic = 'force-dynamic';

export default async function AdminSystemPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/system] access denied', error);
    notFound();
  }

  const notice = await getServiceNoticeSetting();

  return (
    <div className="stack-gap-lg">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Alertes service</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Activez ou désactivez la bannière incident affichée en haut du workspace.
        </p>
      </header>
      <ServiceNoticeForm initialNotice={notice} />
    </div>
  );
}
