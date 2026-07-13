'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import type { PricingChangeEvent, PricingChangePreview } from '@/lib/admin/pricing-change-contract';
import {
  buildPricingPolicyProposal,
  createPricingPolicyDraft,
  filterPricingPolicyRows,
  pricingPolicyProposalSelectorKey,
  pricingPolicyRowKey,
  reconcilePricingPolicySelection,
  type PricingCockpitError,
  type PricingCockpitFilters,
  type PricingConfirmApiResponse,
  type PricingHistoryApiResponse,
  type PricingInventoryApiResponse,
  type PricingPolicyDraft,
  type PricingPolicyProposal,
  type PricingPreviewApiResponse,
} from '../_lib/pricing-cockpit-view-model';

export const PRICING_INVENTORY_ENDPOINT = '/api/admin/pricing/inventory';
export const PRICING_HISTORY_ENDPOINT = '/api/admin/pricing/history?limit=100';
export const PRICING_PREVIEW_ENDPOINT = '/api/admin/pricing/preview';
export const PRICING_CONFIRM_ENDPOINT = '/api/admin/pricing/confirm';

async function apiFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw toCockpitError(body, 'Unable to load pricing policy.');
  return body as T;
}

function toCockpitError(value: unknown, fallback: string): PricingCockpitError {
  if (value && typeof value === 'object') {
    const body = value as { error?: unknown; message?: unknown };
    return {
      code: typeof body.error === 'string' ? body.error : 'request_failed',
      message: typeof body.message === 'string' ? body.message : fallback,
    };
  }
  return { code: 'request_failed', message: fallback };
}

async function postJson<T>(url: string, payload: unknown, fallback: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.ok !== true) throw toCockpitError(body, fallback);
  return body as T;
}

