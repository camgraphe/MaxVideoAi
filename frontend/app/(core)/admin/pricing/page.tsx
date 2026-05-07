'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import useSWR from 'swr';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminLoadingPanel } from '@/components/admin-system/feedback/AdminLoadingPanel';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionButton, AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { BillingProductCard } from './_components/BillingProductCard';
import { NewPricingRuleCard } from './_components/NewPricingRuleCard';
import { PricingRuleCard } from './_components/PricingRuleCard';
import {
  buildPricingOverviewItems,
  fetcher,
  formatCurrencyCents,
  formatPercent,
  isLegacyProduct,
  TIER_ORDER,
} from './_lib/pricing-admin-helpers';
import type {
  BillingProductsResponse,
  MembershipDraft,
  MembershipResponse,
  MembershipTier,
  PricingRulesResponse,
} from './_lib/pricing-admin-types';

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
            <AdminActionButton
              type="button"
              onClick={() => {
                void handleRefresh();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </AdminActionButton>
            <AdminActionLink href="/admin/engines">
              Engines
            </AdminActionLink>
            <AdminActionLink href="/admin/transactions">
              Transactions
            </AdminActionLink>
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
            <AdminActionButton
              type="button"
              onClick={handleSaveMembership}
              disabled={savingMembership || membershipLoading || !!membershipError}
            >
              {savingMembership ? 'Saving…' : 'Save tiers'}
            </AdminActionButton>
            {membershipStatus ? (
              <span className={`text-xs ${membershipStatus === 'saved' ? 'text-success' : 'text-error'}`}>
                {membershipStatus === 'saved' ? 'Membership tiers saved.' : membershipStatus}
              </span>
            ) : null}
          </div>

          {membershipLoading ? (
            <AdminLoadingPanel rows={3} compact />
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
          <AdminLoadingPanel rows={2} />
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
          <AdminLoadingPanel rows={4} />
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
