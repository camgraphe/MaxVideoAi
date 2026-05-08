'use client';

import { AdminUsersView } from './_components/AdminUsersView';
import { useAdminUsersController } from './_hooks/useAdminUsersController';

export default function AdminUsersPage() {
  const controller = useAdminUsersController();
  return <AdminUsersView controller={controller} />;
}
