import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { formatCurrency, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getJobById, updateJobRecord } from "@/db/repositories/jobs-repo";
import type { JobModel, UpdateJobInput } from "@/db/repositories/jobs-repo";
import { getProviderAdapter } from "@/providers";
import type { PollJobResult } from "@/providers/types";
import { shouldRequestFalLogs } from "@/lib/env";
import { RefreshJobButton } from "@/components/jobs/refresh-job-button";

const statusLabel: Record<string, string> = {
  pending: "Queued",
  running: "Rendering",
  completed: "Completed",
  failed: "Failed",
};

interface EnsureJobMediaOptions {
  withLogs?: boolean;
}

async function ensureJobMedia(
  job: JobModel,
  options: EnsureJobMediaOptions = {},
): Promise<{ job: JobModel; pollResult: PollJobResult | null }> {
  if (!job.externalJobId) {
    return { job, pollResult: null };
  }

  const includeLogs = options.withLogs ?? shouldRequestFalLogs();
  const needsMediaFetch = !job.outputUrl && job.status !== "failed";
  const shouldPoll = needsMediaFetch || includeLogs;

  if (!shouldPoll) {
    return { job, pollResult: null };
  }

  try {
    const adapter = getProviderAdapter(job.provider);
    const result = await adapter.pollJob(job.externalJobId, {
      withLogs: includeLogs,
      engine: job.engine,
    });

    const updates: UpdateJobInput = {};

    if (result.outputUrl && result.outputUrl !== job.outputUrl) {
      updates.outputUrl = result.outputUrl;
    }
    if (result.thumbnailUrl && result.thumbnailUrl !== job.thumbnailUrl) {
      updates.thumbnailUrl = result.thumbnailUrl;
    }
    if (
      typeof result.durationSeconds === "number" &&
      result.durationSeconds !== job.durationActualSeconds
    ) {
      updates.durationActualSeconds = result.durationSeconds;
    }
    if (
      typeof result.costActualCents === "number" &&
      result.costActualCents !== job.costActualCents
    ) {
      updates.costActualCents = result.costActualCents;
    }
    if (result.status === "completed" && job.status !== "completed") {
      updates.status = result.status;
      updates.progress = result.progress;
    } else if (result.progress > job.progress) {
      updates.progress = result.progress;
    }
    if (result.error && result.error !== job.error) {
      updates.error = result.error;
    }

    if (!Object.keys(updates).length) {
      return { job, pollResult: result };
    }

    const updated = await updateJobRecord(job.id, updates);
    return { job: updated ?? job, pollResult: result };
  } catch (error) {
    console.error(`Failed to refresh provider output for job ${job.id}`, error);
    return { job, pollResult: null };
  }
}

