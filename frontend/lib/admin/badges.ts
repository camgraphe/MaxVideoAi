import type { AdminNavBadgeMap } from '@/lib/admin/navigation';
import type { AdminHealthSnapshot } from '@/lib/admin/types';

export function buildAdminBadges(health: AdminHealthSnapshot): AdminNavBadgeMap {
  const badges: AdminNavBadgeMap = {
    jobs: [],
    'service-notice': [],
  };

  if (health.failedRenders24h > 0) {
    badges.jobs.push({ label: `Failed ${health.failedRenders24h}`, tone: 'warn' });
  }

  if (health.stalePendingJobs > 0) {
    badges.jobs.push({ label: `Pending ${health.stalePendingJobs}`, tone: 'info' });
  }

  if (health.serviceNotice.active) {
    badges['service-notice'].push({ label: 'Active', tone: 'warn' });
  }

  return badges;
}
