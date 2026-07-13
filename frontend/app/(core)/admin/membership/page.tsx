import { notFound } from 'next/navigation';

import { requireAdmin } from '@/server/admin';
import { AdminMembershipView } from './_components/AdminMembershipView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminMembershipPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/membership] access denied', error);
    notFound();
  }

  return <AdminMembershipView />;
}
