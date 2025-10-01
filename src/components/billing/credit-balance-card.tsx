"use client";

import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditPackages, type CreditPackageView } from "@/components/billing/credit-packages";

interface CreditBalanceCardProps {
  credits: number;
  packages: CreditPackageView[];
  recommendedPackage?: CreditPackageView | null;
  lastLedgerEntry?: { createdAt: Date; delta: number; reason: string } | null;
}

export function CreditBalanceCard({ credits, packages, recommendedPackage, lastLedgerEntry }: CreditBalanceCardProps) {
  const lastActivity = lastLedgerEntry
    ? `${lastLedgerEntry.delta > 0 ? "+" : ""}${lastLedgerEntry.delta} credits • ${formatDistanceToNow(lastLedgerEntry.createdAt, {
        addSuffix: true,
      })}`
    : null;

  return (
    <Card className="border-border/60 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">Credit wallet</CardTitle>
        <CardDescription>
          Your renders consume credits. Top up whenever you need a fresh batch or explore a monthly plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Current balance</p>
          <p className="text-4xl font-semibold text-foreground">{credits} credits</p>
          {lastActivity ? (
            <p className="text-xs text-muted-foreground">Last activity: {lastActivity}</p>
          ) : (
            <p className="text-xs text-muted-foreground">No movements yet. Your wallet will update in real time.</p>
          )}
          {packages.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Boost your balance</p>
              <CreditPackages packages={packages} variant="inline" showPortalButton={false} />
            </div>
          ) : null}
        </div>
        {recommendedPackage ? (
          <div className="w-full max-w-xs rounded-2xl border border-primary/30 bg-primary/10 p-5 text-sm text-primary shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">Suggestion</p>
            <p className="mt-1 text-base font-semibold text-primary">{recommendedPackage.name}</p>
            <p className="text-xs text-primary/80">{recommendedPackage.description}</p>
            <p className="mt-4 text-xs text-primary/60">
              {recommendedPackage.credits} credits · quick refill without leaving your flow.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
