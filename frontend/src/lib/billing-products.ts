import { isDatabaseConfigured, query } from '@/lib/db';
import { getMembershipDiscountMap } from '@/lib/membership';
import { ensureBillingSchema } from '@/lib/schema';
import type { PricingSnapshot } from '@/types/engines';
import type { BillingProductRecord, BillingProductUnitKind, JobSurface } from '@/types/billing';

const CACHE_TTL_MS = 60_000;

let cachedProducts: BillingProductRecord[] | null = null;
let cacheLoadedAt = 0;

function normalizeCurrency(value: unknown): string {
  if (typeof value !== 'string') return 'USD';
  const normalized = value.trim().toUpperCase();
  return normalized || 'USD';
}

function normalizeUnitKind(value: unknown): BillingProductUnitKind {
  return value === 'run' ? 'run' : 'image';
}

function normalizeSurface(value: unknown): JobSurface {
  return value === 'video' ||
    value === 'image' ||
    value === 'character' ||
    value === 'angle' ||
    value === 'audio' ||
    value === 'upscale'
    ? value
    : 'image';
}

function toInteger(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  return fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function invalidateBillingProductsCache(): void {
  cachedProducts = null;
  cacheLoadedAt = 0;
}

function mapBillingProductRow(row: {
  product_key: string;
  surface: string;
  label: string;
  currency: string;
  unit_kind: string;
  unit_price_cents: number | string;
  active: boolean | null;
  metadata: unknown;
}): BillingProductRecord {
  return {
    productKey: row.product_key,
    surface: normalizeSurface(row.surface),
    label: row.label,
    currency: normalizeCurrency(row.currency),
    unitKind: normalizeUnitKind(row.unit_kind),
    unitPriceCents: Math.max(0, toInteger(row.unit_price_cents)),
    active: toBoolean(row.active, true),
    metadata: normalizeMetadata(row.metadata),
  };
}

export async function listBillingProducts(): Promise<BillingProductRecord[]> {
  if (!isDatabaseConfigured()) return [];
  await ensureBillingSchema();
  if (cachedProducts && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedProducts;
  }

  const rows = await query<{
    product_key: string;
    surface: string;
    label: string;
    currency: string;
    unit_kind: string;
    unit_price_cents: number | string;
    active: boolean | null;
    metadata: unknown;
  }>(
    `SELECT product_key, surface, label, currency, unit_kind, unit_price_cents, active, metadata
     FROM app_billing_products
     ORDER BY surface, product_key`
  );

  cachedProducts = rows.map(mapBillingProductRow);
  cacheLoadedAt = Date.now();
  return cachedProducts;
}

export async function getBillingProduct(productKey?: string | null): Promise<BillingProductRecord | null> {
  if (!productKey) return null;
  const products = await listBillingProducts();
  return products.find((product) => product.productKey === productKey) ?? null;
}

export async function updateBillingProduct(input: {
  productKey: string;
  label?: string | null;
  currency?: string | null;
  unitPriceCents?: number | null;
  active?: boolean | null;
}): Promise<BillingProductRecord> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database unavailable');
  }

  await ensureBillingSchema();

  const existing = await getBillingProduct(input.productKey);
  if (!existing) {
    throw new Error(`Billing product not found: ${input.productKey}`);
  }

  const label =
    typeof input.label === 'string' && input.label.trim().length ? input.label.trim() : existing.label;
  const currency =
    typeof input.currency === 'string' && input.currency.trim().length
      ? normalizeCurrency(input.currency)
      : existing.currency;
  const unitPriceCents =
    typeof input.unitPriceCents === 'number' && Number.isFinite(input.unitPriceCents)
      ? Math.max(0, Math.round(input.unitPriceCents))
      : existing.unitPriceCents;
  const active = typeof input.active === 'boolean' ? input.active : existing.active;

  const rows = await query<{
    product_key: string;
    surface: string;
    label: string;
    currency: string;
    unit_kind: string;
    unit_price_cents: number | string;
    active: boolean | null;
    metadata: unknown;
  }>(
    `UPDATE app_billing_products
        SET label = $2,
            currency = $3,
            unit_price_cents = $4,
            active = $5,
            updated_at = NOW()
      WHERE product_key = $1
      RETURNING product_key, surface, label, currency, unit_kind, unit_price_cents, active, metadata`,
    [input.productKey, label, currency, unitPriceCents, active]
  );

  const updated = rows[0];
  if (!updated) {
    throw new Error(`Failed to update billing product: ${input.productKey}`);
  }

  invalidateBillingProductsCache();
  return mapBillingProductRow(updated);
}

export async function computeBillingProductSnapshot(params: {
  productKey: string;
  quantity?: number;
  membershipTier?: string | null;
  engineId?: string | null;
}): Promise<PricingSnapshot> {
  const product = await getBillingProduct(params.productKey);
  if (!product || !product.active) {
    throw new Error(`Billing product not found: ${params.productKey}`);
  }

  const quantity = product.unitKind === 'run' ? 1 : Math.max(1, Math.round(params.quantity ?? 1));
  const baseAmountCents = product.unitPriceCents * quantity;
  const memberTier = (params.membershipTier ?? 'member').toLowerCase();
  const discountMap = await getMembershipDiscountMap();
  const discountPercent = typeof discountMap[memberTier] === 'number' ? Math.max(0, discountMap[memberTier]) : 0;
  const discountAmountCents = discountPercent > 0 ? Math.round(baseAmountCents * discountPercent) : 0;
  const totalCents = Math.max(0, baseAmountCents - discountAmountCents);

  return {
    currency: product.currency,
    totalCents,
    subtotalBeforeDiscountCents: baseAmountCents,
    base: {
      seconds: quantity,
      rate: Number((product.unitPriceCents / 100).toFixed(4)),
      unit: product.unitKind,
      amountCents: baseAmountCents,
    },
    addons: [],
    margin: {
      amountCents: 0,
      flatCents: 0,
    },
    discount: discountAmountCents
      ? {
          amountCents: discountAmountCents,
          percentApplied: discountPercent,
          tier: memberTier,
        }
      : undefined,
    membershipTier: memberTier,
    platformFeeCents: 0,
    vendorShareCents: 0,
    meta: {
      pricingModel: 'billing-product',
      surface: product.surface,
      billingProductKey: product.productKey,
      billingProductLabel: product.label,
      unitKind: product.unitKind,
      quantity,
      engineId: params.engineId ?? null,
    },
  };
}
