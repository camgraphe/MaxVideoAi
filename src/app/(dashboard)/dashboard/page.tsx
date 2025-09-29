import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RecentJobs } from "@/components/dashboard/recent-jobs";
import { UsageSummary } from "@/components/dashboard/usage-summary";
import { listJobs, serializeJob } from "@/db/repositories/jobs-repo";

export default async function DashboardPage() {
  const jobs = await listJobs();

  const secondsUsed = jobs
    .filter((job) => job.engine.startsWith("veo"))
    .reduce((total, job) => total + (job.durationActualSeconds ?? job.durationSeconds ?? 0), 0);

  const falClips = jobs.filter((job) => !job.engine.startsWith("veo")).length;

  return (
    <DashboardShell
      title="Dashboard"
      description="Monitor renders, usage, and spend in real time."
    >
      <UsageSummary
        secondsUsed={secondsUsed}
        secondsLimit={900}
        falClips={falClips}
        falLimit={120}
        costToDateCents={jobs.reduce(
          (total, job) => total + (job.costActualCents ?? job.costEstimateCents),
          0,
        )}
      />
      <RecentJobs jobs={jobs.map(serializeJob)} />
    </DashboardShell>
  );
}
