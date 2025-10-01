import { DashboardShell } from "@/components/layout/dashboard-shell";
import { JobsGallery } from "@/components/jobs/jobs-gallery";
import { listJobsByOrganization, serializeJob } from "@/db/repositories/jobs-repo";
import { requireCurrentSession } from "@/lib/auth/current-user";

export default async function JobsPage() {
  const session = await requireCurrentSession();
  const jobs = await listJobsByOrganization(session.organization.id);

  return (
    <DashboardShell
      title="Jobs"
      description="Track every render, switch provider filters, and relaunch presets."
    >
      <JobsGallery jobs={jobs.map(serializeJob)} />
    </DashboardShell>
  );
}
