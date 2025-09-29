import { DashboardShell } from "@/components/layout/dashboard-shell";
import { GenerateForm } from "@/components/generate/generate-form";
import { JobsGallery } from "@/components/jobs/jobs-gallery";
import { listJobs, serializeJob } from "@/db/repositories/jobs-repo";

export default async function GeneratePage() {
  const jobs = await listJobs();
  return (
    <DashboardShell
      title="Generate"
      description="Build your prompt, choose a preset, and send the render within seconds."
    >
      <div className="mx-auto w-full max-w-6xl pb-12">
        <GenerateForm />
      </div>
      <div className="mx-auto w-full max-w-6xl space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Recent renders</h3>
        <JobsGallery jobs={jobs.slice(0, 6).map(serializeJob)} />
      </div>
    </DashboardShell>
  );
}
