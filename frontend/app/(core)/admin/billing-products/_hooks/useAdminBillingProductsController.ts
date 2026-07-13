'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import type { PricingChangePreview } from '@/lib/admin/pricing-change-contract';
import {
  buildBillingProductProposal,
  createBillingProductDraft,
  filterBillingProducts,
  type BillingProductAdminError,
  type BillingProductChangeProposal,
  type BillingProductConfirmApiResponse,
  type BillingProductDraft,
  type BillingProductHistoryApiResponse,
  type BillingProductInventoryApiResponse,
  type BillingProductOperationalWarning,
  type BillingProductPreviewApiResponse,
} from '../_lib/billing-products-admin-view-model';

export const BILLING_PRODUCTS_INVENTORY_ENDPOINT = '/api/admin/billing-products';
export const BILLING_PRODUCTS_HISTORY_ENDPOINT = '/api/admin/billing-products/history?limit=100';
export const BILLING_PRODUCTS_PREVIEW_ENDPOINT = '/api/admin/billing-products/preview';
export const BILLING_PRODUCTS_CONFIRM_ENDPOINT = '/api/admin/billing-products/confirm';

function toBillingProductError(value: unknown, fallback: string): BillingProductAdminError {
  if (value && typeof value === 'object') {
    const body = value as { error?: unknown; message?: unknown };
    return {
      code: typeof body.error === 'string' ? body.error : 'request_failed',
      message: typeof body.message === 'string' ? body.message : fallback,
    };
  }
  return { code: 'request_failed', message: fallback };
}

async function apiFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw toBillingProductError(body, 'Unable to load billing products.');
  return body as T;
}

async function postJson<T>(url: string, payload: unknown, fallback: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.ok !== true) throw toBillingProductError(body, fallback);
  return body as T;
}

