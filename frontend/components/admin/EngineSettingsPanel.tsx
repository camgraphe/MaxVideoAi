'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type EngineSettingsPanelProps = {
  engineId: string;
  engineLabel: string;
  baseline: {
    availability: string;
    status: string | null;
    latencyTier: string | null;
    maxDurationSec: number | null;
    resolutions: string[];
    currency: string;
    perSecondCents: number | null;
    flatCents: number | null;
  };
  initialForm: {
    active: boolean;
    availability: string;
    status: string;
    latencyTier: string;
    maxDurationSec: string;
    resolutions: string;
    currency: string;
    perSecondCents: string;
    flatCents: string;
  };
};

type StatusMessage = { variant: 'success' | 'error'; message: string } | null;

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function EngineSettingsPanel({ engineId, engineLabel, baseline, initialForm }: EngineSettingsPanelProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [isOpen, setIsOpen] = useState(!initialForm.active || initialForm.availability !== 'available' || initialForm.status !== 'live');

  const handleChange = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const payload: Record<string, unknown> = {};
      payload.override = {
        active: form.active,
        availability: form.availability || null,
        status: form.status || null,
        latencyTier: form.latencyTier || null,
      };

      const options: Record<string, unknown> = {};
      const maxDurationValue = Number(form.maxDurationSec);
      if (form.maxDurationSec.trim().length) {
        if (Number.isFinite(maxDurationValue) && maxDurationValue > 0) {
          options.maxDurationSec = Math.round(maxDurationValue);
        } else {
          throw new Error('Max duration must be a positive number.');
        }
      }
      if (form.resolutions.trim().length) {
        options.resolutions = form.resolutions
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean);
      }
      if (Object.keys(options).length) {
        payload.options = options;
      }

      const pricing: Record<string, unknown> = {};
      if (form.currency.trim().length) {
        pricing.currency = form.currency.trim().toUpperCase();
      }
      if (form.perSecondCents.trim().length) {
        const perSecondValue = Number(form.perSecondCents);
        if (!Number.isFinite(perSecondValue) || perSecondValue < 0) {
          throw new Error('Per-second rate must be a non-negative number of cents.');
        }
        pricing.perSecondCents = { default: Math.round(perSecondValue) };
      }
      if (form.flatCents.trim().length) {
        const flatValue = Number(form.flatCents);
        if (!Number.isFinite(flatValue) || flatValue < 0) {
          throw new Error('Flat charge must be a non-negative number of cents.');
        }
        pricing.flatCents = { default: Math.round(flatValue) };
      }
      if (Object.keys(pricing).length) {
        payload.pricing = pricing;
      }

      const response = await fetch(`/api/admin/engines/${engineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? 'Failed to update engine settings.');
      }
      setStatus({ variant: 'success', message: 'Settings saved.' });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update engine settings.';
      setStatus({ variant: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (submitting) return;
    const confirmed = window.confirm('Reset all overrides for this engine?');
    if (!confirmed) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/engines/${engineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? 'Failed to reset engine settings.');
      }
      setStatus({ variant: 'success', message: 'Overrides reset.' });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset engine settings.';
      setStatus({ variant: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <details className="group" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 marker:hidden">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{engineLabel}</p>
            <span className={pillClass(form.active ? 'success' : 'warning')}>{form.active ? 'active' : 'disabled'}</span>
            <span className={pillClass(form.availability === 'available' ? 'default' : 'warning')}>{form.availability}</span>
            <span className={pillClass(form.status === 'live' ? 'default' : 'warning')}>{form.status.replace('_', ' ')}</span>
          </div>
          <p className="mt-1 font-mono text-xs text-text-muted">{engineId}</p>
          <p className="mt-2 text-sm text-text-secondary">
            {form.latencyTier} latency
            {baseline.maxDurationSec ? ` · ${baseline.maxDurationSec}s max` : ''}
            {baseline.resolutions.length ? ` · ${baseline.resolutions.join(', ')}` : ''}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Baseline: {baseline.availability} · {baseline.status ?? 'n/a'} · {baseline.latencyTier ?? 'n/a'}
            {baseline.perSecondCents != null ? ` · ${formatMoneyFromCents(baseline.perSecondCents, baseline.currency)} / sec` : ''}
            {baseline.flatCents != null ? ` · ${formatMoneyFromCents(baseline.flatCents, baseline.currency)} flat` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-xs text-text-muted sm:inline">Edit override</span>
          <ChevronDown className="h-4 w-4 text-text-muted transition group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-hairline px-5 py-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-3 xl:grid-cols-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Active
              <select
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.active ? 'true' : 'false'}
                onChange={(event) => handleChange('active', event.target.value === 'true')}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Availability
              <select
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.availability}
                onChange={(event) => handleChange('availability', event.target.value)}
              >
                {['available', 'limited', 'waitlist', 'paused'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Status
              <select
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm capitalize text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.status}
                onChange={(event) => handleChange('status', event.target.value)}
              >
                {['live', 'busy', 'degraded', 'maintenance', 'early_access'].map((value) => (
                  <option key={value} value={value}>
                    {value.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Latency tier
              <select
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm capitalize text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.latencyTier}
                onChange={(event) => handleChange('latencyTier', event.target.value)}
              >
                {['fast', 'standard'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Max duration (seconds)
              <input
                type="number"
                min="1"
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.maxDurationSec}
                onChange={(event) => handleChange('maxDurationSec', event.target.value)}
                placeholder={baseline.maxDurationSec ? String(baseline.maxDurationSec) : ''}
              />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Resolutions (comma separated)
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.resolutions}
                onChange={(event) => handleChange('resolutions', event.target.value)}
                placeholder={baseline.resolutions.join(', ') || '1080p, 4k'}
              />
            </label>
          </div>

          <div className="grid gap-3 xl:grid-cols-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Currency
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.currency}
                onChange={(event) => handleChange('currency', event.target.value)}
                placeholder={baseline.currency}
              />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Per-second rate (cents)
              <input
                type="number"
                min="0"
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.perSecondCents}
                onChange={(event) => handleChange('perSecondCents', event.target.value)}
                placeholder={baseline.perSecondCents != null ? String(baseline.perSecondCents) : ''}
              />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Flat charge (cents)
              <input
                type="number"
                min="0"
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.flatCents}
                onChange={(event) => handleChange('flatCents', event.target.value)}
                placeholder={baseline.flatCents != null ? String(baseline.flatCents) : ''}
              />
            </label>
            <div className="rounded-xl border border-hairline bg-bg/50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Current pricing</p>
              <p className="mt-2 text-sm text-text-secondary">
                {baseline.perSecondCents != null ? `${formatMoneyFromCents(baseline.perSecondCents, baseline.currency)} / sec` : 'No per-second rate'}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {baseline.flatCents != null ? `${formatMoneyFromCents(baseline.flatCents, baseline.currency)} flat` : 'No flat charge'}
              </p>
            </div>
          </div>

          {status ? (
            <div
              className={[
                'rounded-xl border px-3 py-2 text-sm',
                status.variant === 'success'
                  ? 'border-success-border bg-success-bg text-success'
                  : 'border-error-border bg-error-bg text-error',
              ].join(' ')}
            >
              {status.message}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">
              Leave a field blank to keep the upstream configuration. Defaults are shown in placeholders and summary lines above.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleReset}
                className="border-border bg-surface"
                disabled={submitting}
              >
                Reset overrides
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="bg-brand text-on-brand">
                {submitting ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </details>
  );
}

function pillClass(tone: 'default' | 'success' | 'warning') {
  if (tone === 'success') return 'rounded-full border border-success-border bg-success-bg px-2.5 py-1 text-xs font-medium text-success';
  if (tone === 'warning') return 'rounded-full border border-warning-border bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning';
  return 'rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-medium text-text-secondary';
}

function formatMoneyFromCents(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value / 100);
  } catch {
    return moneyFormatter.format(value / 100);
  }
}
