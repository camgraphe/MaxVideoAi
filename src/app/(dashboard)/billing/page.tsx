import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreditPackageView } from "@/components/billing/credit-packages";
import { CreditBalanceCard } from "@/components/billing/credit-balance-card";
import { LedgerTimeline } from "@/components/billing/ledger-timeline";
import { MonthlyPlansShowcase } from "@/components/billing/monthly-plans";
import { creditPackages } from "@/config/credits";
import { getStripeClient } from "@/lib/stripe";
import { env } from "@/lib/env";
import { requireCurrentSession } from "@/lib/auth/current-user";
import { listCreditLedger } from "@/db/repositories/credits-repo";

async function resolvePackageViews(): Promise<CreditPackageView[]> {
  if (creditPackages.length === 0) {
    return [];
  }

  if (!env.STRIPE_SECRET_KEY) {
    return creditPackages.map((pkg) => ({
      ...pkg,
      unitAmount: null,
      currency: null,
    }));
  }

  const stripe = getStripeClient();

  const results = await Promise.all(
    creditPackages.map(async (pkg) => {
      try {
        const price = await stripe.prices.retrieve(pkg.priceId, { expand: ["product"] });
        return {
          ...pkg,
          unitAmount: price.unit_amount,
          currency: price.currency,
        } satisfies CreditPackageView;
      } catch (error) {
        console.error(`Unable to load Stripe price ${pkg.priceId}`, error);
        return {
          ...pkg,
          unitAmount: null,
          currency: null,
        } satisfies CreditPackageView;
      }
    }),
  );

  return results;
}

export default async function BillingPage() {
  const session = await requireCurrentSession();
  const packages = await resolvePackageViews();
  const ledger = await listCreditLedger(session.organization.id, 50);
  const timeline = ledger.map((entry) => ({
    id: entry.id,
    delta: entry.delta,
    reason: entry.reason,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
  }));
  const lastEntry = ledger[0] ?? null;
  const recommendedPack = packages[1] ?? packages[0] ?? null;

  return (
    <DashboardShell
      title="Billing"
      description="Purchase credits, view invoices, and access the customer portal."
    >
      <div className="space-y-8">
        <CreditBalanceCard
          credits={session.organization.credits}
          packages={packages}
          recommendedPackage={recommendedPack}
          lastLedgerEntry={lastEntry}
        />

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Monthly formulas</CardTitle>
            <CardDescription>
              Prefer predictable billing? Choose a plan that bundles recurring credits with premium support.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyPlansShowcase />
          </CardContent>
        </Card>

        <LedgerTimeline entries={timeline} />
      </div>
    </DashboardShell>
  );
}
