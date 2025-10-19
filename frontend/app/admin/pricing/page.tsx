'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

type PricingRule = {
  id: string;
  engineId?: string;
  resolution?: string;
  marginPercent: number;
  marginFlatCents: number;
  surchargeAudioPercent: number;
  surchargeUpscalePercent: number;
  currency: string;
  vendorAccountId?: string;
  effectiveFrom?: string;
};

type SampleQuote = {
  resolution: string;
  durationSec: number;
  totalCents: number;
  vendorShareCents: number;
  platformFeeCents: number;
  effectivePerSecond: number;
};

type AdminPricingEngineSummary = {
  id: string;
  label: string;
  provider: string;
  availability: string;
  latencyTier: string;
  disabled: boolean;
  vendor: {
    currency: string;
    basePerSecondCents?: number;
    perResolution?: Record<string, number>;
    addons?: Record<string, { perSecondCents?: number; flatCents?: number } | undefined>;
    notes?: string | null;
    sourceSlug?: string;
    sourceProvider?: string;
  };
  rule?: PricingRule;
  resolutionRules: Array<{ resolution: string; rule: PricingRule }>;
  sampleQuote?: SampleQuote | null;
};

type AdminPricingOverview = {
  ok: true;
  defaultRule: PricingRule | null;
  engines: AdminPricingEngineSummary[];
  metadata: {
    catalogFetchedAt?: number;
    engineCount: number;
  };
};

type EditorState = {
  title: string;
  engineId: string | null;
  engineLabel?: string;
  resolution: string | null;
  resolutionEditable: boolean;
  rule?: PricingRule | null;
  suggestedCurrency: string;
};

type FormState = {
  marginPercentInput: string;
  marginFlatCentsInput: string;
  surchargeAudioPercentInput: string;
  surchargeUpscalePercentInput: string;
  currencyInput: string;
  vendorAccountIdInput: string;
  resolutionInput: string;
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
};

const formatPercent = (value?: number, fallback = '—'): string => {
  if (value == null) return fallback;
  const percent = value * 100;
  const rounded = Math.abs(percent - Math.round(percent)) < 1e-6 ? Math.round(percent) : Number(percent.toFixed(2));
  return `${rounded}%`;
};

const formatCents = (cents?: number, currency = 'USD'): string => {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
};

const toInputPercent = (value?: number): string => {
  if (value == null) return '';
  const raw = value * 100;
  return Math.abs(raw - Math.round(raw)) < 1e-6 ? String(Math.round(raw)) : raw.toFixed(2);
};

const parsePercentInput = (value: string): number => {
  if (!value.trim()) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('Invalid percentage');
  }
  return numeric / 100;
};

const parseIntegerInput = (value: string): number => {
  if (!value.trim()) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('Invalid number');
  }
  return Math.round(numeric);
};

const INITIAL_FORM: FormState = {
  marginPercentInput: '',
  marginFlatCentsInput: '',
  surchargeAudioPercentInput: '',
  surchargeUpscalePercentInput: '',
  currencyInput: 'USD',
  vendorAccountIdInput: '',
  resolutionInput: '',
};

