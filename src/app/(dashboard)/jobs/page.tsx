import { DashboardShell } from "@/components/layout/dashboard-shell";
import { JobsGallery } from "@/components/jobs/jobs-gallery";
import { listJobs, serializeJob } from "@/db/repositories/jobs-repo";

export default async function JobsPage() {
  const jobs = await listJobs();

  return (
    <DashboardShell
      title="Jobs"
      description="Track every render, switch provider filters, and relaunch presets."
    >
      <JobsGallery jobs={jobs.map(serializeJob)} />
    </DashboardShell>
  );
}
