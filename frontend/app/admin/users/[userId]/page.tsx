import UserDetailClient from '@/components/admin/UserDetailClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function AdminUserDetailPage({ params }: { params: { userId: string } }) {
  return <UserDetailClient userId={params.userId} />;
}
