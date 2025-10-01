import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RecentJobs } from "@/components/dashboard/recent-jobs";
import { UsageSummary } from "@/components/dashboard/usage-summary";
import { listJobsByOrganization, serializeJob } from "@/db/repositories/jobs-repo";
import { requireCurrentSession } from "@/lib/auth/current-user";

export default async function DashboardPage() {
  const session = await requireCurrentSession();
  const jobs = await listJobsByOrganization(session.organization.id);

  const secondsUsed = jobs
    .filter((job) => job.engine.startsWith("veo"))
    .reduce((total, job) => total + (job.durationActualSeconds ?? job.durationSeconds ?? 0), 0);

  const falClips = jobs.filter((job) => !job.engine.startsWith("veo")).length;

  const secondsLimit = 900;
  const falLimit = 120;

  return (
    <DashboardShell
      title="Dashboard"
      description="Monitor renders, usage, and spend in real time."
    >
      <UsageSummary
        secondsUsed={secondsUsed}
        secondsLimit={secondsLimit}
        falClips={falClips}
        falLimit={falLimit}
        costToDateCents={jobs.reduce(
          (total, job) => total + (job.costActualCents ?? job.costEstimateCents),
          0,
        )}
        creditsRemaining={session.organization.credits}
      />
      <RecentJobs jobs={jobs.map(serializeJob)} />
    </DashboardShell>
  );
}
