'use client';

import { Check, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import type { PricingChangeEvent } from '@/lib/admin/pricing-change-contract';
import type { CustomerTariffChangePreview, CustomerTariffInventory,
  CustomerTariffScenarioDetail, CustomerTariffChangeProposal, CustomerTariffChangeConfirmation } from '@/server/pricing-admin/customer-tariff-contract';

const INVENTORY_URL = '/api/admin/pricing/tariffs/inventory';

async function getInventory(url: string): Promise<CustomerTariffInventory> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.message ?? 'Could not load customer tariffs.');
  return body.inventory;
}

async function getScenario(url: string): Promise<CustomerTariffScenarioDetail> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.message ?? 'Could not load this tariff scenario.');
  return body.scenario;
}

async function getHistory(url: string): Promise<PricingChangeEvent[]> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.message ?? 'Could not load tariff history.');
  return body.events;
}

async function post<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.message ?? 'Customer tariff request failed.');
  return body as T;
}

function money(cents: number | null): string {
  return cents == null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function supplierMoney(usd: number | null): string {
  return usd == null ? 'Unconfirmed' : new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6,
  }).format(usd);
}

function title(modelId: string): string {
  return modelId.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

const SCENARIO_LABELS: Record<string, string> = {
  mode: 'Generation mode', resolution: 'Resolution', durationSec: 'Duration (seconds)',
  aspectRatio: 'Aspect ratio', audio: 'Audio', quality: 'Quality', inputImageCount: 'Input images',
  inputVideoDurationSec: 'Input video (seconds)', inheritedDurationSec: 'Inherited video (seconds)',
  inputAudioDurationSec: 'Input audio (seconds)', referenceTokenBudget: 'Reference tokens',
};

function scenarioValue(key: string, value: string): string {
  if (key === 'audio') return value === 'true' ? 'With audio' : 'Silent';
  return value || 'Default';
}

function parseDollars(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function CustomerTariffPanel() {
  const { data, error: loadError, isLoading, mutate } = useSWR(INVENTORY_URL, getInventory);
  const [family, setFamily] = useState('all');
  const [media, setMedia] = useState<'all' | 'video' | 'image'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requested, setRequested] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState<CustomerTariffChangePreview | null>(null);
  const [pendingProposal, setPendingProposal] = useState<CustomerTariffChangeProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const families = useMemo(() => [...new Set(data?.rows.map((row) => row.familyId) ?? [])].sort(), [data]);
  const visible = useMemo(() => (data?.rows ?? []).filter((row) =>
    (family === 'all' || row.familyId === family) &&
    (media === 'all' || row.mediaType === media) &&
    (!query.trim() || `${row.modelId} ${row.familyId}`.toLowerCase().includes(query.trim().toLowerCase()))
  ), [data, family, media, query]);
  const selected = data?.rows.find((row) => row.modelId === selectedId) ?? null;
  const scenarioUrl = useMemo(() => {
    if (!selectedId) return null;
    const params = new URLSearchParams({ modelId: selectedId, ...requested });
    return `/api/admin/pricing/tariffs/scenarios?${params}`;
  }, [selectedId, requested]);
  const { data: scenario, error: scenarioError, isLoading: scenarioLoading, mutate: mutateScenario } =
    useSWR(scenarioUrl, getScenario);
  const exact = scenario?.modelId === selectedId ? scenario : null;
  const exactScenarioId = exact?.scenarioId;
  const exactStagedCents = exact?.stagedCents;
  const exactCurrentCents = exact?.currentCents;
  const editable = data?.databaseStatus === 'loaded' && exact?.currentCents != null;
  const historyUrl = data?.databaseStatus === 'loaded' && exact
    ? `/api/admin/pricing/tariffs/history?targetId=${encodeURIComponent(exact.tariffCellId)}` : null;
  const { data: history, mutate: mutateHistory } = useSWR(historyUrl, getHistory);

  useEffect(() => {
    if (!exactScenarioId) return;
    setDraft(exactStagedCents != null ? (exactStagedCents / 100).toFixed(2)
      : exactCurrentCents != null ? (exactCurrentCents / 100).toFixed(2) : '');
    setPreview(null);
    setPendingProposal(null);
  }, [exactScenarioId, exactStagedCents, exactCurrentCents]);

  const select = (modelId: string) => {
    if (busy) return;
    const row = data?.rows.find((item) => item.modelId === modelId);
    setSelectedId(modelId);
    setRequested(row?.selector ?? {});
    setDraft(row?.stagedCents != null ? (row.stagedCents / 100).toFixed(2)
      : row?.currentCents != null ? (row.currentCents / 100).toFixed(2) : '');
    setPreview(null);
    setError(null);
    setNotice(null);
  };

  const requestPreview = async (requestedProposal?: CustomerTariffChangeProposal) => {
    if (!exact || !editable) return;
    const cents = parseDollars(draft);
    if (!requestedProposal && cents == null) { setError('Enter a USD amount with at most two decimals.'); return; }
    const proposal = requestedProposal ?? { operation: exact.stagedCents == null ? 'create' : 'update',
      scenarioId: exact.scenarioId, customerCents: cents! } as CustomerTariffChangeProposal;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await post<{ preview: CustomerTariffChangePreview }>(
        '/api/admin/pricing/tariffs/preview', proposal,
      );
      setPreview(result.preview);
      setPendingProposal(proposal);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Preview failed.'); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!preview || !pendingProposal) return;
    setBusy(true); setError(null);
    try {
      const result = await post<{ confirmation: CustomerTariffChangeConfirmation }>('/api/admin/pricing/tariffs/confirm', {
        proposal: pendingProposal, previewFingerprint: preview.fingerprint,
      });
      setPreview(null);
      setPendingProposal(null);
      setNotice(data?.active ? 'Customer tariff updated.' : 'Manual tariff saved as a staged value. The live customer price has not changed.');
      if (result.confirmation.operationalWarnings.length) setError(result.confirmation.operationalWarnings.join(' '));
      await mutate();
      await mutateScenario();
      await mutateHistory();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Confirmation failed.'); }
    finally { setBusy(false); }
  };

  if (isLoading) return <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-secondary">Loading customer tariffs…</div>;
  if (loadError || !data) return <AdminNotice tone="error">{loadError instanceof Error ? loadError.message : 'Customer tariff inventory unavailable.'}</AdminNotice>;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-xs uppercase tracking-wide text-text-secondary">Models</p><p className="mt-1 text-2xl font-bold text-text-primary">{data.rows.length}</p><p className="text-xs text-text-muted">{families.length} families</p></div>
      <div className="rounded-2xl border border-[#cbb9ff] bg-[#f1ebff] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#5937b8]">Customer tariffs</p><p className="mt-1 text-xl font-bold text-text-primary">{data.active ? 'Live' : 'Preparing'}</p><p className="text-xs text-text-secondary">Revision {data.revision ?? 'unavailable'}</p></div>
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Coverage to review</p><p className="mt-1 text-2xl font-bold text-text-primary">{data.coverageGapCount}</p><p className="text-xs text-text-secondary">Open or media-dependent options</p></div>
    </div>
    {data.databaseStatus === 'unavailable' ? <AdminNotice tone="warning">The tariff store is unavailable in this environment. Current customer quotes are visible; saving a manual tariff is disabled.</AdminNotice> : null}
    {!data.active ? <AdminNotice tone="warning">Current customer totals are live. Prepared manual prices are saved separately until complete parity and coverage are verified.</AdminNotice> : null}
    {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
    {notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}
    <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <label className="flex items-center gap-2 rounded-lg border border-border px-3"><Search className="h-4 w-4 text-text-secondary" aria-hidden="true" /><input aria-label="Search models" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models…" className="min-h-10 w-full bg-transparent text-sm outline-none" /></label>
      <select aria-label="Model family" value={family} onChange={(event) => setFamily(event.target.value)} className="min-h-10 rounded-lg border border-border bg-bg px-3 text-sm"><option value="all">All families</option>{families.map((item) => <option key={item} value={item}>{title(item)}</option>)}</select>
      <select aria-label="Media type" value={media} onChange={(event) => setMedia(event.target.value as typeof media)} className="min-h-10 rounded-lg border border-border bg-bg px-3 text-sm"><option value="all">Video and image</option><option value="video">Video</option><option value="image">Image</option></select>
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
      <div className="space-y-2" aria-label="Model customer tariffs">{visible.length ? visible.map((row) =>
        <button key={row.modelId} type="button" onClick={() => select(row.modelId)}
          aria-pressed={selectedId === row.modelId}
          className={`grid w-full gap-3 rounded-xl border p-3 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_minmax(100px,0.55fr)_minmax(100px,0.55fr)] ${selectedId === row.modelId ? 'border-brand bg-[#f7f3ff]' : 'border-border bg-surface hover:border-brand/50'}`}>
          <span className="min-w-0"><strong className="block truncate text-sm text-text-primary">{title(row.modelId)}</strong><span className="text-xs text-text-secondary">{title(row.familyId)} · {row.selector.mode} · {row.selector.durationSec}s · {row.selector.resolution}</span></span>
          <span className="rounded-lg border border-info-border bg-info-bg p-2"><span className="block text-[10px] font-bold uppercase text-info">Supplier list</span><strong className="text-sm text-text-primary">{supplierMoney(row.supplierListUsd)}</strong></span>
          <span className="rounded-lg border border-[#cbb9ff] bg-[#f1ebff] p-2"><span className="block text-[10px] font-bold uppercase text-[#5937b8]">Customer live</span><strong className="text-sm text-text-primary">{money(row.currentCents)}</strong></span>
        </button>) : <p className="rounded-xl border border-border bg-surface p-5 text-sm text-text-secondary">No models match these filters.</p>}</div>
      <div className="xl:sticky xl:top-4 xl:self-start">{selected ? <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-2"><div><h3 className="text-lg font-bold text-text-primary">{title(selected.modelId)}</h3><p className="text-xs text-text-secondary">Exact scenario for this price</p></div><span className="rounded-full bg-[#f1ebff] px-2 py-1 text-xs font-semibold text-[#5937b8]">{selected.mediaType}</span></div>
        {scenarioError ? <AdminNotice tone="error">{scenarioError instanceof Error ? scenarioError.message : 'Scenario unavailable.'}</AdminNotice> : null}
        {scenarioLoading ? <p className="mt-4 text-sm text-text-secondary">Loading scenario…</p> : null}
        {exact ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{exact.choices.map((choice) => <label key={choice.key} className="text-xs text-text-secondary">{SCENARIO_LABELS[choice.key] ?? title(choice.key)}<select aria-label={SCENARIO_LABELS[choice.key] ?? title(choice.key)} value={choice.value}
          onChange={(event) => { setRequested({ ...exact.selector, [choice.key]: event.target.value }); setPreview(null); setPendingProposal(null); }}
          className="mt-1 min-h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm text-text-primary">
          {choice.options.map((value) => <option key={value} value={value}>{scenarioValue(choice.key, value)}</option>)}
        </select></label>)}</div> : null}
        <div className="mt-5 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-info-border bg-info-bg p-3"><p className="text-xs font-semibold text-info">Supplier list</p><p className="text-xl font-bold">{supplierMoney(exact?.scenarioId === selected.scenarioId ? selected.supplierListUsd : null)}</p><p className="text-xs text-text-secondary">{exact?.scenarioId === selected.scenarioId ? `Account effective: ${supplierMoney(selected.supplierEffectiveUsd)} · invoice: ${supplierMoney(selected.supplierObservedUsd)}` : 'Supplier evidence is only mapped for the comparison scenario.'}</p></div><div className="rounded-xl border border-[#cbb9ff] bg-[#f1ebff] p-3"><p className="text-xs font-semibold text-[#5937b8]">Customer total · live</p><p className="text-xl font-bold">{money(exact?.currentCents ?? null)}</p></div></div>
        <label className="mt-5 block text-sm font-semibold text-text-primary">Manual customer total · USD<input type="number" min="0" step="0.01" inputMode="decimal" value={draft} onChange={(event) => { setDraft(event.target.value); setPreview(null); setPendingProposal(null); }} disabled={!editable || busy} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-base" /></label>
        {exact?.stagedCents != null ? <p className="mt-2 text-xs text-amber-800">Prepared value: {money(exact.stagedCents)}{data.active ? ' · live' : ' · pending global activation'}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2"><AdminActionButton type="button" variant="primary" disabled={!editable || busy || !draft} onClick={() => void requestPreview()}>Preview price change</AdminActionButton>{!data.active && exact?.stagedCents != null ? <AdminActionButton type="button" disabled={!editable || busy} onClick={() => void requestPreview({ operation: 'delete', scenarioId: exact.scenarioId })}>Remove prepared price</AdminActionButton> : null}</div>
        {preview ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="text-sm font-bold text-text-primary">Review this exact price</p><p className="mt-2 text-sm">{money(preview.currentCents)} → <strong>{preview.proposedCents == null ? 'Remove prepared price' : money(preview.proposedCents)}</strong></p>{preview.warnings.map((warning) => <p key={warning} className="mt-2 text-xs text-amber-900">{warning}</p>)}<div className="mt-4 flex gap-2"><AdminActionButton type="button" variant="primary" disabled={busy} onClick={() => void confirm()}><Check className="mr-1 h-4 w-4" /> Confirm</AdminActionButton><AdminActionButton type="button" disabled={busy} onClick={() => { setPreview(null); setPendingProposal(null); }}>Cancel</AdminActionButton></div></div> : null}
        {history?.length ? <div className="mt-5 border-t border-border pt-4"><h4 className="text-sm font-semibold text-text-primary">Tariff history</h4><div className="mt-2 space-y-2">{history.slice(0, 5).map((event) => <div key={event.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-xs"><span>{event.operation} · {new Date(event.createdAt).toLocaleString()}</span><AdminActionButton type="button" disabled={!editable || busy} onClick={() => void requestPreview({ operation: 'rollback', scenarioId: exact!.scenarioId, eventId: event.id })}>Preview rollback</AdminActionButton></div>)}</div></div> : null}
      </section> : <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-secondary">Select a model to inspect its scenario and prepare a customer price.</div>}</div>
    </div>
  </div>;
}
