import { CreditCard } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function BillingPage() {
  return (
    <DashboardShell
      title="Billing"
      description="Manage your Stripe subscription, invoices, and usage alerts."
    >
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-2">
            <CardTitle>Pro plan</CardTitle>
            <CardDescription>
              Monthly subscription + metered usage. Next charge on April 1st, 2025.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="gap-2 text-xs">
            <CreditCard className="h-3 w-3" /> Card ending 4242
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
            <p>
              Usage metrics sync whenever a job hits completed. Stripe receives two meters: `veo_seconds_generated` and `fal_clips_generated`.
            </p>
          </div>
          <Button variant="outline">Open Stripe customer portal</Button>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
