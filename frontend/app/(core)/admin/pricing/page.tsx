import { notFound } from 'next/navigation';

import { requireAdmin } from '@/server/admin';
import { AdminPricingCockpit } from './_components/AdminPricingCockpit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminPricingPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/pricing] access denied', error);
    notFound();
  }

  return <AdminPricingCockpit />;
}