export function useAdminBillingProductsController() {
  const inventoryQuery = useSWR<BillingProductInventoryApiResponse>(BILLING_PRODUCTS_INVENTORY_ENDPOINT, apiFetcher);
  const historyQuery = useSWR<BillingProductHistoryApiResponse>(BILLING_PRODUCTS_HISTORY_ENDPOINT, apiFetcher);
  const refreshInventory = inventoryQuery.mutate;
  const refreshHistory = historyQuery.mutate;
  const inventory = inventoryQuery.data?.ok ? inventoryQuery.data.inventory : null;
  const history = historyQuery.data?.ok ? historyQuery.data.events : [];
  const [query, setQuery] = useState('');
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<BillingProductDraft | null>(null);
  const [preview, setPreview] = useState<PricingChangePreview | null>(null);
  const [previewProposal, setPreviewProposal] = useState<BillingProductChangeProposal | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<BillingProductAdminError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [postCommitWarning, setPostCommitWarning] = useState<BillingProductOperationalWarning | null>(null);
  const interactionLocked = previewing || confirming || Boolean(preview);
  const products = useMemo(() => inventory?.products ?? [], [inventory]);
  const filteredProducts = useMemo(() => filterBillingProducts(products, query), [products, query]);
  const selectedProduct = products.find((product) => product.productKey === selectedProductKey) ?? null;

  useEffect(() => {
    if (!inventory || interactionLocked || selectedProductKey) return;
    const first = inventory.products[0];
    if (!first) return;
    setSelectedProductKey(first.productKey);
    setDraft(createBillingProductDraft(first));
  }, [interactionLocked, inventory, selectedProductKey]);

  const selectProduct = useCallback((productKey: string) => {
    if (interactionLocked) return;
    const product = products.find((candidate) => candidate.productKey === productKey);
    if (!product) return;
    setSelectedProductKey(productKey);
    setDraft(createBillingProductDraft(product));
    setError(null);
    setNotice(null);
  }, [interactionLocked, products]);

  const updateDraft = useCallback((field: 'label' | 'currency' | 'unitPriceCents', value: string) => {
    if (interactionLocked) return;
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setNotice(null);
  }, [interactionLocked]);

  const updateActive = useCallback((active: boolean) => {
    if (interactionLocked) return;
    setDraft((current) => current ? { ...current, active } : current);
    setNotice(null);
  }, [interactionLocked]);

  const requestPreview = useCallback(async (proposal: BillingProductChangeProposal) => {
    if (interactionLocked) return;
    setPreviewing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await postJson<BillingProductPreviewApiResponse>(BILLING_PRODUCTS_PREVIEW_ENDPOINT, proposal, 'Unable to preview billing product change.');
      setPreviewProposal(proposal);
      setPreview(response.preview);
    } catch (caught) {
      setError(caught && typeof caught === 'object' && 'code' in caught
        ? caught as BillingProductAdminError
        : { code: 'invalid_draft', message: caught instanceof Error ? caught.message : 'Invalid billing product draft.' });
    } finally {
      setPreviewing(false);
    }
  }, [interactionLocked]);

  const previewDraft = useCallback(() => {
    if (!draft) return;
    try {
      void requestPreview(buildBillingProductProposal(draft));
    } catch (caught) {
      setError({ code: 'invalid_draft', message: caught instanceof Error ? caught.message : 'Invalid billing product draft.' });
    }
  }, [draft, requestPreview]);

  const previewRollback = useCallback((eventId: string, productKey: string) => {
    void requestPreview({ operation: 'rollback', productKey, eventId });
  }, [requestPreview]);

  const cancelPreview = useCallback(() => {
    if (confirming) return;
    setPreview(null);
    setPreviewProposal(null);
  }, [confirming]);

  const confirmPreview = useCallback(async () => {
    if (!preview || !previewProposal) return;
    setConfirming(true);
    setError(null);
    setPostCommitWarning(null);
    let confirmation: BillingProductConfirmApiResponse['confirmation'];
    try {
      const response = await postJson<BillingProductConfirmApiResponse>(BILLING_PRODUCTS_CONFIRM_ENDPOINT, { proposal: previewProposal, previewFingerprint: preview.previewFingerprint }, 'Unable to apply billing product change.');
      confirmation = response.confirmation;
      if (!confirmation.committed) throw new Error('Billing product change was not committed.');
    } catch (caught) {
      setError(caught && typeof caught === 'object' && 'code' in caught
        ? caught as BillingProductAdminError
        : { code: 'request_failed', message: caught instanceof Error ? caught.message : 'Unable to apply billing product change.' });
      setConfirming(false);
      return;
    }

    setPreview(null);
    setPreviewProposal(null);
    setDraft(null);
    setSelectedProductKey(null);
    const operationalWarnings = [...confirmation.operationalWarnings];
    try {
      await Promise.all([refreshInventory(), refreshHistory()]);
    } catch {
      const refreshWarning: BillingProductOperationalWarning = {
        code: 'post_commit_refresh_failed',
        message: 'Billing product change was committed, but refreshing the local view failed. Refresh manually before making another change.',
      };
      setPostCommitWarning(refreshWarning);
      operationalWarnings.push(refreshWarning);
    }
    setNotice(operationalWarnings.length
      ? `Billing product change applied. ${operationalWarnings.map((warning) => warning.message).join(' ')}`
      : 'Billing product change applied.');
    setConfirming(false);
  }, [preview, previewProposal, refreshHistory, refreshInventory]);

  const refresh = useCallback(async () => {
    if (interactionLocked) return;
    setError(null);
    try {
      const [refreshedInventory] = await Promise.all([refreshInventory(), refreshHistory()]);
      const first = refreshedInventory?.ok ? refreshedInventory.inventory.products[0] : null;
      setSelectedProductKey(first?.productKey ?? null);
      setDraft(first ? createBillingProductDraft(first) : null);
      setPostCommitWarning(null);
    } catch (caught) {
      setError(toBillingProductError(caught, 'Unable to refresh billing products.'));
    }
  }, [interactionLocked, refreshHistory, refreshInventory]);

  const fetchError = inventoryQuery.error
    ? toBillingProductError(inventoryQuery.error, 'Unable to load billing products.')
    : historyQuery.error
      ? toBillingProductError(historyQuery.error, 'Unable to load billing product history.')
      : null;

  return {
    inventory,
    history,
    filteredProducts,
    selectedProduct,
    selectedProductKey,
    draft,
    query,
    preview,
    previewing,
    confirming,
    interactionLocked,
    loading: inventoryQuery.isLoading,
    refreshing: inventoryQuery.isValidating || historyQuery.isValidating,
    error: error ?? (postCommitWarning ? null : fetchError),
    notice,
    setQuery,
    selectProduct,
    updateDraft,
    updateActive,
    previewDraft,
    previewRollback,
    cancelPreview,
    confirmPreview,
    refresh,
  };
}
