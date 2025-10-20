'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import type { EngineCaps, EnginePricingDetails } from '@/types/engines';

type EngineOverride = {
  active: boolean;
  availability: string | null;
  status: string | null;
  latencyTier: string | null;
} | null;

type EngineSettingsRecord = {
  engine_id: string;
  options: Record<string, unknown> | null;
  pricing: EnginePricingDetails | null;
  updated_at: string;
  updated_by: string | null;
} | null;

type EngineEntry = {
  engine: EngineCaps;
  disabled: boolean;
  override: EngineOverride;
  settings: EngineSettingsRecord;
};

type EnginesResponse = {
  ok: boolean;
  engines: EngineEntry[];
};

const fetcher = async (url: string): Promise<EnginesResponse> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as EnginesResponse;
};

const listFromArray = (values: string[]): string => values.join(', ');
const parseStringList = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
const parseNumberList = (value: string): number[] =>
  value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.round(entry));

const toDollarString = (cents?: number | null): string =>
  cents != null ? (cents / 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : '';
const toCents = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(0, Math.round(numeric * 100));
};

type OptionsState = {
  label: string;
  provider: string;
  maxDuration: string;
  modes: string;
  resolutions: string;
  aspectRatios: string;
  fps: string;
  audio: boolean;
  upscale: boolean;
  extend: boolean;
  motion: boolean;
  keyframes: boolean;
  availability: string;
  latencyTier: string;
  apiAvailability: string;
  brandId: string;
};

type PricingState = {
  currency: string;
  defaultPerSecond: string;
  perResolution: Record<string, string>;
};

function buildOptionsState(entry: EngineEntry): OptionsState {
  const engine = entry.engine;
  const settings = entry.settings?.options ?? null;
  return {
    label: (typeof settings?.label === 'string' && settings.label) || engine.label,
    provider: (typeof settings?.provider === 'string' && settings.provider) || engine.provider,
    maxDuration: String(settings?.maxDurationSec ?? engine.maxDurationSec ?? ''),
    modes: listFromArray((Array.isArray(settings?.modes) ? (settings?.modes as string[]) : engine.modes) ?? []),
    resolutions: listFromArray((Array.isArray(settings?.resolutions) ? (settings?.resolutions as string[]) : engine.resolutions) ?? []),
    aspectRatios: listFromArray(
      (Array.isArray(settings?.aspectRatios) ? (settings?.aspectRatios as string[]) : engine.aspectRatios) ?? []
    ),
    fps: ((Array.isArray(settings?.fps) ? settings?.fps : engine.fps) ?? []).join(', '),
    audio: typeof settings?.audio === 'boolean' ? settings.audio : engine.audio,
    upscale: typeof settings?.upscale4k === 'boolean' ? settings.upscale4k : engine.upscale4k,
    extend: typeof settings?.extend === 'boolean' ? settings.extend : engine.extend,
    motion: typeof settings?.motionControls === 'boolean' ? settings.motionControls : engine.motionControls,
    keyframes: typeof settings?.keyframes === 'boolean' ? settings.keyframes : engine.keyframes,
    availability: (typeof settings?.availability === 'string' && settings.availability) || engine.availability,
    latencyTier: (typeof settings?.latencyTier === 'string' && settings.latencyTier) || engine.latencyTier,
    apiAvailability:
      (typeof settings?.apiAvailability === 'string' && settings.apiAvailability) || engine.apiAvailability || '',
    brandId: (typeof settings?.brandId === 'string' && settings.brandId) || engine.brandId || '',
  };
}

