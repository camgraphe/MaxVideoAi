import { notFound, redirect } from 'next/navigation';

import { requireAdmin } from '@/server/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminPricingPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/pricing] access denied', error);
    notFound();
  }

  // Retiring the editor must not mutate pricing rules, overrides or their cache.
  redirect('/admin/settings');
}
