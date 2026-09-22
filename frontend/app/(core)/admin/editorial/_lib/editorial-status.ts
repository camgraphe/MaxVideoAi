import type { PublicationStatus } from '@/server/editorial/publication-queue';

const labels: Record<PublicationStatus, string> = {
  queued: 'Publication queued',
  processing: 'Preparing publication',
  'awaiting-ci': 'Checks in progress',
  'awaiting-deployment': 'Deployment in progress',
  published: 'Published · verified',
  blocked: 'Needs attention',
  cancelled: 'Publication cancelled',
};

export function getEditorialStatusLabel(status: PublicationStatus | null, approvedAt: string | null) {
  return status ? labels[status] : approvedAt ? 'Approved · not published' : 'Draft version';
}
