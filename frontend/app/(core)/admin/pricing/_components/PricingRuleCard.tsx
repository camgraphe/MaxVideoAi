'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { convertFormToPayload, convertRuleToForm } from '../_lib/pricing-admin-helpers';
import type { PricingRule, RuleForm } from '../_lib/pricing-admin-types';
import { PricingAdminField } from './PricingAdminField';

type RuleCardProps = {
  rule: PricingRule;
  onRefresh: () => void | Promise<unknown>;
};

export function PricingRuleCard({ rule, onRefresh }: RuleCardProps) {
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
        <PricingAdminField
          label="Engine ID"
          value={form.engineId}
          disabled={!editing}
          onChange={(value) => handleChange('engineId', value)}
          placeholder="Leave blank for default"
        />
        <PricingAdminField
          label="Resolution"
          value={form.resolution}
          disabled={!editing}
          onChange={(value) => handleChange('resolution', value)}
          placeholder="all"
        />
        <PricingAdminField
          label="Margin (%)"
          value={form.marginPercent}
          disabled={!editing}
          onChange={(value) => handleChange('marginPercent', value)}
        />
        <PricingAdminField
          label="Flat margin (USD)"
          value={form.marginFlatUsd}
          disabled={!editing}
          onChange={(value) => handleChange('marginFlatUsd', value)}
        />
        <PricingAdminField
          label="Currency"
          value={form.currency}
          disabled={!editing}
          onChange={(value) => handleChange('currency', value)}
        />
        <PricingAdminField
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
