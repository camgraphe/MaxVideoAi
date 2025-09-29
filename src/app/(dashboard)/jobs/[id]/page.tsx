import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { formatCurrency, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getJobById } from "@/db/repositories/jobs-repo";

const statusLabel: Record<string, string> = {
  pending: "Queued",
  running: "Rendering",
  completed: "Completed",
  failed: "Failed",
};

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await getJobById(params.id);

  if (!job) {
    notFound();
  }

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
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              {statusLabel[job.status] ?? job.status}
              <Badge variant="outline" className="uppercase tracking-wide">
                {job.provider.toUpperCase()} — {job.engine}
              </Badge>
            </CardTitle>
            <CardDescription>
              Prompt: {job.prompt}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span className="font-medium">{job.progress}%</span>
              </div>
              <Progress
                value={job.progress}
                className={cn(
                  "transition-all",
                  isProcessing ? "animate-pulse" : undefined,
                )}
              />
              {isProcessing ? (
                <p className="text-xs text-muted-foreground">
                  Rendering in FAL… keep this tab open if you’d like, we’ll refresh when the clip is ready.
                </p>
              ) : null}
            </div>
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
            <div className="grid gap-3 rounded-lg border border-border/60 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target duration</span>
                <span>{job.durationSeconds} s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Actual duration</span>
                <span>
                  {job.durationActualSeconds
                    ? formatDuration(job.durationActualSeconds)
                    : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated cost</span>
                <span>{formatCurrency(job.costEstimateCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Final cost</span>
                <span>
                  {job.costActualCents ? formatCurrency(job.costActualCents) : "--"}
                </span>
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
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Payload sent to the provider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-muted-foreground">
            <pre className="rounded-lg border border-border/50 bg-background/80 p-4 text-[11px] leading-5">
              {JSON.stringify(payload, null, 2)}
            </pre>
            {job.outputUrl ? (
              <Button asChild className="w-full">
                <a href={job.outputUrl} target="_blank" rel="noreferrer">
                  Download video
                </a>
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                The download link appears once the job completes.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
