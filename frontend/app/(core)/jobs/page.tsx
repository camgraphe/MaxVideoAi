'use client';

import { JobsPageShell } from './_components/JobsPageShell';
import { useJobsPageController } from './_hooks/useJobsPageController';

export default function JobsPage() {
  const controller = useJobsPageController();
  return <JobsPageShell {...controller} />;
}
