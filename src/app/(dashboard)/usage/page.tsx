import { Suspense } from "react";
import { format } from "date-fns";

import { requireCurrentSession } from "@/lib/auth/current-user";
import { listUsageEvents } from "@/db/repositories/usage-repo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatQuantity(meter: string, quantity: number): string {
  if (meter === "video_seconds_rendered") {
    return `${quantity}s`;
  }
  return `${quantity} clip${quantity === 1 ? "" : "s"}`;
}

function UsageTable({ events }: { events: Awaited<ReturnType<typeof listUsageEvents>> }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        No usage logged yet. Launch a render to see metered events here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60">
      <table className="min-w-full divide-y divide-border bg-background text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-[0.28em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Meter</th>
            <th className="px-4 py-3 text-left">Quantity</th>
            <th className="px-4 py-3 text-left">Engine</th>
            <th className="px-4 py-3 text-left">Job</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {events.map((event) => (
            <tr key={event.id} className="bg-background/80">
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {format(event.createdAt, "yyyy-MM-dd HH:mm")}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="border-primary/30 text-xs text-primary">
                  {event.meter}
                </Badge>
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {formatQuantity(event.meter, event.quantity)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{event.engine}</td>
              <td className="px-4 py-3">
                {event.job ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-foreground">{event.job.engine}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{event.job.prompt}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      Status: {event.job.status}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">–</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function UsageContent() {
  const session = await requireCurrentSession();
  const events = await listUsageEvents({ organizationId: session.organization.id, limit: 100 });

  const secondsTotal = events
    .filter((event) => event.meter === "video_seconds_rendered")
    .reduce((acc, event) => acc + event.quantity, 0);
  const clipsTotal = events
    .filter((event) => event.meter === "video_clips_rendered")
    .reduce((acc, event) => acc + event.quantity, 0);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Usage meters</CardTitle>
          <CardDescription>Stripe billing stays in sync with these live counters.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">video_seconds_rendered</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{secondsTotal}s</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total seconds reported across per-second engines (Veo, Kling, Pika, WAN 2.2…)
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">video_clips_rendered</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{clipsTotal}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Clips billed per job for WAN 2.1, utilities, and other per-clip meters.
            </p>
          </div>
        </CardContent>
      </Card>

      <UsageTable events={events} />
    </div>
  );
}

export default function UsagePage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Usage history</h1>
        <p className="text-sm text-muted-foreground">
          Audit every usage event we report to Stripe. Metrics update as soon as fal.ai confirms completion.
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading usage…</div>}>
        <UsageContent />
      </Suspense>
    </div>
  );
}
