import { notFound } from 'next/navigation';
import { fetchAdminUserOverview } from '@/server/admin-users';
import { AdminUserDetailView } from './_components/AdminUserDetailView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminUserDetailPage(props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const userId = params.userId?.trim();
  if (!userId) {
    notFound();
  }

  const overview = await fetchAdminUserOverview(userId);
  return <AdminUserDetailView userId={userId} overview={overview} />;
}
