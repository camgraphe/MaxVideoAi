'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatProductSubtitle } from '../_lib/pricing-admin-helpers';
import type { BillingProduct } from '../_lib/pricing-admin-types';
import { PricingAdminField } from './PricingAdminField';

type BillingProductCardProps = {
  product: BillingProduct;
  onRefresh: () => void | Promise<unknown>;
};

export function BillingProductCard({ product, onRefresh }: BillingProductCardProps) {
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
        <PricingAdminField
          label="Label"
          value={form.label}
          onChange={(value) => {
            setForm((prev) => ({ ...prev, label: value }));
            setStatus(null);
          }}
        />
        <PricingAdminField
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
