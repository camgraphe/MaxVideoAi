'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';

import type { PricingChangeEvent, PricingChangePreview } from '@/lib/admin/pricing-change-contract';
import {
  buildMembershipProposal,
  createMembershipDraft,
  updateMembershipDraft,
  type MembershipAdminError,
  type MembershipChangeProposal,
  type MembershipConfirmApiResponse,
  type MembershipHistoryApiResponse,
  type MembershipInventoryApiResponse,
  type MembershipPreviewApiResponse,
  type MembershipTierDraft,
  type MembershipTierName,
} from '../_lib/membership-admin-view-model';

export const MEMBERSHIP_INVENTORY_ENDPOINT = '/api/admin/membership';
export const MEMBERSHIP_HISTORY_ENDPOINT = '/api/admin/membership/history?limit=100';
export const MEMBERSHIP_PREVIEW_ENDPOINT = '/api/admin/membership/preview';
export const MEMBERSHIP_CONFIRM_ENDPOINT = '/api/admin/membership/confirm';

function toMembershipError(value: unknown, fallback: string): MembershipAdminError {
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
  if (!response.ok || !body) throw toMembershipError(body, 'Unable to load membership pricing.');
  return body as T;
}

async function postJson<T>(url: string, payload: unknown, fallback: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.ok !== true) throw toMembershipError(body, fallback);
  return body as T;
}

export function useAdminMembershipController() {
  const inventoryQuery = useSWR<MembershipInventoryApiResponse>(MEMBERSHIP_INVENTORY_ENDPOINT, apiFetcher);
  const historyQuery = useSWR<MembershipHistoryApiResponse>(MEMBERSHIP_HISTORY_ENDPOINT, apiFetcher);
  const refreshInventory = inventoryQuery.mutate;
  const refreshHistory = historyQuery.mutate;
  const [draft, setDraft] = useState<MembershipTierDraft[]>([]);
  const [preview, setPreview] = useState<PricingChangePreview | null>(null);
  const [previewProposal, setPreviewProposal] = useState<MembershipChangeProposal | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<MembershipAdminError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const interactionLocked = previewing || confirming || Boolean(preview);
  const inventory = inventoryQuery.data?.ok ? inventoryQuery.data.inventory : null;
  const history = historyQuery.data?.ok ? historyQuery.data.events : [];

  useEffect(() => {
    if (!inventory || interactionLocked) return;
    setDraft((current) => current.length ? current : createMembershipDraft(inventory.tiers));
  }, [interactionLocked, inventory]);

  const updateDraft = useCallback((
    tier: MembershipTierName,
    field: 'spendThresholdCents' | 'discountPercent',
    value: string
  ) => {
    if (interactionLocked) return;
    setDraft((current) => updateMembershipDraft(current, tier, field, value));
    setNotice(null);
  }, [interactionLocked]);

  const requestPreview = useCallback(async (proposal: MembershipChangeProposal) => {
    if (interactionLocked) return;
    setPreviewing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await postJson<MembershipPreviewApiResponse>(MEMBERSHIP_PREVIEW_ENDPOINT, proposal, 'Unable to preview membership change.');
      setPreviewProposal(proposal);
      setPreview(response.preview);
    } catch (caught) {
      setError(caught && typeof caught === 'object' && 'code' in caught
        ? caught as MembershipAdminError
        : { code: 'invalid_draft', message: caught instanceof Error ? caught.message : 'Invalid membership draft.' });
    } finally {
      setPreviewing(false);
    }
  }, [interactionLocked]);

  const previewDraft = useCallback(() => {
    try {
      void requestPreview(buildMembershipProposal(draft));
    } catch (caught) {
      setError({ code: 'invalid_draft', message: caught instanceof Error ? caught.message : 'Invalid membership draft.' });
    }
  }, [draft, requestPreview]);

  const previewRollback = useCallback((event: PricingChangeEvent) => {
    void requestPreview({ operation: 'rollback', targetId: event.targetId, eventId: event.id });
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
    try {
      const response = await postJson<MembershipConfirmApiResponse>(MEMBERSHIP_CONFIRM_ENDPOINT, { proposal: previewProposal, previewFingerprint: preview.previewFingerprint }, 'Unable to apply membership change.');
      const confirmation = response.confirmation;
      if (!confirmation.committed) throw new Error('Membership change was not committed.');
      setPreview(null);
      setPreviewProposal(null);
      setDraft([]);
      setNotice(confirmation.operationalWarnings.length
        ? `Membership change applied. ${confirmation.operationalWarnings.map((warning) => warning.message).join(' ')}`
        : 'Membership change applied.');
      await Promise.all([refreshInventory(), refreshHistory()]);
    } catch (caught) {
      setError(caught && typeof caught === 'object' && 'code' in caught
        ? caught as MembershipAdminError
        : { code: 'request_failed', message: caught instanceof Error ? caught.message : 'Unable to apply membership change.' });
    } finally {
      setConfirming(false);
    }
  }, [preview, previewProposal, refreshHistory, refreshInventory]);

  const refresh = useCallback(async () => {
    if (interactionLocked) return;
    setError(null);
    try {
      const [refreshedInventory] = await Promise.all([refreshInventory(), refreshHistory()]);
      if (refreshedInventory?.ok) {
        setDraft(createMembershipDraft(refreshedInventory.inventory.tiers));
      }
    } catch (caught) {
      setError(toMembershipError(caught, 'Unable to refresh membership pricing.'));
    }
  }, [interactionLocked, refreshHistory, refreshInventory]);

  const fetchError = inventoryQuery.error
    ? toMembershipError(inventoryQuery.error, 'Unable to load membership pricing.')
    : historyQuery.error
      ? toMembershipError(historyQuery.error, 'Unable to load membership history.')
      : null;

  return {
    inventory,
    history,
    draft,
    preview,
    previewing,
    confirming,
    interactionLocked,
    loading: inventoryQuery.isLoading,
    historyLoading: historyQuery.isLoading,
    refreshing: inventoryQuery.isValidating || historyQuery.isValidating,
    error: error ?? fetchError,
    notice,
    updateDraft,
    previewDraft,
    previewRollback,
    cancelPreview,
    confirmPreview,
    refresh,
  };
}