type JobDetailSearchParams = {
  logs?: string;
};

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<JobDetailSearchParams> | JobDetailSearchParams;
}) {
  const resolvedParams = (params instanceof Promise ? await params : params) as { id: string };
  const resolvedSearch = (searchParams instanceof Promise ? await searchParams : searchParams) as
    | JobDetailSearchParams
    | undefined;

  const existing = await getJobById(resolvedParams.id);

  if (!existing) {
    notFound();
  }

  const envLogsDefault = shouldRequestFalLogs();
  const logsParam = resolvedSearch?.logs;
  const withLogs = logsParam === "1" ? true : logsParam === "0" ? false : envLogsDefault;

  const { job, pollResult } = await ensureJobMedia(existing, { withLogs });

  const isProcessing = job.status === "pending" || job.status === "running";
  const videoSrc = typeof job.outputUrl === "string" ? job.outputUrl : undefined;

  const payload = {
    provider: job.provider,
    engine: job.engine,
    prompt: job.prompt,
    ratio: job.ratio,
    durationSeconds: job.durationSeconds,
    withAudio: job.withAudio,
    seed: job.seed ?? undefined,
    presetId: job.presetId ?? undefined,
    metadata: job.metadata,
  };

  const metadataJson = JSON.stringify(job.metadata ?? {}, null, 2);
  const payloadJson = JSON.stringify(payload, null, 2);
  const hasMetadata = metadataJson.trim() !== "{}";
  const logEntries = withLogs ? pollResult?.logs ?? [] : [];
  const logsAvailable = logEntries.length > 0;
  const jobDetailPath = `/dashboard/jobs/${job.id}`;
  const logsToggleHref = withLogs
    ? `${jobDetailPath}?logs=0`
    : `${jobDetailPath}?logs=1`;

  return (
    <DashboardShell
      title="Job detail"
      description="Live status, outputs, and metadata for this render."
      actions={
        <div className="flex gap-2">
          <Button variant="outline">Duplicate</Button>
          <Button>Promote to Quality</Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="border-border/60 lg:col-span-7">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              {statusLabel[job.status] ?? job.status}
              <Badge variant="outline" className="uppercase tracking-wide">
                {job.provider.toUpperCase()} — {job.engine}
              </Badge>
            </CardTitle>
            <div className="flex items-center justify-between gap-3">
              <CardDescription>Live progress and cost tracking.</CardDescription>
              <RefreshJobButton jobId={job.id} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">{job.progress}%</span>
              </div>
              <Progress
                value={job.progress}
                className={cn("transition-all", isProcessing ? "animate-pulse" : undefined)}
              />
              {isProcessing ? (
                <p className="text-xs text-muted-foreground">
                  Rendering in FAL… we’ll refresh this page as soon as the clip is ready.
                </p>
              ) : null}
              {job.error ? (
                <p className="text-xs text-destructive">
                  {job.error}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 rounded-lg border border-border/60 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target duration</span>
                <span>{job.durationSeconds} s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Actual duration</span>
                <span>
                  {job.durationActualSeconds ? formatDuration(job.durationActualSeconds) : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated cost</span>
                <span>{formatCurrency(job.costEstimateCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Final cost</span>
                <span>{job.costActualCents ? formatCurrency(job.costActualCents) : "--"}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Ratio {job.ratio}</span>
              <span>•</span>
              <span>Audio {job.withAudio ? "ON" : "OFF"}</span>
              {job.seed ? (
                <>
                  <span>•</span>
                  <span>Seed {job.seed}</span>
                </>
              ) : null}
              <span>•</span>
              <span>Created {job.createdAt.toLocaleString("en-US")}</span>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Prompt</span>
              <ScrollArea className="max-h-40 rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{job.prompt}</p>
              </ScrollArea>
              <p className="text-[11px] text-muted-foreground">Scroll to read the full prompt.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-5">
          <CardHeader>
            <CardTitle>Render preview</CardTitle>
            <CardDescription>Latest video received from the provider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-muted/30">
              {videoSrc ? (
                <video
                  className="h-full w-full object-cover"
                  src={videoSrc}
                  poster={job.thumbnailUrl ?? undefined}
                  controls
                />
              ) : job.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={job.thumbnailUrl}
                  alt="Clip thumbnail"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span>Preview will appear as soon as the render finishes.</span>
                  {isProcessing ? (
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-primary">
                      <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
                      Rendering…
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            {job.outputUrl ? (
              <Button asChild className="w-full">
                <a href={job.outputUrl} target="_blank" rel="noreferrer">
                  Open video
                </a>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                The download link appears once the job completes.
              </p>
            )}
            {job.archiveUrl ? (
              <Button asChild variant="outline" className="w-full">
                <a href={job.archiveUrl} target="_blank" rel="noreferrer">
                  Open archived copy
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-12">
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Advanced data</CardTitle>
                <CardDescription>Only useful when you’re debugging provider issues.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={logsToggleHref}>{withLogs ? "Hide logs" : "View provider logs"}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <details className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-foreground">
                Job metadata
              </summary>
              <div className="border-t border-border/60 px-4 py-3">
                {hasMetadata ? (
                  <ScrollArea className="max-h-60">
                    <pre className="whitespace-pre-wrap text-[11px] leading-5">{metadataJson}</pre>
                  </ScrollArea>
                ) : (
                  <p>No additional metadata saved for this job.</p>
                )}
              </div>
            </details>
            <details className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-foreground">
                Payload sent to the provider
              </summary>
              <div className="border-t border-border/60 px-4 py-3">
                <ScrollArea className="max-h-60">
                  <pre className="whitespace-pre-wrap text-[11px] leading-5">{payloadJson}</pre>
                </ScrollArea>
              </div>
            </details>
            <details className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
              <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-foreground">
                Provider logs
              </summary>
              <div className="border-t border-border/60 px-4 py-3 space-y-3">
                {withLogs ? (
                  logsAvailable ? (
                    <ScrollArea className="max-h-60">
                      <div className="flex flex-col gap-2 pr-2">
                        {logEntries.map((entry, index) => (
                          <div
                            key={`${entry.timestamp ?? "log"}-${index}`}
                            className="rounded-md border border-border/50 bg-background/90 p-3"
                          >
                            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {entry.timestamp
                                ? new Date(entry.timestamp).toLocaleTimeString()
                                : `Log ${index + 1}`}
                            </div>
                            <p className="whitespace-pre-wrap text-[11px] leading-5 text-foreground">
                              {entry.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p>No logs returned yet for this request.</p>
                  )
                ) : (
                  <p>Enable logs to fetch provider-side execution details.</p>
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

// Client component is imported from src/components/jobs/refresh-job-button.tsx
