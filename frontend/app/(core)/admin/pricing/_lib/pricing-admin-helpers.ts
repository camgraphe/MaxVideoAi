import { BadgePercent, Box, SlidersHorizontal, Wallet } from 'lucide-react';
import { type AdminMetricItem } from '@/components/admin-system/surfaces/AdminMetricGrid';
import type { BillingProduct, MembershipTier, PricingRule, RuleForm } from './pricing-admin-types';

export const TIER_ORDER = ['member', 'plus', 'pro'] as const;

export const DEFAULT_RULE_TEMPLATE: PricingRule = {
  id: 'new',
  marginPercent: 0.3,
  marginFlatCents: 0,
  currency: 'USD',
};

export const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    const message =
      json && typeof json === 'object' && json && 'error' in json && typeof (json as { error?: unknown }).error === 'string'
        ? (json as { error: string }).error
        : res.statusText;
    throw new Error(message || 'Request failed');
  }
  if (!json) {
    throw new Error('Invalid server response');
  }
  return json;
};

export function formatCurrencyCents(value: number): string {
  return (value / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function buildPricingOverviewItems({
  rules,
  toolProducts,
  membership,
}: {
  rules: PricingRule[];
  toolProducts: BillingProduct[];
  membership: MembershipTier[];
}): AdminMetricItem[] {
  const activeToolProducts = toolProducts.filter((product) => product.active).length;
  const customRules = rules.filter((rule) => rule.id !== 'default').length;
  const highestDiscount = membership.length ? Math.max(...membership.map((tier) => tier.discountPercent)) : 0;
  const proTier = membership.find((tier) => tier.tier === 'pro') ?? null;
  const defaultRule = rules.find((rule) => rule.id === 'default') ?? null;

  return [
    {
      label: 'Rules',
      value: String(rules.length),
      helper: `${customRules} custom overrides`,
      icon: SlidersHorizontal,
    },
    {
      label: 'Active tool SKUs',
      value: `${activeToolProducts}/${toolProducts.length || 0}`,
      helper: 'Character and angle products',
      icon: Box,
    },
    {
      label: 'Highest discount',
      value: membership.length ? formatPercent(highestDiscount) : '—',
      helper: 'Best automatic member rate',
      tone: highestDiscount > 0 ? 'info' : 'default',
      icon: BadgePercent,
    },
    {
      label: 'Pro threshold',
      value: proTier ? formatCurrencyCents(proTier.spendThresholdCents) : '—',
      helper: '30-day rolling spend requirement',
      icon: Wallet,
    },
    {
      label: 'Default margin',
      value: defaultRule ? formatPercent(defaultRule.marginPercent) : '—',
      helper: defaultRule ? `${formatCurrencyCents(defaultRule.marginFlatCents)} flat add-on` : 'No fallback rule',
      icon: SlidersHorizontal,
    },
  ];
}

export function isLegacyProduct(product: BillingProduct): boolean {
  return product.metadata?.legacy === true;
}

export function formatProductSubtitle(product: BillingProduct): string {
  const metadata = product.metadata ?? {};
  const engineId = typeof metadata.engineId === 'string' ? metadata.engineId : null;
  const variant = typeof metadata.variant === 'string' ? metadata.variant : null;
  const qualityMode = typeof metadata.qualityMode === 'string' ? metadata.qualityMode : null;

  if (product.surface === 'character') {
    return `Character Builder · ${qualityMode === 'final' ? 'Final mode' : 'Draft mode'} · billed per ${product.unitKind}`;
  }

  if (product.surface === 'angle') {
    const engineLabel = engineId === 'qwen-multiple-angles' ? 'Qwen Multiple Angles' : 'FLUX Multiple Angles';
    const variantLabel = variant === 'multi' ? 'best angles run' : 'single run';
    return `Angle Tool · ${engineLabel} · ${variantLabel}`;
  }

  return `${product.surface} · billed per ${product.unitKind}`;
}

export function convertRuleToForm(rule: PricingRule): RuleForm {
  return {
    engineId: rule.engineId ?? '',
    resolution: rule.resolution ?? '',
    marginPercent: (rule.marginPercent * 100).toString(),
    marginFlatUsd: (rule.marginFlatCents / 100).toString(),
    currency: rule.currency,
    vendorAccountId: rule.vendorAccountId ?? '',
  };
}

export function convertFormToPayload(form: RuleForm) {
  const toDecimal = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed / 100 : 0;
  };
  const toUsdCents = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  };
  return {
    engineId: form.engineId.trim() || null,
    resolution: form.resolution.trim() || null,
    marginPercent: toDecimal(form.marginPercent),
    marginFlatCents: toUsdCents(form.marginFlatUsd),
    currency: form.currency.trim() || 'USD',
    vendorAccountId: form.vendorAccountId.trim() || null,
  };
}
