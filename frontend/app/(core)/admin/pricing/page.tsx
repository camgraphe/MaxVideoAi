'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Box, RefreshCw, SlidersHorizontal, Wallet } from 'lucide-react';
import useSWR from 'swr';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { Button, ButtonLink } from '@/components/ui/Button';

type PricingRule = {
  id: string;
  engineId?: string;
  resolution?: string;
  marginPercent: number;
  marginFlatCents: number;
  currency: string;
  vendorAccountId?: string;
};

type PricingRulesResponse =
  | { ok: true; rules: PricingRule[] }
  | { ok: false; error?: string };

type MembershipTier = {
  tier: string;
  spendThresholdCents: number;
  discountPercent: number;
};

type MembershipResponse =
  | { ok: true; tiers: MembershipTier[] }
  | { ok: false; error?: string };

type BillingProduct = {
  productKey: string;
  surface: 'video' | 'image' | 'character' | 'angle';
  label: string;
  currency: string;
  unitKind: 'image' | 'run';
  unitPriceCents: number;
  active: boolean;
  metadata?: Record<string, unknown> | null;
};

type BillingProductsResponse =
  | { ok: true; products: BillingProduct[] }
  | { ok: false; error?: string };

const fetcher = async <T,>(url: string): Promise<T> => {
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

const TIER_ORDER = ['member', 'plus', 'pro'] as const;

function formatCurrencyCents(value: number): string {
  return (value / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const DEFAULT_RULE_TEMPLATE: PricingRule = {
  id: 'new',
  marginPercent: 0.3,
  marginFlatCents: 0,
  currency: 'USD',
};

type MembershipDraft = Record<string, { thresholdUsd: string; discountPct: string }>;

export default function PricingAdminPage() {
  const { data: rulesData, error: rulesError, mutate: mutateRules, isLoading: rulesLoading } = useSWR<PricingRulesResponse>(
    '/api/admin/pricing/rules',
    fetcher
  );
  const {
    data: membershipData,
    error: membershipError,
    mutate: mutateMembership,
    isLoading: membershipLoading,
  } = useSWR<MembershipResponse>('/api/admin/membership-tiers', fetcher);
  const {
    data: billingProductsData,
    error: billingProductsError,
    mutate: mutateBillingProducts,
    isLoading: billingProductsLoading,
  } = useSWR<BillingProductsResponse>('/api/admin/billing-products', fetcher);

  const [membershipDraft, setMembershipDraft] = useState<MembershipDraft>({});
  const [membershipInitialised, setMembershipInitialised] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);
  const [savingMembership, setSavingMembership] = useState(false);

  useEffect(() => {
    if (!membershipInitialised && membershipData && membershipData.ok) {
      const draft: MembershipDraft = {};
      membershipData.tiers.forEach((tier) => {
        draft[tier.tier] = {
          thresholdUsd: (tier.spendThresholdCents / 100).toString(),
          discountPct: (tier.discountPercent * 100).toString(),
        };
      });
      setMembershipDraft(draft);
      setMembershipInitialised(true);
    }
  }, [membershipData, membershipInitialised]);

  const orderedMembership = useMemo(() => {
    if (!membershipData || !membershipData.ok) return [];
    const map = new Map(membershipData.tiers.map((tier) => [tier.tier, tier]));
    return TIER_ORDER.map((key) => map.get(key)).filter((entry): entry is MembershipTier => Boolean(entry));
  }, [membershipData]);

  const rules = useMemo(() => {
    if (!rulesData || !rulesData.ok) return [];
    return [...rulesData.rules].sort((a, b) => {
      const aKey = `${a.engineId ?? ''}:${a.resolution ?? ''}:${a.id}`;
      const bKey = `${b.engineId ?? ''}:${b.resolution ?? ''}:${b.id}`;
      return aKey.localeCompare(bKey);
    });
  }, [rulesData]);

  const toolProducts = useMemo(() => {
    if (!billingProductsData || !billingProductsData.ok) return [];
    return billingProductsData.products
      .filter((product) => (product.surface === 'character' || product.surface === 'angle') && !isLegacyProduct(product))
      .sort((a, b) => {
        const surfaceOrder = a.surface.localeCompare(b.surface);
        if (surfaceOrder !== 0) return surfaceOrder;
        return a.productKey.localeCompare(b.productKey);
      });
  }, [billingProductsData]);

  const overviewItems = useMemo(
    () => buildPricingOverviewItems({ rules, toolProducts, membership: orderedMembership }),
    [orderedMembership, rules, toolProducts]
  );

  const handleMembershipFieldChange = (tier: string, field: 'thresholdUsd' | 'discountPct', value: string) => {
    setMembershipDraft((prev) => ({
      ...prev,
      [tier]: {
        thresholdUsd: field === 'thresholdUsd' ? value : prev[tier]?.thresholdUsd ?? '',
        discountPct: field === 'discountPct' ? value : prev[tier]?.discountPct ?? '',
      },
    }));
    setMembershipStatus(null);
  };

  const handleSaveMembership = async () => {
    if (!membershipData || !membershipData.ok) return;
    setSavingMembership(true);
    setMembershipStatus(null);
    try {
      const payload = TIER_ORDER.map((tier) => {
        const draft = membershipDraft[tier] ?? { thresholdUsd: '0', discountPct: '0' };
        const thresholdUsd = parseFloat(draft.thresholdUsd);
        const discountPct = parseFloat(draft.discountPct);
        return {
          tier,
          spendThresholdCents: Number.isFinite(thresholdUsd) ? Math.max(0, Math.round(thresholdUsd * 100)) : 0,
          discountPercent: Number.isFinite(discountPct) ? Math.max(0, discountPct / 100) : 0,
        };
      });
      const res = await fetch('/api/admin/membership-tiers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers: payload }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || typeof json !== 'object' || !('ok' in json) || json.ok !== true) {
        const message =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error?: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Failed to save membership tiers';
        throw new Error(message);
      }
      await mutateMembership();
      setMembershipStatus('saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save membership tiers';
      setMembershipStatus(message);
    } finally {
      setSavingMembership(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([mutateRules(), mutateMembership(), mutateBillingProducts()]);
  };

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Pricing controls"
        description="Ajuste les seuils membership, les prix des outils et les marges engine. Cette surface pilote les futurs quotes et les charges wallet."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border bg-surface"
              onClick={() => {
                void handleRefresh();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <ButtonLink href="/admin/engines" variant="outline" size="sm" className="border-border bg-surface">
              Engines
            </ButtonLink>
            <ButtonLink href="/admin/transactions" variant="outline" size="sm" className="border-border bg-surface">
              Transactions
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Pricing Pulse"
        description="Lecture rapide du catalogue tarifaire chargé, pour savoir si l’on est en train de gérer des seuils, des SKUs ou des overrides moteurs."
      >
        <AdminMetricGrid items={overviewItems} columnsClassName="sm:grid-cols-2 xl:grid-cols-5" density="compact" />
      </AdminSection>

      <AdminSection
        title="Membership Tiers"
        description="Seuils de dépense rolling et remises auto pour les niveaux Plus et Pro."
        action={
          <AdminSectionMeta
            title={`${orderedMembership.length || 0} tiers`}
            lines={[
              orderedMembership.length
                ? `Highest discount ${formatPercent(Math.max(...orderedMembership.map((tier) => tier.discountPercent)))}`
                : 'No membership data',
              'Changes apply to future pricing snapshots',
            ]}
          />
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveMembership}
              disabled={savingMembership || membershipLoading || !!membershipError}
              className="rounded-xl border-border bg-surface"
            >
              {savingMembership ? 'Saving…' : 'Save tiers'}
            </Button>
            {membershipStatus ? (
              <span className={`text-xs ${membershipStatus === 'saved' ? 'text-success' : 'text-error'}`}>
                {membershipStatus === 'saved' ? 'Membership tiers saved.' : membershipStatus}
              </span>
            ) : null}
          </div>

          {membershipLoading ? (
            <AdminEmptyState>Loading membership tiers…</AdminEmptyState>
          ) : membershipError ? (
            <AdminNotice tone="error">Failed to load membership tiers.</AdminNotice>
          ) : orderedMembership.length ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {orderedMembership.map((tier) => {
                const editable = membershipDraft[tier.tier] ?? { thresholdUsd: '', discountPct: '' };
                const label = tier.tier.slice(0, 1).toUpperCase() + tier.tier.slice(1);
                const thresholdDefault = formatCurrencyCents(tier.spendThresholdCents);
                return (
                  <div key={tier.tier} className="rounded-2xl border border-hairline bg-bg/40 p-4">
                    <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
                    <div className="mt-3 space-y-3 text-xs text-text-secondary">
                      <label className="flex flex-col gap-1">
                        <span className="text-text-tertiary">Spend threshold (USD, 30-day rolling)</span>
                        <input
                          type="number"
                          min={0}
                          step="10"
                          value={editable.thresholdUsd}
                          onChange={(event) => handleMembershipFieldChange(tier.tier, 'thresholdUsd', event.target.value)}
                          placeholder={thresholdDefault}
                          className="rounded-xl border border-hairline bg-bg px-3 py-2 text-sm font-medium text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-text-tertiary">Discount (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={editable.discountPct}
                          onChange={(event) => handleMembershipFieldChange(tier.tier, 'discountPct', event.target.value)}
                          placeholder={(tier.discountPercent * 100).toString()}
                          className="rounded-xl border border-hairline bg-bg px-3 py-2 text-sm font-medium text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <AdminEmptyState>No membership tiers found.</AdminEmptyState>
          )}
        </div>
      </AdminSection>

      <AdminSection
        title="Tool Pricing"
        description="Tarifs dédiés pour Character Builder et Angle Tool, indépendamment du moteur sous-jacent."
        action={
          <AdminSectionMeta
            title={`${toolProducts.filter((product) => product.active).length}/${toolProducts.length || 0} active`}
            lines={[toolProducts.length ? 'Character and angle products only' : 'No product loaded']}
          />
        }
      >
        {billingProductsLoading ? (
          <AdminEmptyState>Loading tool pricing…</AdminEmptyState>
        ) : billingProductsError ? (
          <AdminNotice tone="error">Failed to load tool pricing.</AdminNotice>
        ) : toolProducts.length ? (
          <div className="space-y-4">
            {toolProducts.map((product) => (
              <BillingProductCard key={product.productKey} product={product} onRefresh={() => mutateBillingProducts()} />
            ))}
          </div>
        ) : (
          <AdminEmptyState>No tool products found.</AdminEmptyState>
        )}
      </AdminSection>

      <AdminSection
        title="Pricing Rules"
        description="Overrides par engine et résolution. Les règles sont appliquées aux quotes et charges futures."
        action={
          <AdminSectionMeta
            title={`${rules.length} rules`}
            lines={[
              `${rules.filter((rule) => rule.id !== 'default').length} custom overrides`,
              rules.some((rule) => rule.id === 'default') ? 'Default fallback present' : 'No default fallback',
            ]}
          />
        }
      >
        {rulesLoading ? (
          <AdminEmptyState>Loading pricing rules…</AdminEmptyState>
        ) : rulesError ? (
          <AdminNotice tone="error">Failed to load pricing rules.</AdminNotice>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <PricingRuleCard key={rule.id} rule={rule} onRefresh={() => mutateRules()} />
            ))}
            <NewPricingRuleCard onCreated={() => mutateRules()} />
          </div>
        )}
      </AdminSection>
    </div>
  );
}

function buildPricingOverviewItems({
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

function isLegacyProduct(product: BillingProduct): boolean {
  return product.metadata?.legacy === true;
}

function formatProductSubtitle(product: BillingProduct): string {
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

type BillingProductCardProps = {
  product: BillingProduct;
  onRefresh: () => void | Promise<unknown>;
};

function BillingProductCard({ product, onRefresh }: BillingProductCardProps) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    label: product.label,
    unitPriceUsd: (product.unitPriceCents / 100).toString(),
    active: product.active,
  }));

  useEffect(() => {
    setForm({
      label: product.label,
      unitPriceUsd: (product.unitPriceCents / 100).toString(),
      active: product.active,
    });
  }, [product]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const parsed = Number(form.unitPriceUsd);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error('Unit price must be a non-negative USD amount.');
      }
      const response = await fetch('/api/admin/billing-products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productKey: product.productKey,
          label: form.label.trim(),
          unitPriceCents: Math.round(parsed * 100),
          active: form.active,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json || typeof json !== 'object' || json.ok !== true) {
        const message =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error?: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Failed to save tool pricing';
        throw new Error(message);
      }
      await onRefresh();
      setStatus('saved');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save tool pricing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-hairline bg-bg/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{product.label}</h3>
          <p className="text-xs text-text-tertiary">{formatProductSubtitle(product)}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-text-muted">{product.productKey}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, active: event.target.checked }));
              setStatus(null);
            }}
            disabled={saving}
          />
          Active
        </label>
      </div>

      <div className="mt-4 grid grid-gap-sm sm:grid-cols-2">
        <Field
          label="Label"
          value={form.label}
          onChange={(value) => {
            setForm((prev) => ({ ...prev, label: value }));
            setStatus(null);
          }}
        />
        <Field
          label={`Unit price (${product.currency})`}
          value={form.unitPriceUsd}
          onChange={(value) => {
            setForm((prev) => ({ ...prev, unitPriceUsd: value }));
            setStatus(null);
          }}
        />
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl border border-brand bg-brand px-3 py-1 text-xs font-semibold text-on-brand hover:bg-brand/90 disabled:bg-brand/70"
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {status === 'saved' ? (
          <p className="text-xs text-success">Tool price saved.</p>
        ) : status ? (
          <p className="text-xs text-error">{status}</p>
        ) : null}
      </div>
    </div>
  );
}

type RuleCardProps = {
  rule: PricingRule;
  onRefresh: () => void;
};

function PricingRuleCard({ rule, onRefresh }: RuleCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState(() => convertRuleToForm(rule));

  useEffect(() => {
    setForm(convertRuleToForm(rule));
  }, [rule]);

  const handleChange = (field: keyof RuleForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatus(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const payload = convertFormToPayload(form);
      const res = await fetch(`/api/admin/pricing/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || typeof json !== 'object' || json.ok !== true) {
        const message =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error?: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Failed to save pricing rule';
        throw new Error(message);
      }
      await onRefresh();
      setEditing(false);
      setStatus('saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save pricing rule';
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (rule.id === 'default') {
      setStatus('The default rule cannot be deleted.');
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/pricing/rules/${rule.id}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || typeof json !== 'object' || json.ok !== true) {
        const message =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error?: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Failed to delete pricing rule';
        throw new Error(message);
      }
      await onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete pricing rule';
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  const labelParts = [
    rule.engineId ? rule.engineId : 'Default',
    rule.resolution ? `· ${rule.resolution}` : '',
  ]
    .join(' ')
    .trim();

  return (
    <div className="rounded-2xl border border-hairline bg-bg/40 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{labelParts}</h3>
          <p className="text-xs text-text-tertiary">Rule ID: {rule.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing((prev) => !prev)}
            disabled={saving}
            className="rounded-xl border-hairline px-3 py-1 text-xs font-semibold text-text-secondary hover:border-text-muted hover:text-text-primary"
          >
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={saving || rule.id === 'default'}
            className="rounded-xl border-error-border px-3 py-1 text-xs font-semibold text-error hover:border-error-border hover:text-error"
          >
            Delete
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-gap-sm sm:grid-cols-2">
        <Field
          label="Engine ID"
          value={form.engineId}
          disabled={!editing}
          onChange={(value) => handleChange('engineId', value)}
          placeholder="Leave blank for default"
        />
        <Field
          label="Resolution"
          value={form.resolution}
          disabled={!editing}
          onChange={(value) => handleChange('resolution', value)}
          placeholder="all"
        />
        <Field
          label="Margin (%)"
          value={form.marginPercent}
          disabled={!editing}
          onChange={(value) => handleChange('marginPercent', value)}
        />
        <Field
          label="Flat margin (USD)"
          value={form.marginFlatUsd}
          disabled={!editing}
          onChange={(value) => handleChange('marginFlatUsd', value)}
        />
        <Field
          label="Currency"
          value={form.currency}
          disabled={!editing}
          onChange={(value) => handleChange('currency', value)}
        />
        <Field
          label="Vendor account"
          value={form.vendorAccountId}
          disabled={!editing}
          onChange={(value) => handleChange('vendorAccountId', value)}
          placeholder="Optional Connect account"
        />
      </div>
      {editing ? (
        <div className="mt-4 flex items-center gap-4">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl border border-brand bg-brand px-3 py-1 text-xs font-semibold text-on-brand hover:bg-brand/90 disabled:bg-brand/70"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {status && <p className="text-xs text-error">{status}</p>}
        </div>
      ) : status === 'saved' ? (
        <p className="mt-2 text-xs text-success">Rule saved.</p>
      ) : status ? (
        <p className="mt-2 text-xs text-error">{status}</p>
      ) : null}
    </div>
  );
}

type RuleForm = {
  engineId: string;
  resolution: string;
  marginPercent: string;
  marginFlatUsd: string;
  currency: string;
  vendorAccountId: string;
};

function convertRuleToForm(rule: PricingRule): RuleForm {
  return {
    engineId: rule.engineId ?? '',
    resolution: rule.resolution ?? '',
    marginPercent: (rule.marginPercent * 100).toString(),
    marginFlatUsd: (rule.marginFlatCents / 100).toString(),
    currency: rule.currency,
    vendorAccountId: rule.vendorAccountId ?? '',
  };
}

function convertFormToPayload(form: RuleForm) {
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

type FieldProps = {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
};

function Field({ label, value, disabled, onChange, placeholder }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-text-secondary">
      <span className="text-text-tertiary">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
      />
    </label>
  );
}

type NewRuleProps = {
  onCreated: () => void;
};

function NewPricingRuleCard({ onCreated }: NewRuleProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RuleForm>(() => convertRuleToForm(DEFAULT_RULE_TEMPLATE));

  useEffect(() => {
    if (!open) {
      setForm(convertRuleToForm(DEFAULT_RULE_TEMPLATE));
      setStatus(null);
      setSaving(false);
    }
  }, [open]);

  const handleChange = (field: keyof RuleForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatus(null);
  };

  const handleCreate = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const payload = convertFormToPayload(form);
      const res = await fetch('/api/admin/pricing/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || typeof json !== 'object' || json.ok !== true) {
        const message =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error?: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Failed to create pricing rule';
        throw new Error(message);
      }
      await onCreated();
      setOpen(false);
      setStatus(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create pricing rule';
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto rounded-xl border-dashed border-hairline px-4 py-6 text-sm font-semibold text-text-secondary hover:border-text-muted hover:text-text-primary"
        onClick={() => setOpen(true)}
      >
        + Add pricing rule
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline bg-bg/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">New pricing rule</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-text-tertiary hover:text-text-secondary"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
      <div className="mt-4 grid grid-gap-sm sm:grid-cols-2">
        <Field label="Engine ID" value={form.engineId} onChange={(value) => handleChange('engineId', value)} placeholder="Optional" />
        <Field label="Resolution" value={form.resolution} onChange={(value) => handleChange('resolution', value)} placeholder="Optional" />
        <Field label="Margin (%)" value={form.marginPercent} onChange={(value) => handleChange('marginPercent', value)} />
        <Field label="Flat margin (USD)" value={form.marginFlatUsd} onChange={(value) => handleChange('marginFlatUsd', value)} />
        <Field label="Currency" value={form.currency} onChange={(value) => handleChange('currency', value)} />
        <Field
          label="Vendor account"
          value={form.vendorAccountId}
          onChange={(value) => handleChange('vendorAccountId', value)}
          placeholder="Optional"
        />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Button
          type="button"
          size="sm"
          className="rounded-xl border border-brand bg-brand px-3 py-1 text-xs font-semibold text-on-brand hover:bg-brand/90 disabled:bg-brand/70"
          onClick={handleCreate}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Create rule'}
        </Button>
        {status && <p className="text-xs text-error">{status}</p>}
      </div>
    </div>
  );
}
