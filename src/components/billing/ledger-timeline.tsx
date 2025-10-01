import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface CreditLedgerTimelineEntry {
  id: string;
  delta: number;
  reason: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const reasonLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }>
  = {
    credit_purchase: { label: "Credit purchase", variant: "default" },
    job: { label: "Render", variant: "outline" },
    initial_seed: { label: "Seed", variant: "secondary" },
  };

function formatReason(reason: string) {
  return reasonLabels[reason]?.label ?? reason.replace(/_/g, " ");
}

function mapVariant(reason: string) {
  return reasonLabels[reason]?.variant ?? "secondary";
}

export function LedgerTimeline({ entries }: { entries: CreditLedgerTimelineEntry[] }) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle>Credit activity</CardTitle>
        <CardDescription>Purchases, auto top-ups, and render usage in chronological order.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ledger activity yet.</p>
        ) : (
          <div className="relative pl-3">
            <div className="absolute left-1 top-0 h-full w-px bg-border" aria-hidden />
            <ul className="space-y-6">
              {entries.map((entry) => {
                const createdAt = new Date(entry.createdAt);
                const sign = entry.delta > 0 ? "+" : "";
                const amountClass = entry.delta > 0 ? "text-emerald-600" : "text-rose-500";
                const variant = mapVariant(entry.reason);
                const details: string[] = [];
                if (entry.metadata?.package_id) {
                  details.push(`Pack: ${entry.metadata.package_id as string}`);
                }
                if (entry.metadata?.stripe_session_id) {
                  details.push(`Stripe ref: ${entry.metadata.stripe_session_id as string}`);
                }
                if (entry.metadata?.provider) {
                  details.push(`Provider: ${entry.metadata.provider as string}`);
                }
                if (entry.metadata?.engine) {
                  details.push(`Engine: ${entry.metadata.engine as string}`);
                }
                if (entry.metadata?.job_id) {
                  details.push(`Job: ${entry.metadata.job_id as string}`);
                }
                return (
                  <li key={entry.id} className="relative pl-6">
                    <span className="absolute left-0 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-background bg-primary" />
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={variant}>{formatReason(entry.reason)}</Badge>
                        <span className={`text-sm font-medium ${amountClass}`}>
                          {sign}
                          {entry.delta} credits
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(createdAt, { addSuffix: true })}
                        </span>
                      </div>
                      {details.length ? (
                        <p className="text-xs text-muted-foreground">{details.join(" • ")}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
