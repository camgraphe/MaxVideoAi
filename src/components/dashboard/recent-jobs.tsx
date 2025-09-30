import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ENGINE_LABELS } from "@/data/models";
import type { SerializedJob } from "@/db/repositories/jobs-repo";
import { formatCurrency, formatDuration } from "@/lib/format";

interface RecentJobsProps {
  jobs: SerializedJob[];
}

const statusMap: Record<SerializedJob["status"], { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Queued", variant: "secondary" },
  running: { label: "Rendering", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

export function RecentJobs({ jobs }: RecentJobsProps) {
  return (
    <Card className="relative overflow-hidden border border-black/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/25">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent" />
      <CardHeader className="relative flex flex-row items-start justify-between">
        <div>
          <CardTitle>Latest renders</CardTitle>
          <CardDescription>Clips delivered over the last week.</CardDescription>
        </div>
        <Badge variant="outline" className="border-white/20 text-foreground">
          {jobs.length} jobs
        </Badge>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No jobs yet. Launch your first render from the Generate tab.
          </p>
        ) : (
          <ul className="space-y-4">
            {jobs.slice(0, 4).map((job) => {
              const status = statusMap[job.status];
              return (
                <li
                  key={job.id}
                  className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white/90 p-3 transition hover:border-primary/40 dark:border-white/10 dark:bg-black/40 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex w-full items-start gap-3 md:items-center">
                    <Link href={`/jobs/${job.id}`} className="block h-16 w-28 shrink-0 overflow-hidden rounded-md border border-black/10 bg-muted dark:border-white/10">
                      {job.outputUrl ? (
                        <video
                          className="h-full w-full object-cover"
                          src={job.outputUrl}
                          poster={job.thumbnailUrl ?? undefined}
                          muted
                          autoPlay
                          loop
                          playsInline
                          preload="metadata"
                        />
                      ) : job.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={job.thumbnailUrl}
                          alt="preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground">
                          No preview
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0">
                      <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-foreground hover:underline">
                        {job.prompt.slice(0, 80)}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/80">
                        <span>{job.provider.toUpperCase()}</span>
                        <span>•</span>
                        <span>{ENGINE_LABELS[job.engine] ?? job.engine}</span>
                        <span>•</span>
                        <span>{job.ratio}</span>
                        {job.durationSeconds ? (
                          <>
                            <span>•</span>
                            <span>{formatDuration(job.durationActualSeconds ?? job.durationSeconds)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 md:ml-4">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <div className="text-sm font-medium text-foreground/90">
                      {formatCurrency(job.costEstimateCents)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
