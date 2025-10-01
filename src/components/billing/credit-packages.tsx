"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";

export interface CreditPackageView {
  id: string;
  name: string;
  description: string;
  credits: number;
  priceId: string;
  unitAmount?: number | null;
  currency?: string | null;
}

interface CreditPackagesProps {
  packages: CreditPackageView[];
  variant?: "grid" | "inline";
  showPortalButton?: boolean;
}

export function CreditPackages({ packages, variant = "grid", showPortalButton = true }: CreditPackagesProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);
  const [isPortalLoading, setPortalLoading] = useState(false);

  function launchCheckout(packageId: string) {
    setPendingPackageId(packageId);
    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId }),
        });
        const payload = await response.json();
        if (!response.ok || !payload?.url) {
          throw new Error(payload?.error ?? "Unable to start checkout session");
        }
        window.location.href = payload.url as string;
      } catch (error) {
        console.error(error);
        toast({
          title: "Checkout failed",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      } finally {
        setPendingPackageId(null);
      }
    });
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error ?? "Unable to open billing portal");
      }
      window.location.href = payload.url as string;
    } catch (error) {
      console.error(error);
      toast({
        title: "Portal unavailable",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  }

  const formattedPackages = packages.length === 0 ? null : packages;

  const renderGrid = () => (
    <div className="grid gap-4 md:grid-cols-3">
      {formattedPackages!.map((pkg) => {
        const formattedPrice =
          typeof pkg.unitAmount === "number" && pkg.currency
            ? formatCurrency(pkg.unitAmount, pkg.currency.toUpperCase())
            : null;
        const isLoading = isPending && pendingPackageId === pkg.id;
        return (
          <Card key={pkg.id} className="border-border/60">
            <CardHeader>
              <CardTitle>{pkg.name}</CardTitle>
              <CardDescription>{pkg.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between text-sm text-muted-foreground">
                <span>Credits</span>
                <span className="text-foreground">{pkg.credits}</span>
              </div>
              {formattedPrice ? (
                <div className="text-2xl font-semibold text-foreground">{formattedPrice}</div>
              ) : (
                <p className="text-xs text-muted-foreground">Price displayed during Stripe checkout.</p>
              )}
              <Button
                className="w-full"
                onClick={() => launchCheckout(pkg.id)}
                disabled={isLoading || isPortalLoading}
              >
                {isLoading ? "Redirecting…" : "Buy credits"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderInline = () => (
    <div className="grid gap-3 md:grid-cols-3" id="credit-packages">
      {formattedPackages!.map((pkg) => {
        const formattedPrice =
          typeof pkg.unitAmount === "number" && pkg.currency
            ? formatCurrency(pkg.unitAmount, pkg.currency.toUpperCase())
            : null;
        const isLoading = isPending && pendingPackageId === pkg.id;
        return (
          <div
            key={pkg.id}
            className="rounded-xl border border-primary/20 bg-white/80 p-4 shadow-[0_12px_30px_-18px_rgba(124,58,237,0.35)] backdrop-blur dark:bg-white/5"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{pkg.name}</span>
              <span>{pkg.credits} credits</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {formattedPrice ?? "Shown in checkout"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{pkg.description}</p>
            <Button
              className="mt-3 w-full"
              size="sm"
              onClick={() => launchCheckout(pkg.id)}
              disabled={isLoading || isPortalLoading}
            >
              {isLoading ? "Redirecting…" : "Buy credits"}
            </Button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {packages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          No credit packs configured. Define Stripe price ids in the environment to enable purchases.
        </div>
      ) : variant === "grid" ? (
        renderGrid()
      ) : (
        renderInline()
      )}
      {showPortalButton ? (
        <div className="flex justify-start">
          <Button variant="outline" onClick={openPortal} disabled={isPortalLoading || isPending}>
            {isPortalLoading ? "Opening portal…" : "Open Stripe customer portal"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
