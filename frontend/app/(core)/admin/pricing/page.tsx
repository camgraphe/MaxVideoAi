'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

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

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
        <h1 className="text-xl font-semibold text-text-primary">Pricing controls</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Adjust wallet membership thresholds, discounts, and per-engine margins. Changes propagate instantly to new quotes
          and wallet charges.
        </p>
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Membership tiers</h2>
            <p className="text-xs text-text-tertiary">
              Control spend requirements and automatic discounts applied to Plus and Pro tiers.
            </p>
          </div>
          <button
            type="button"
            className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSaveMembership}
            disabled={savingMembership || membershipLoading || !!membershipError}
          >
            {savingMembership ? 'Saving…' : 'Save tiers'}
          </button>
        </div>
        {membershipLoading ? (
          <p className="mt-4 text-sm text-text-secondary">Loading membership tiers…</p>
        ) : membershipError ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            Failed to load membership tiers.
          </p>
        ) : orderedMembership.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {orderedMembership.map((tier) => {
              const editable = membershipDraft[tier.tier] ?? { thresholdUsd: '', discountPct: '' };
              const label = tier.tier.slice(0, 1).toUpperCase() + tier.tier.slice(1);
              const thresholdDefault = formatCurrencyCents(tier.spendThresholdCents);
              return (
                <div key={tier.tier} className="rounded-xl border border-hairline bg-bg p-4">
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
                        className="rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
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
                        className="rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">No membership tiers found.</p>
        )}
        {membershipStatus ? (
          <p
            className={`mt-4 text-xs ${
              membershipStatus === 'saved' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {membershipStatus === 'saved' ? 'Membership tiers saved.' : membershipStatus}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Pricing rules</h2>
            <p className="text-xs text-text-tertiary">
              Override per-engine margins. Values apply to future quotes and charges.
            </p>
          </div>
        </div>

        {rulesLoading ? (
          <p className="text-sm text-text-secondary">Loading pricing rules…</p>
        ) : rulesError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">Failed to load pricing rules.</p>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <PricingRuleCard key={rule.id} rule={rule} onRefresh={() => mutateRules()} />
            ))}
            <NewPricingRuleCard onCreated={() => mutateRules()} />
          </div>
        )}
      </section>
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
    <div className="rounded-xl border border-hairline bg-bg p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{labelParts}</h3>
          <p className="text-xs text-text-tertiary">Rule ID: {rule.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            onClick={() => setEditing((prev) => !prev)}
            disabled={saving}
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button
            type="button"
            className="rounded-pill border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleDelete}
            disabled={saving || rule.id === 'default'}
          >
            Delete
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="rounded-pill border border-accent bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-accent/70"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {status && <p className="text-xs text-rose-600">{status}</p>}
        </div>
      ) : status === 'saved' ? (
        <p className="mt-2 text-xs text-emerald-600">Rule saved.</p>
      ) : status ? (
        <p className="mt-2 text-xs text-rose-600">{status}</p>
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
        className="rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
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
      <button
        type="button"
        className="rounded-xl border border-dashed border-hairline px-4 py-6 text-sm font-semibold text-text-secondary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        onClick={() => setOpen(true)}
      >
        + Add pricing rule
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">New pricing rule</h3>
        <button
          type="button"
          className="text-xs text-text-tertiary transition hover:text-text-secondary"
          onClick={() => setOpen(false)}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          className="rounded-pill border border-accent bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-accent/70"
          onClick={handleCreate}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Create rule'}
        </button>
        {status && <p className="text-xs text-rose-600">{status}</p>}
      </div>
    </div>
  );
}
