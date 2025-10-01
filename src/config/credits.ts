import { env } from "@/lib/env";

export interface CreditPackageConfig {
  id: string;
  name: string;
  description: string;
  credits: number;
  priceId: string;
}

const rawPackages: Array<Omit<CreditPackageConfig, "priceId"> & { priceId?: string }> = [
  {
    id: "starter",
    name: "Starter pack",
    description: "30 credits • ideal to test new workflows",
    credits: 30,
    priceId: env.STRIPE_PRICE_SMALL,
  },
  {
    id: "studio",
    name: "Studio pack",
    description: "75 credits • covers a full campaign sprint",
    credits: 75,
    priceId: env.STRIPE_PRICE_MEDIUM,
  },
  {
    id: "agency",
    name: "Agency pack",
    description: "200 credits • bulk bundle for agencies",
    credits: 200,
    priceId: env.STRIPE_PRICE_LARGE,
  },
];

export const creditPackages: CreditPackageConfig[] = rawPackages.filter(
  (pkg): pkg is CreditPackageConfig => Boolean(pkg.priceId),
) as CreditPackageConfig[];

export const creditPackagesById = new Map(creditPackages.map((pkg) => [pkg.id, pkg] as const));
export const creditPackagesByPriceId = new Map(creditPackages.map((pkg) => [pkg.priceId, pkg] as const));

export function getCreditPackageById(id: string): CreditPackageConfig | undefined {
  return creditPackagesById.get(id);
}

export function getCreditPackageByPriceId(priceId: string): CreditPackageConfig | undefined {
  return creditPackagesByPriceId.get(priceId);
}