function buildPricingState(entry: EngineEntry): PricingState {
  const pricing = entry.settings?.pricing ?? entry.engine.pricingDetails ?? null;
  const perResolutionKeys = new Set<string>();
  entry.engine.resolutions.forEach((res) => {
    if (res !== 'auto') perResolutionKeys.add(res);
  });
  if (pricing?.perSecondCents?.byResolution) {
    Object.keys(pricing.perSecondCents.byResolution).forEach((key) => perResolutionKeys.add(key));
  }

  const perResolution: Record<string, string> = {};
  [...perResolutionKeys].forEach((key) => {
    const cents = pricing?.perSecondCents?.byResolution?.[key] ?? null;
    perResolution[key] = toDollarString(cents);
  });

  const state: PricingState = {
    currency: pricing?.currency ?? entry.engine.pricing?.currency ?? 'USD',
    defaultPerSecond: toDollarString(pricing?.perSecondCents?.default ?? null),
    perResolution,
  };

  if (entry.engine.id === 'sora-2') {
    state.defaultPerSecond = state.defaultPerSecond || '0.1';
  }

  if (entry.engine.id === 'sora-2-pro') {
    state.perResolution['720p'] = state.perResolution['720p'] || '0.30';
    state.perResolution['1080p'] = state.perResolution['1080p'] || '0.50';
    if (!state.defaultPerSecond) {
      state.defaultPerSecond = '';
    }
  }

  return state;
}

type EngineEditorProps = {
  entry: EngineEntry;
  mutate: () => Promise<void>;
};

