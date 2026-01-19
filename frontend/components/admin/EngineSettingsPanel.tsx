'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

export function EngineSettingsPanel({ engineId, engineLabel, baseline, initialForm }: EngineSettingsPanelProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);

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
    <section className="space-y-4 rounded-2xl border border-border/60 bg-surface-glass-95 p-5 shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Engine</p>
          <h3 className="text-lg font-semibold text-text-primary">{engineLabel}</h3>
          <p className="text-xs text-text-secondary">
            Availability: <strong>{baseline.availability}</strong> · Status: <strong>{baseline.status ?? 'n/a'}</strong> · Latency:{' '}
            <strong>{baseline.latencyTier ?? 'n/a'}</strong>
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleReset}
          className="rounded-full border-border/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-text-secondary hover:bg-bg"
          disabled={submitting}
        >
          Reset overrides
        </Button>
      </header>

      <form onSubmit={handleSubmit} className="stack-gap-sm">
        <div className="grid grid-gap-sm md:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Active
            <select
              className="mt-1 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm"
              value={form.active ? 'true' : 'false'}
              onChange={(event) => handleChange('active', event.target.value === 'true')}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Availability
            <select
              className="mt-1 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm"
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
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Status
            <select
              className="mt-1 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm capitalize"
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
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Latency tier
            <select
              className="mt-1 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm capitalize"
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

        <div className="grid grid-gap-sm md:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Max duration (seconds)
            <input
              type="number"
              min="1"
              className="mt-1 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm"
              value={form.maxDurationSec}
              onChange={(event) => handleChange('maxDurationSec', event.target.value)}
              placeholder={baseline.maxDurationSec ? String(baseline.maxDurationSec) : ''}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted md:col-span-3">
            Resolutions (comma separated)
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm"
              value={form.resolutions}
              onChange={(event) => handleChange('resolutions', event.target.value)}
              placeholder={baseline.resolutions.join(', ') || '1080p, 4k'}
            />
          </label>
        </div>

        <div className="grid grid-gap-sm md:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Currency
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm"
              value={form.currency}
              onChange={(event) => handleChange('currency', event.target.value)}
              placeholder={baseline.currency}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Per-second rate (cents)
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm"
              value={form.perSecondCents}
              onChange={(event) => handleChange('perSecondCents', event.target.value)}
              placeholder={baseline.perSecondCents != null ? String(baseline.perSecondCents) : ''}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Flat charge (cents)
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-lg border border-border/70 bg-surface px-3 py-2 text-sm"
              value={form.flatCents}
              onChange={(event) => handleChange('flatCents', event.target.value)}
              placeholder={baseline.flatCents != null ? String(baseline.flatCents) : ''}
            />
          </label>
        </div>

        {status ? (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              status.variant === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {status.message}
          </div>
        ) : null}

        <div className="flex items-center gap-4">
          <Button
            type="submit"
            size="sm"
            disabled={submitting}
            className="rounded-full bg-text-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-on-inverse"
          >
            {submitting ? 'Saving…' : 'Save settings'}
          </Button>
          <p className="text-xs text-text-secondary">
            Leave a field blank to keep the upstream configuration. Current defaults shown as placeholders.
          </p>
        </div>
      </form>
    </section>
  );
}
