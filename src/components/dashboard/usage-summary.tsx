import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

interface UsageSummaryProps {
  secondsUsed: number;
  secondsLimit: number;
  falClips: number;
  falLimit: number;
  costToDateCents: number;
  creditsRemaining: number;
}

export function UsageSummary({
  secondsUsed,
  secondsLimit,
  falClips,
  falLimit,
  costToDateCents,
  creditsRemaining,
}: UsageSummaryProps) {
  const veoProgress = Math.min(100, (secondsUsed / secondsLimit) * 100);
  const falProgress = Math.min(100, (falClips / falLimit) * 100);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="relative overflow-hidden border border-black/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/25">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
        <CardHeader className="relative">
          <CardTitle>Veo usage</CardTitle>
          <CardDescription>Seconds generated this month</CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-3">
          <div className="flex items-baseline justify-between text-sm text-muted-foreground/90">
            <span className="font-medium text-foreground">{secondsUsed.toFixed(0)} s</span>
            <span>{secondsLimit} s cap</span>
          </div>
          <Progress value={veoProgress} className="h-2" />
        </CardContent>
      </Card>
      <Card className="relative overflow-hidden border border-black/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/25">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 to-transparent" />
        <CardHeader className="relative">
          <CardTitle>FAL clips</CardTitle>
          <CardDescription>Count of clips delivered</CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-3">
          <div className="flex items-baseline justify-between text-sm text-muted-foreground/90">
            <span className="font-medium text-foreground">{falClips}</span>
            <span>{falLimit} included</span>
          </div>
          <Progress value={falProgress} className="h-2" />
        </CardContent>
      </Card>
      <Card className="relative overflow-hidden border border-black/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/25">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        <CardHeader className="relative">
          <CardTitle>Monthly spend</CardTitle>
          <CardDescription>Live estimator</CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-3">
          <div className="text-3xl font-semibold text-foreground">{formatCurrency(costToDateCents)}</div>
          <p className="text-xs text-muted-foreground/80">
            Includes confirmed Veo seconds and FAL clips. Updates the moment a job hits completed.
          </p>
        </CardContent>
      </Card>
      <Card className="relative overflow-hidden border border-black/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-black/25">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent" />
        <CardHeader className="relative">
          <CardTitle>Credits balance</CardTitle>
          <CardDescription>Available renders</CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-3">
          <div className="text-3xl font-semibold text-foreground">{creditsRemaining}</div>
          <p className="text-xs text-muted-foreground/80">
            Each render deducts credits based on its estimated cost. Add more credits from billing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
