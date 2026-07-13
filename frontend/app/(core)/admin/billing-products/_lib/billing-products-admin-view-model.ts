import type { PricingChangeEvent, PricingChangePreview } from '@/lib/admin/pricing-change-contract';
import type { BillingProductRecord } from '@/types/billing';

export type BillingProductDraft = {
  productKey: string;
  label: string;
  currency: string;
  unitPriceCents: string;
  active: boolean;
};

export type BillingProductChangeProposal =
  | {
      operation: 'update';
      productKey: string;
      label: string;
      currency: string;
      unitPriceCents: number;
      active: boolean;
    }
  | { operation: 'rollback'; targetId: string; eventId: string };

export type BillingProductInventoryApiResponse = {
  ok: true;
  inventory: {
    databaseStatus: 'loaded' | 'unavailable';
    products: BillingProductRecord[];
    historicalProductCount: number;
    missingReferencedProductKeys: string[];
    warnings: string[];
  };
};

export type BillingProductHistoryApiResponse = { ok: true; events: PricingChangeEvent[] };
export type BillingProductPreviewApiResponse = { ok: true; preview: PricingChangePreview };
export type BillingProductConfirmApiResponse = {
  ok: true;
  confirmation: {
    committed: true;
    operationalWarnings: Array<{ code: string; message: string }>;
  };
};
export type BillingProductAdminError = { code: string; message: string };
export type BillingProductOperationalWarning = {
  code: 'post_commit_refresh_failed';
  message: string;
};

export function createBillingProductDraft(product: BillingProductRecord): BillingProductDraft {
  return {
    productKey: product.productKey,
    label: product.label,
    currency: product.currency,
    unitPriceCents: String(product.unitPriceCents),
    active: product.active,
  };
}

export function buildBillingProductProposal(draft: BillingProductDraft): BillingProductChangeProposal {
  const unitPriceCents = Number(draft.unitPriceCents);
  if (!Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0 || unitPriceCents > 2_147_483_647) {
    throw new Error('Unit price must be a PostgreSQL INTEGER between 0 and 2147483647 cents.');
  }
  return {
    operation: 'update',
    productKey: draft.productKey,
    label: draft.label,
    currency: draft.currency,
    unitPriceCents,
    active: draft.active,
  };
}

export function filterBillingProducts(products: BillingProductRecord[], query: string): BillingProductRecord[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return products;
  return products.filter((product) =>
    [product.productKey, product.label, product.surface].some((value) => value.toLowerCase().includes(normalized))
  );
}
