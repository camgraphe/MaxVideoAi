'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { convertFormToPayload, convertRuleToForm, DEFAULT_RULE_TEMPLATE } from '../_lib/pricing-admin-helpers';
import type { RuleForm } from '../_lib/pricing-admin-types';
import { PricingAdminField } from './PricingAdminField';

type NewRuleProps = {
  onCreated: () => void | Promise<unknown>;
};

export function NewPricingRuleCard({ onCreated }: NewRuleProps) {
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
        <PricingAdminField
          label="Engine ID"
          value={form.engineId}
          onChange={(value) => handleChange('engineId', value)}
          placeholder="Optional"
        />
        <PricingAdminField
          label="Resolution"
          value={form.resolution}
          onChange={(value) => handleChange('resolution', value)}
          placeholder="Optional"
        />
        <PricingAdminField label="Margin (%)" value={form.marginPercent} onChange={(value) => handleChange('marginPercent', value)} />
        <PricingAdminField label="Flat margin (USD)" value={form.marginFlatUsd} onChange={(value) => handleChange('marginFlatUsd', value)} />
        <PricingAdminField label="Currency" value={form.currency} onChange={(value) => handleChange('currency', value)} />
        <PricingAdminField
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
