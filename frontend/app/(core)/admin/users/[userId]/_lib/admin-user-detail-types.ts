import type {
  AdminUserOverview,
  AdminUserProfile,
  AdminUserTopup,
  AdminUserUsage,
  AdminUserWallet,
} from '@/server/admin-users';

export type {
  AdminUserOverview,
  AdminUserProfile,
  AdminUserTopup,
  AdminUserUsage,
  AdminUserWallet,
};

export type AdminUserDetailViewProps = {
  userId: string;
  overview: AdminUserOverview;
};