export default function AdminPricingPage() {
  const { data, error, isLoading, mutate } = useSWR<AdminPricingOverview>(
    '/api/admin/pricing/engines',
    fetchJson
  );
  const [refreshing, setRefreshing] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;
    const baseRule = editor.rule ?? data?.defaultRule ?? null;
    setForm({
      marginPercentInput: toInputPercent(baseRule?.marginPercent ?? 0.2),
      marginFlatCentsInput: String(baseRule?.marginFlatCents ?? 0),
      surchargeAudioPercentInput: toInputPercent(baseRule?.surchargeAudioPercent ?? 0),
      surchargeUpscalePercentInput: toInputPercent(baseRule?.surchargeUpscalePercent ?? 0),
      currencyInput: editor.suggestedCurrency || baseRule?.currency || 'USD',
      vendorAccountIdInput: baseRule?.vendorAccountId ?? '',
      resolutionInput: editor.resolution ?? '',
    });
    setFormError(null);
  }, [editor, data?.defaultRule]);

  const handleRefreshCatalog = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const refreshed = await fetchJson<AdminPricingOverview>('/api/admin/pricing/engines?refresh=1');
      await mutate(refreshed, false);
    } catch (err) {
      alert((err as Error).message || 'Failed to refresh vendor catalog');
    } finally {
      setRefreshing(false);
    }
  };

  const openEditor = (state: EditorState) => {
    setEditor(state);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
    setForm(INITIAL_FORM);
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setFormError(null);
    try {
      const marginPercent = parsePercentInput(form.marginPercentInput);
      const marginFlatCents = parseIntegerInput(form.marginFlatCentsInput);
      const surchargeAudioPercent = parsePercentInput(form.surchargeAudioPercentInput);
      const surchargeUpscalePercent = parsePercentInput(form.surchargeUpscalePercentInput);
      const currency = form.currencyInput.trim() || 'USD';
      const resolution = editor.resolutionEditable ? form.resolutionInput.trim() : editor.resolution ?? null;
      if (editor.engineId && editor.resolutionEditable && !resolution) {
        throw new Error('Indiquez une résolution');
      }

      const payload = {
        id: editor.rule?.id,
        engineId: editor.engineId,
        resolution: resolution || null,
        marginPercent,
        marginFlatCents,
        surchargeAudioPercent,
        surchargeUpscalePercent,
        currency,
        vendorAccountId: form.vendorAccountIdInput.trim() || null,
      };

      const res = await fetch('/api/admin/pricing/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await mutate();
      closeEditor();
    } catch (err) {
      setFormError((err as Error).message ?? 'Erreur lors de l’enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Supprimer cette règle de tarification ?')) return;
    try {
      const res = await fetch(`/api/admin/pricing/rules/${encodeURIComponent(ruleId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      await mutate();
      closeEditor();
    } catch (err) {
      alert((err as Error).message || 'Impossible de supprimer la règle');
    }
  };

  const defaultRule = data?.defaultRule;
  const engines = data?.engines ?? [];

  const catalogTimestamp = useMemo(() => {
    if (!data?.metadata.catalogFetchedAt) return null;
    return new Date(data.metadata.catalogFetchedAt).toLocaleString();
  }, [data?.metadata.catalogFetchedAt]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Pricing controls</h2>
          <p className="text-sm text-text-secondary">
            Ajustez les marges appliquées aux moteurs et vérifiez les tarifs fournisseurs Fal.ai.
          </p>
          {catalogTimestamp ? (
            <p className="mt-1 text-xs text-text-tertiary">Catalogue rafraîchi le {catalogTimestamp}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary transition hover:bg-bg disabled:opacity-60"
          onClick={handleRefreshCatalog}
          disabled={refreshing}
        >
          {refreshing ? 'Rafraîchissement…' : 'Rafraîchir Fal'}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error.message || 'Impossible de charger les tarifs.'}
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="rounded-xl border border-hairline bg-white p-6 text-sm text-text-secondary shadow-card">
          Chargement des moteurs…
        </div>
      ) : null}

      {defaultRule ? (
        <section className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Règle par défaut</h3>
              <p className="text-sm text-text-secondary">
                Utilisée quand aucun moteur ni résolution spécifique n’a de règle dédiée.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent transition hover:bg-accent/10"
              onClick={() =>
                openEditor({
                  title: 'Modifier la règle par défaut',
                  engineId: null,
                  engineLabel: undefined,
                  resolution: null,
                  resolutionEditable: false,
                  rule: defaultRule,
                  suggestedCurrency: defaultRule.currency,
                })
              }
            >
              Modifier
            </button>
          </div>
          <dl className="mt-4 grid gap-4 text-sm text-text-secondary sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-text-tertiary">Marge</dt>
              <dd className="text-text-primary">
                {formatPercent(defaultRule.marginPercent)} + {defaultRule.marginFlatCents}¢
              </dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Supplément audio</dt>
              <dd className="text-text-primary">{formatPercent(defaultRule.surchargeAudioPercent)}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Supplément upscale</dt>
              <dd className="text-text-primary">{formatPercent(defaultRule.surchargeUpscalePercent)}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Devise</dt>
              <dd className="text-text-primary">{defaultRule.currency}</dd>
            </div>
          </dl>
          {defaultRule.effectiveFrom ? (
            <p className="mt-3 text-xs text-text-tertiary">
              Active depuis le {new Date(defaultRule.effectiveFrom).toLocaleString()}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-6">
        {engines.map((engine) => (
          <section key={engine.id} className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{engine.label}</h3>
                <p className="text-sm text-text-secondary">
                  {engine.provider} · {engine.availability} · {engine.latencyTier}
                </p>
                {engine.vendor.sourceSlug ? (
                  <p className="text-xs text-text-tertiary">
                    Fal source: {engine.vendor.sourceSlug}
                  </p>
                ) : (
                  <p className="text-xs text-text-tertiary">Fal source inconnue</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent transition hover:bg-accent/10"
                  onClick={() =>
                    openEditor({
                      title: `Règle pour ${engine.label}`,
                      engineId: engine.id,
                      engineLabel: engine.label,
                      resolution: null,
                      resolutionEditable: false,
                      rule: engine.rule ?? null,
                      suggestedCurrency: engine.vendor.currency,
                    })
                  }
                >
                  {engine.rule ? 'Modifier la règle moteur' : 'Ajouter une règle moteur'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary transition hover:bg-bg"
                  onClick={() =>
                    openEditor({
                      title: `Override par résolution (${engine.label})`,
                      engineId: engine.id,
                      engineLabel: engine.label,
                      resolution: '',
                      resolutionEditable: true,
                      rule: null,
                      suggestedCurrency: engine.vendor.currency,
                    })
                  }
                >
                  Ajouter override
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-hairline bg-bg p-4">
                <dt className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Tarif fournisseur</dt>
                <dd className="mt-2 text-text-primary">
                  {formatCents(engine.vendor.basePerSecondCents, engine.vendor.currency)} / sec
                </dd>
              </div>
              <div className="rounded-xl border border-hairline bg-bg p-4">
                <dt className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Marge appliquée</dt>
                <dd className="mt-2 text-text-primary">
                  {engine.rule ? (
                    <>
                      {formatPercent(engine.rule.marginPercent)} + {engine.rule.marginFlatCents}¢
                    </>
                  ) : (
                    'Règle par défaut'
                  )}
                </dd>
              </div>
              <div className="rounded-xl border border-hairline bg-bg p-4">
                <dt className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Suppléments</dt>
                <dd className="mt-2 text-text-primary">
                  Audio {engine.rule ? formatPercent(engine.rule.surchargeAudioPercent) : formatPercent(defaultRule?.surchargeAudioPercent)}
                  <br />
                  Upscale {engine.rule ? formatPercent(engine.rule.surchargeUpscalePercent) : formatPercent(defaultRule?.surchargeUpscalePercent)}
                </dd>
              </div>
              <div className="rounded-xl border border-hairline bg-bg p-4">
                <dt className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Aperçu</dt>
                <dd className="mt-2 text-text-primary">
                  {engine.sampleQuote ? (
                    <>
                      {formatCents(engine.sampleQuote.totalCents, engine.vendor.currency)} · {engine.sampleQuote.durationSec}s {engine.sampleQuote.resolution}
                    </>
                  ) : (
                    'Devis indisponible'
                  )}
                </dd>
              </div>
            </div>

            {engine.vendor.perResolution ? (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-text-primary">Tarifs par résolution (vendor)</h4>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-secondary">
                  {Object.entries(engine.vendor.perResolution).map(([res, cents]) => (
                    <span key={res} className="rounded-full border border-hairline px-3 py-1">
                      {res}: {formatCents(cents, engine.vendor.currency)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {engine.resolutionRules.length ? (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-text-primary">Overrides par résolution</h4>
                <div className="mt-2 space-y-2">
                  {engine.resolutionRules.map(({ resolution, rule }) => (
                    <div
                      key={`${engine.id}-${resolution}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-bg p-3 text-sm text-text-secondary"
                    >
                      <div>
                        <p className="text-text-primary">{resolution}</p>
                        <p className="text-xs text-text-tertiary">
                          {formatPercent(rule.marginPercent)} + {rule.marginFlatCents}¢
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded border border-hairline px-2 py-1 text-xs uppercase tracking-[0.16em] text-text-secondary transition hover:bg-white"
                          onClick={() =>
                            openEditor({
                              title: `${engine.label} · ${resolution}`,
                              engineId: engine.id,
                              engineLabel: engine.label,
                              resolution,
                              resolutionEditable: false,
                              rule,
                              suggestedCurrency: rule.currency || engine.vendor.currency,
                            })
                          }
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="rounded border border-rose-200 px-2 py-1 text-xs uppercase tracking-[0.16em] text-rose-600 transition hover:bg-rose-50"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </div>

      {editor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{editor.title}</h3>
                {editor.engineLabel ? (
                  <p className="text-xs text-text-tertiary">Moteur: {editor.engineLabel}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-full border border-hairline px-2 py-1 text-xs uppercase tracking-[0.16em] text-text-secondary transition hover:bg-bg"
                onClick={closeEditor}
                disabled={saving}
              >
                Fermer
              </button>
            </div>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              {editor.resolutionEditable ? (
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Résolution</label>
                  <input
                    value={form.resolutionInput}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, resolutionInput: event.target.value }))
                    }
                    placeholder="ex: 1080p"
                    className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                    required
                  />
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Marge %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.marginPercentInput}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, marginPercentInput: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Marge fixe (¢)</label>
                  <input
                    type="number"
                    step="1"
                    value={form.marginFlatCentsInput}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, marginFlatCentsInput: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Surcharge audio %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.surchargeAudioPercentInput}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, surchargeAudioPercentInput: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Surcharge upscale %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.surchargeUpscalePercentInput}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        surchargeUpscalePercentInput: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Devise</label>
                  <input
                    value={form.currencyInput}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, currencyInput: event.target.value.toUpperCase() }))
                    }
                    className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary uppercase"
                    maxLength={6}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Compte vendor (optionnel)</label>
                  <input
                    value={form.vendorAccountIdInput}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, vendorAccountIdInput: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-text-primary"
                    placeholder="acct_..."
                  />
                </div>
              </div>
              {formError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {formError}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-text-tertiary">
                  Les pourcentages sont exprimés sur 100 (20 = 20%).
                </div>
                <div className="flex gap-2">
                  {editor.rule?.id && editor.engineId ? (
                    <button
                      type="button"
                      className="rounded border border-rose-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-600 transition hover:bg-rose-50"
                      onClick={() => handleDeleteRule(editor.rule!.id)}
                      disabled={saving}
                    >
                      Supprimer
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="rounded-lg border border-accent/20 bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-accent/90 disabled:opacity-60"
                    disabled={saving}
                  >
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
