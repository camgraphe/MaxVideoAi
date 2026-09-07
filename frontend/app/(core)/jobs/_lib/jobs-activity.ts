import type { GroupSummary } from '@/types/groups';
import type { JobsStatus } from './jobs-page-types';

export function activityGroupStatus(group: GroupSummary): Exclude<JobsStatus, 'all'> {
  const members = group.members.length ? group.members : [group.hero];
  if (members.some((member) => !member.status || member.status === 'pending')) return 'pending';
  if (members.some((member) => member.status === 'failed')) return 'failed';
  return 'completed';
}

export function filterActivityGroups(groups: GroupSummary[], status: JobsStatus): GroupSummary[] {
  return status === 'all' ? groups : groups.filter((group) => activityGroupStatus(group) === status);
}

/** Retain explicitly paginated history beyond the bounded observation cache. */
export function activityLoadedJobs(pages: import('@/types/jobs').JobsPage[] | undefined, stableJobs: import('@/types/jobs').Job[]) {
  const stableById = new Map(stableJobs.map((job) => [job.jobId, job]));
  return pages?.flatMap((page) => page.jobs).map((job) => stableById.get(job.jobId) ?? job) ?? [];
}
