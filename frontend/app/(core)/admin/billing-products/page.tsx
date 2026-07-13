import { notFound } from 'next/navigation';

import { requireAdmin } from '@/server/admin';
import { AdminBillingProductsView } from './_components/AdminBillingProductsView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminBillingProductsPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/billing-products] access denied', error);
    notFound();
  }

  return <AdminBillingProductsView />;
}
