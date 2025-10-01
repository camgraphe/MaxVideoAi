import { DashboardShell } from "@/components/layout/dashboard-shell";
import { GenerateForm } from "@/components/generate/generate-form";
import { JobsGallery } from "@/components/jobs/jobs-gallery";
import { listJobsByOrganization, serializeJob } from "@/db/repositories/jobs-repo";
import { requireCurrentSession } from "@/lib/auth/current-user";

export default async function GeneratePage() {
  const session = await requireCurrentSession();
  const jobs = await listJobsByOrganization(session.organization.id);
  return (
    <DashboardShell>
      <div className="w-full pb-12">
        <GenerateForm creditsRemaining={session.organization.credits} />
      </div>
      <div className="w-full space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Recent renders</h3>
        <JobsGallery jobs={jobs.slice(0, 6).map(serializeJob)} />
      </div>
    </DashboardShell>
  );
}