export function useAdminPricingCockpitController() {
  const inventoryQuery = useSWR<PricingInventoryApiResponse>(PRICING_INVENTORY_ENDPOINT, apiFetcher);
  const historyQuery = useSWR<PricingHistoryApiResponse>(PRICING_HISTORY_ENDPOINT, apiFetcher);
  const refreshInventory = inventoryQuery.mutate;
  const refreshHistory = historyQuery.mutate;
  const [filters, setFilterState] = useState<PricingCockpitFilters>({ query: '', source: 'all' });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<PricingPolicyDraft | null>(null);
  const [draftSelectionKey, setDraftSelectionKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<PricingChangePreview | null>(null);
  const [previewProposal, setPreviewProposal] = useState<PricingPolicyProposal | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<PricingCockpitError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const interactionLocked = previewing || confirming || Boolean(preview);

  const inventory = inventoryQuery.data?.ok ? inventoryQuery.data.inventory : null;
  const history = historyQuery.data?.ok ? historyQuery.data.events : [];
  const rows = useMemo(() => inventory?.rows ?? [], [inventory]);
  const filteredRows = useMemo(() => filterPricingPolicyRows(rows, filters), [filters, rows]);
  const selectedRow = useMemo(
    () => filteredRows.find((row) => pricingPolicyRowKey(row) === selectedKey) ?? null,
    [filteredRows, selectedKey]
  );
  const activeDraft = selectedKey === draftSelectionKey ? draft : null;

  useEffect(() => {
    if (interactionLocked) return;
    const nextSelection = reconcilePricingPolicySelection(filteredRows, selectedKey);
    if (nextSelection !== selectedKey) setSelectedKey(nextSelection);
  }, [filteredRows, interactionLocked, selectedKey]);

  useEffect(() => {
    if (!selectedRow || selectedKey === draftSelectionKey) return;
    setDraft(createPricingPolicyDraft(selectedRow));
    setDraftSelectionKey(selectedKey);
  }, [draftSelectionKey, selectedKey, selectedRow]);

  const selectRow = useCallback((key: string) => {
    if (interactionLocked) return;
    setError(null);
    setNotice(null);
    setSelectedKey(key);
  }, [interactionLocked]);
  const setFilters = useCallback((nextFilters: PricingCockpitFilters) => {
    if (interactionLocked) return;
    setFilterState(nextFilters);
  }, [interactionLocked]);
  const updateDraft = useCallback((field: keyof PricingPolicyDraft, value: string) => {
    if (interactionLocked) return;
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setNotice(null);
  }, [interactionLocked]);

  const openPreview = useCallback(async (kind: 'save' | 'delete' = 'save') => {
    if (interactionLocked) return;
    if (!selectedRow || !activeDraft) return;
    setPreviewing(true);
    setError(null);
    setNotice(null);
    try {
      const proposal = kind === 'delete'
        ? { operation: 'delete' as const, targetId: selectedRow.databaseOverride?.id ?? '' }
        : buildPricingPolicyProposal(selectedRow, activeDraft);
      if (proposal.operation === 'delete' && !proposal.targetId) {
        throw new Error('Only database overrides can be deleted.');
      }
      const response = await postJson<PricingPreviewApiResponse>(
        PRICING_PREVIEW_ENDPOINT,
        proposal,
        'Unable to preview this pricing change.'
      );
      if (!response.ok) throw toCockpitError(response, 'Unable to preview this pricing change.');
      setPreviewProposal(proposal);
      setPreview(response.preview);
    } catch (caught) {
      setError(caught && typeof caught === 'object' && 'code' in caught
        ? caught as PricingCockpitError
        : { code: 'invalid_draft', message: caught instanceof Error ? caught.message : 'Invalid pricing draft.' });
    } finally {
      setPreviewing(false);
    }
  }, [activeDraft, interactionLocked, selectedRow]);

  const previewRollback = useCallback((event: PricingChangeEvent) => {
    if (interactionLocked) return;
    void (async () => {
      setPreviewing(true);
      setError(null);
      setNotice(null);
      try {
        const proposal: PricingPolicyProposal = {
          operation: 'rollback', targetId: event.targetId, eventId: event.id,
        };
        const response = await postJson<PricingPreviewApiResponse>(
          PRICING_PREVIEW_ENDPOINT,
          proposal,
          'Unable to preview this pricing rollback.'
        );
        if (!response.ok) throw toCockpitError(response, 'Unable to preview this pricing rollback.');
        setPreviewProposal(proposal);
        setPreview(response.preview);
      } catch (caught) {
        setError(caught && typeof caught === 'object' && 'code' in caught
          ? caught as PricingCockpitError
          : { code: 'request_failed', message: caught instanceof Error ? caught.message : 'Unable to preview rollback.' });
      } finally {
        setPreviewing(false);
      }
    })();
  }, [interactionLocked]);

  const cancelPreview = useCallback(() => {
    if (confirming) return;
    setPreview(null);
    setPreviewProposal(null);
  }, [confirming]);

  const confirmPreview = useCallback(async () => {
    if (!preview || !previewProposal) return;
    const nextSelectionKey = pricingPolicyProposalSelectorKey(previewProposal);
    setConfirming(true);
    setError(null);
    try {
      const response = await postJson<PricingConfirmApiResponse>(
        PRICING_CONFIRM_ENDPOINT,
        { proposal: previewProposal, previewFingerprint: preview.previewFingerprint },
        'Unable to apply this pricing change.'
      );
      if (!response.ok) throw toCockpitError(response, 'Unable to apply this pricing change.');
      const confirmation = response.confirmation;
      if (!confirmation.committed) throw new Error('Pricing change was not committed.');
      setPreview(null);
      setPreviewProposal(null);
      setNotice(
        confirmation.operationalWarnings.length
          ? `Change applied. ${confirmation.operationalWarnings.map((warning) => warning.message).join(' ')}`
          : 'Pricing policy change applied.'
      );
      await Promise.all([refreshInventory(), refreshHistory()]);
      if (nextSelectionKey && nextSelectionKey !== selectedKey) {
        setFilterState({ query: '', source: 'all' });
        setSelectedKey(nextSelectionKey);
      }
      setDraftSelectionKey(null);
    } catch (caught) {
      setError(caught && typeof caught === 'object' && 'code' in caught
        ? caught as PricingCockpitError
        : { code: 'request_failed', message: caught instanceof Error ? caught.message : 'Unable to apply change.' });
    } finally {
      setConfirming(false);
    }
  }, [preview, previewProposal, refreshHistory, refreshInventory, selectedKey]);

  const refresh = useCallback(async () => {
    if (interactionLocked) return;
    setError(null);
    await Promise.all([refreshInventory(), refreshHistory()]);
  }, [interactionLocked, refreshHistory, refreshInventory]);

  const fetchError = inventoryQuery.error
    ? toCockpitError(inventoryQuery.error, 'Unable to load pricing policy.')
    : historyQuery.error
      ? toCockpitError(historyQuery.error, 'Unable to load pricing history.')
      : null;

  return {
    inventory,
    history,
    filters,
    setFilters,
    rows: filteredRows,
    selectedKey,
    selectedRow,
    selectRow,
    draft: activeDraft,
    updateDraft,
    preview,
    previewing,
    confirming,
    interactionLocked,
    openPreview,
    previewRollback,
    cancelPreview,
    confirmPreview,
    refresh,
    loading: inventoryQuery.isLoading,
    refreshing: inventoryQuery.isValidating || historyQuery.isValidating,
    error: error ?? fetchError,
    notice,
  };
}