function EngineEditor({ entry, mutate }: EngineEditorProps) {
  const [active, setActive] = useState(!entry.disabled);
  const [savingActive, setSavingActive] = useState(false);
  const [optionsState, setOptionsState] = useState<OptionsState>(() => buildOptionsState(entry));
  const [optionsSaving, setOptionsSaving] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [pricingState, setPricingState] = useState<PricingState>(() => buildPricingState(entry));
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  useEffect(() => {
    setActive(!entry.disabled);
    setOptionsState(buildOptionsState(entry));
    setPricingState(buildPricingState(entry));
    setOptionsError(null);
    setPricingError(null);
  }, [entry]);

  const resolutionList = useMemo(() => Object.keys(pricingState.perResolution).sort(), [pricingState.perResolution]);

  const updateOverride = async (nextActive: boolean) => {
    setSavingActive(true);
    try {
      const res = await fetch(`/api/admin/engines/${entry.engine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ override: { active: nextActive } }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await mutate();
    } catch (error) {
      console.error(error);
      setActive(!nextActive);
      alert((error as Error).message || 'Unable to update engine state.');
    } finally {
      setSavingActive(false);
    }
  };

  const handleActiveToggle = () => {
    const next = !active;
    setActive(next);
    void updateOverride(next);
  };

  const handleOptionsSave = async () => {
    setOptionsSaving(true);
    setOptionsError(null);
    try {
      const payload: Record<string, unknown> = {
        label: optionsState.label.trim(),
        provider: optionsState.provider.trim(),
        maxDurationSec: Number(optionsState.maxDuration),
        modes: parseStringList(optionsState.modes),
        resolutions: parseStringList(optionsState.resolutions),
        aspectRatios: parseStringList(optionsState.aspectRatios),
        fps: parseNumberList(optionsState.fps),
        audio: optionsState.audio,
        upscale4k: optionsState.upscale,
        extend: optionsState.extend,
        motionControls: optionsState.motion,
        keyframes: optionsState.keyframes,
        availability: optionsState.availability.trim(),
        latencyTier: optionsState.latencyTier.trim(),
        apiAvailability: optionsState.apiAvailability.trim() || undefined,
        brandId: optionsState.brandId.trim() || undefined,
      };

      if (!Array.isArray(payload.modes) || payload.modes.length === 0) delete payload.modes;
      if (!Array.isArray(payload.resolutions) || payload.resolutions.length === 0) delete payload.resolutions;
      if (!Array.isArray(payload.aspectRatios) || payload.aspectRatios.length === 0) delete payload.aspectRatios;
      if (!Array.isArray(payload.fps) || payload.fps.length === 0) delete payload.fps;
      if (!payload.maxDurationSec || Number.isNaN(payload.maxDurationSec as number)) {
        delete payload.maxDurationSec;
      }
      if (!payload.availability) delete payload.availability;
      if (!payload.latencyTier) delete payload.latencyTier;
      if (!payload.apiAvailability) delete payload.apiAvailability;
      if (!payload.brandId) delete payload.brandId;

      const res = await fetch(`/api/admin/engines/${entry.engine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: payload }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await mutate();
    } catch (error) {
      console.error(error);
      setOptionsError((error as Error).message || 'Unable to update options.');
    } finally {
      setOptionsSaving(false);
    }
  };

  const handlePricingSave = async () => {
    setPricingSaving(true);
    setPricingError(null);
    try {
      const defaultCents = toCents(pricingState.defaultPerSecond);
      const perResolution: Record<string, number> = {};
      for (const [resolution, value] of Object.entries(pricingState.perResolution)) {
        const cents = toCents(value);
        if (cents != null) {
          perResolution[resolution] = cents;
        }
      }

      const pricing: EnginePricingDetails = {
        currency: pricingState.currency.trim().toUpperCase() || 'USD',
        perSecondCents:
          defaultCents != null || Object.keys(perResolution).length
            ? {
                default: defaultCents ?? undefined,
                byResolution: Object.keys(perResolution).length ? perResolution : undefined,
              }
            : undefined,
      };

      const res = await fetch(`/api/admin/engines/${entry.engine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await mutate();
    } catch (error) {
      console.error(error);
      setPricingError((error as Error).message || 'Unable to update pricing.');
    } finally {
      setPricingSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Revenir aux paramètres par défaut pour ce moteur ?')) return;
    setOptionsSaving(true);
    setPricingSaving(true);
    try {
      const res = await fetch(`/api/admin/engines/${entry.engine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await mutate();
    } catch (error) {
      console.error(error);
      alert((error as Error).message || 'Unable to reset engine configuration.');
    } finally {
      setOptionsSaving(false);
      setPricingSaving(false);
    }
  };

  const handlePerResolutionChange = (resolution: string, value: string) => {
    setPricingState((prev) => ({
      ...prev,
      perResolution: {
        ...prev.perResolution,
        [resolution]: value,
      },
    }));
  };

  return (
    <section className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{entry.engine.label}</h3>
          <p className="text-sm text-text-secondary">
            {entry.engine.provider} · {entry.engine.status} · {entry.engine.availability}
          </p>
          <p className="text-xs text-text-tertiary">
            Latency {entry.engine.latencyTier} · ID {entry.engine.id}
          </p>
        </div>
        <button
          type="button"
          className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${
            active ? 'border border-accent/30 bg-accent/10 text-accent' : 'border border-hairline bg-bg text-text-secondary'
          }`}
          onClick={handleActiveToggle}
          disabled={savingActive}
        >
          {savingActive ? 'Saving…' : active ? 'Active' : 'Disabled'}
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-tertiary">Options</h4>
          <div className="grid gap-3">
            <label className="text-xs text-text-tertiary">
              Label
              <input
                value={optionsState.label}
                onChange={(event) => setOptionsState((prev) => ({ ...prev, label: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <label className="text-xs text-text-tertiary">
              Provider
              <input
                value={optionsState.provider}
                onChange={(event) => setOptionsState((prev) => ({ ...prev, provider: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-text-tertiary">
                Max duration (sec)
                <input
                  type="number"
                  min={1}
                  value={optionsState.maxDuration}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, maxDuration: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                />
              </label>
              <label className="text-xs text-text-tertiary">
                Modes
                <input
                  value={optionsState.modes}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, modes: event.target.value }))}
                  placeholder="t2v, i2v"
                  className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                />
              </label>
            </div>
            <label className="text-xs text-text-tertiary">
              Resolutions
              <input
                value={optionsState.resolutions}
                onChange={(event) => setOptionsState((prev) => ({ ...prev, resolutions: event.target.value }))}
                placeholder="720p, 1080p, 4k"
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <label className="text-xs text-text-tertiary">
              Aspect ratios
              <input
                value={optionsState.aspectRatios}
                onChange={(event) => setOptionsState((prev) => ({ ...prev, aspectRatios: event.target.value }))}
                placeholder="16:9, 9:16"
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <label className="text-xs text-text-tertiary">
              FPS
              <input
                value={optionsState.fps}
                onChange={(event) => setOptionsState((prev) => ({ ...prev, fps: event.target.value }))}
                placeholder="24, 30"
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={optionsState.audio}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, audio: event.target.checked }))}
                />
                Audio
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={optionsState.upscale}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, upscale: event.target.checked }))}
                />
                Upscale 4K
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={optionsState.extend}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, extend: event.target.checked }))}
                />
                Extend
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={optionsState.motion}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, motion: event.target.checked }))}
                />
                Motion controls
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={optionsState.keyframes}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, keyframes: event.target.checked }))}
                />
                Keyframes
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-text-tertiary">
                Availability
                <input
                  value={optionsState.availability}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, availability: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                />
              </label>
              <label className="text-xs text-text-tertiary">
                Latency tier
                <input
                  value={optionsState.latencyTier}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, latencyTier: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-text-tertiary">
                API availability
                <input
                  value={optionsState.apiAvailability}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, apiAvailability: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                />
              </label>
              <label className="text-xs text-text-tertiary">
                Brand ID
                <input
                  value={optionsState.brandId}
                  onChange={(event) => setOptionsState((prev) => ({ ...prev, brandId: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                />
              </label>
            </div>
          </div>
          {optionsError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{optionsError}</div>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="rounded border border-hairline px-3 py-1 text-xs uppercase tracking-[0.16em] text-text-secondary transition hover:bg-bg disabled:opacity-60"
              onClick={handleReset}
              disabled={optionsSaving || pricingSaving}
            >
              Reset to defaults
            </button>
            <button
              type="button"
              className="rounded-lg border border-accent/20 bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-accent/90 disabled:opacity-60"
              onClick={handleOptionsSave}
              disabled={optionsSaving}
            >
              {optionsSaving ? 'Saving…' : 'Save options'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-tertiary">Pricing</h4>
          <div className="grid gap-3">
            <label className="text-xs text-text-tertiary">
              Currency
              <input
                value={pricingState.currency}
                onChange={(event) =>
                  setPricingState((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                }
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm uppercase text-text-primary"
                maxLength={6}
              />
            </label>
            <label className="text-xs text-text-tertiary">
              Default rate (USD/sec)
              <input
                type="number"
                step="0.001"
                min="0"
                value={pricingState.defaultPerSecond}
                onChange={(event) =>
                  setPricingState((prev) => ({ ...prev, defaultPerSecond: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <div className="space-y-2">
              <p className="text-xs text-text-tertiary">Per resolution overrides (USD/sec)</p>
              <div className="grid gap-2">
                {resolutionList.map((resolution) => (
                  <label key={resolution} className="text-xs text-text-tertiary">
                    {resolution}
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={pricingState.perResolution[resolution] ?? ''}
                      onChange={(event) => handlePerResolutionChange(resolution, event.target.value)}
                      className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                    />
                  </label>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-text-muted">
              Si un API key OpenAI est fourni côté client, la facturation s’effectuera directement chez OpenAI.
            </p>
          </div>
          {pricingError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{pricingError}</div>
          ) : null}
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-lg border border-accent/20 bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-accent/90 disabled:opacity-60"
              onClick={handlePricingSave}
              disabled={pricingSaving}
            >
              {pricingSaving ? 'Saving…' : 'Save pricing'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AdminEnginesPage() {
  const { data, error, isLoading, mutate } = useSWR<EnginesResponse>('/api/admin/engines', fetcher);

  const unauthorized = error?.message?.includes('Unauthorized') || error?.message?.includes('Forbidden');

  const handleMutate = async () => {
    await mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Engine controls</h2>
        <p className="text-sm text-text-secondary">
          Ajustez les options, la disponibilité et la tarification de chaque moteur en un seul endroit.
        </p>
      </div>

      {unauthorized ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Access denied. Admin sign-in required.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-hairline bg-white p-6 text-sm text-text-secondary shadow-card">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error.message || 'Failed to load engines.'}
        </div>
      ) : data?.engines?.length ? (
        <div className="space-y-6">
          {data.engines.map((entry) => (
            <EngineEditor key={entry.engine.id} entry={entry} mutate={handleMutate} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-white p-6 text-sm text-text-secondary shadow-card">
          No engines configured.
        </div>
      )}
    </div>
  );
}
