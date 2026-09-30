'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import type { PricingChangeEvent } from '@/lib/admin/pricing-change-contract';
import type { CustomerTariffChangePreview, CustomerTariffInventory, CustomerTariffScenarioDetail,
  CustomerTariffChangeProposal, CustomerTariffChangeConfirmation } from '@/server/pricing-admin/customer-tariff-contract';
import type { TariffEditorSelection } from '../_lib/tariff-editor-selection';

const INVENTORY_URL = '/api/admin/pricing/tariffs/inventory';

async function read<T>(url: string, field: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.message ?? 'Could not load customer pricing.');
  return body[field];
}

async function post<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.message ?? 'Customer tariff request failed.');
  return body as T;
}

const readInventory = (url: string) => read<CustomerTariffInventory>(url, 'inventory');
const readScenario = (url: string) => read<CustomerTariffScenarioDetail>(url, 'scenario');
const readHistory = (url: string) => read<PricingChangeEvent[]>(url, 'events');

/** One exact inline editor; server preview/confirmation remains the only mutation authority. */
export function useCustomerTariffEditor(selection: TariffEditorSelection | null, enabled: boolean,
  onSaved?: () => void | Promise<void>) {
  const [requested, setRequested] = useState(selection?.selector ?? {});
  const [preview, setPreview] = useState<CustomerTariffChangePreview | null>(null);
  const [pendingProposal, setPendingProposal] = useState<CustomerTariffChangeProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  useEffect(() => { if (enabled) setOpened(true); }, [enabled]);
  const { data: inventory, error: inventoryError, isLoading: inventoryLoading, mutate: mutateInventory } =
    useSWR(enabled && selection ? INVENTORY_URL : null, readInventory);
  const modelId = selection?.modelId;
  // Keep previously opened exact scenarios subscribed so global Refresh also updates collapsed rows.
  const scenarioUrl = useMemo(() => (enabled || opened) && modelId
    ? `/api/admin/pricing/tariffs/scenarios?${new URLSearchParams({ modelId, ...requested })}`
    : null, [enabled, opened, modelId, requested]);
  const { data: scenario, error: scenarioError, isLoading: scenarioLoading, mutate: mutateScenario } =
    useSWR(scenarioUrl, readScenario);
  const exact = scenario?.modelId === selection?.modelId ? scenario : null;
  const lastExact = useRef<CustomerTariffScenarioDetail | null>(null);
  if (exact) lastExact.current = exact;
  const displayed = exact ?? lastExact.current;
  const selected = useRef({ url: scenarioUrl, id: exact?.scenarioId });
  selected.current = { url: scenarioUrl, id: exact?.scenarioId };
  const inFlight = useRef(false);
  const previewEpoch = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const editable = Boolean(enabled && !scenarioLoading && !scenarioError && !inventoryError
    && inventory?.databaseStatus === 'loaded' && exact?.supplierComparison.customerQuote != null
    && exact?.currentCents != null && exact.currency === 'USD');
  const historyUrl = enabled && inventory?.databaseStatus === 'loaded' && exact
    ? `/api/admin/pricing/tariffs/history?targetId=${encodeURIComponent(exact.tariffCellId)}` : null;
  const { data: history, error: historyError, mutate: mutateHistory } = useSWR(historyUrl, readHistory);

  const cancelPreview = () => { previewEpoch.current++; setPreview(null); setPendingProposal(null); };
  useEffect(() => { if (!enabled) { previewEpoch.current++; setPreview(null); setPendingProposal(null); } }, [enabled]);
  useEffect(() => {
    previewEpoch.current++; setPreview(null); setPendingProposal(null);
  }, [exact?.scenarioId, exact?.currentCents, exact?.stagedCents, inventory?.revision]);
  const changeOption = (key: string, value: string) => {
    if (inFlight.current || !displayed) return;
    setRequested({ ...displayed.selector, ...requested, [key]: value });
    cancelPreview(); setError(null); setNotice(null);
  };
  const requestPreview = async (customerCents?: number, proposalOverride?: CustomerTariffChangeProposal) => {
    if (!exact || !editable || inFlight.current) return;
    if (!proposalOverride && (customerCents == null || !Number.isSafeInteger(customerCents) || customerCents < 0)) {
      setError('Enter a valid customer price.'); return;
    }
    const proposal = proposalOverride ?? { operation: exact.stagedCents == null ? 'create' : 'update',
      scenarioId: exact.scenarioId, customerCents: customerCents! } as CustomerTariffChangeProposal;
    const requestedScenario = selected.current;
    if (proposal.scenarioId !== exact.scenarioId) return;
    inFlight.current = true; setBusy(true); setError(null); setNotice(null); cancelPreview();
    const requestEpoch = previewEpoch.current;
    try {
      const result = await post<{ preview: CustomerTariffChangePreview }>('/api/admin/pricing/tariffs/preview', proposal);
      if (!mounted.current || previewEpoch.current !== requestEpoch || selected.current.url !== requestedScenario.url
        || selected.current.id !== proposal.scenarioId || result.preview.scenarioId !== proposal.scenarioId) return;
      setPreview(result.preview); setPendingProposal(proposal);
    } catch (caught) {
      if (mounted.current && previewEpoch.current === requestEpoch && selected.current.url === requestedScenario.url
        && selected.current.id === proposal.scenarioId) setError(caught instanceof Error ? caught.message : 'Preview failed.');
    }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  const confirm = async () => {
    if (!preview || !pendingProposal || !editable || inFlight.current
      || pendingProposal.scenarioId !== exact?.scenarioId || preview.scenarioId !== exact.scenarioId) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = await post<{ confirmation: CustomerTariffChangeConfirmation }>('/api/admin/pricing/tariffs/confirm', {
        proposal: pendingProposal, previewFingerprint: preview.fingerprint,
      });
      if (mounted.current) {
        cancelPreview();
        setNotice(inventory?.active ? 'Customer tariff updated.' : 'Prepared price saved. The live customer price has not changed.');
        if (result.confirmation.operationalWarnings.length) setError(result.confirmation.operationalWarnings.join(' '));
      }
      await Promise.all([mutateInventory(), mutateScenario(), mutateHistory()]);
      await onSaved?.();
    } catch (caught) { if (mounted.current) setError(caught instanceof Error ? caught.message : 'Confirmation failed.'); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  };
  return { inventory, exact, displayed, requestedOptions: requested, preview, history, historyError, busy, editable, notice,
    loading: Boolean(enabled && selection && (inventoryLoading || scenarioLoading)),
    error: error ?? (scenarioError ?? inventoryError)?.message ?? null,
    changeOption, cancelPreview, requestPreview, confirm };
}

export type CustomerTariffEditor = ReturnType<typeof useCustomerTariffEditor>;
