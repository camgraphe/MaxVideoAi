import UserDetailClient from '@/components/admin/UserDetailClient';

export default function AdminUserDetailPage({ params }: { params: { userId: string } }) {
  return <UserDetailClient userId={params.userId} />;
}
