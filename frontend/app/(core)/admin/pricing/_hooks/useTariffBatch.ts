'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ManualTariffSelector } from '@maxvideoai/pricing';
import type { TariffBatchOperation, TariffBatchProposal, TariffBatchSummary } from '@/server/pricing-admin/tariff-batches/contract';

const endpoint = '/api/admin/pricing/tariffs/batches';
const storageKey = 'admin.tariff-batch.operation.v1';
type Options = { enabled: boolean; classes: { key: string; selector: ManualTariffSelector }[]; operations: TariffBatchSummary[] };
async function request<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(endpoint + path, { method: payload === undefined ? 'GET' : 'POST', cache: 'no-store',
    ...(payload === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }) });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.message ?? 'Tariff batch request failed.');
  return body;
}
export function useTariffBatch() {
  const [options, setOptions] = useState<Options>({ enabled: false, classes: [], operations: [] });
  const [operation, setOperation] = useState<TariffBatchOperation | null>(null);
  const [recoveryId, setRecoveryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const running = useRef(false), mounted = useRef(true);
  const refreshOptions = useCallback(async () => {
    const result = await request<Options>(''); if (mounted.current) setOptions(result);
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refreshOptions().catch(e => { if (mounted.current) setError(e.message); });
    let id: string | null = null;
    try { id = localStorage.getItem(storageKey); } catch { /* Confirmation checks durable browser storage again. */ }
    if (id) {
      setRecoveryId(id); setUncertain(true);
      void request<{ operation: TariffBatchOperation }>(`/status?operationId=${encodeURIComponent(id)}`).then(result => {
        if (mounted.current) { setOperation(result.operation); setUncertain(false); }
      }, () => { if (mounted.current) setError('Saved operation status is unavailable. Check its status before creating another batch.'); });
    }
    return () => { mounted.current = false; };
  }, [refreshOptions]);
  useEffect(() => {
    if (operation?.status !== 'previewed') return;
    const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer);
  }, [operation?.status]);
  const pending = uncertain || operation?.status === 'accepted';
  async function run(work: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(null);
    try { await work(); } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Batch unavailable.'); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  function remember(id: string) {
    try { localStorage.setItem(storageKey, id); }
    catch { throw new Error(`Cannot retain this operation for recovery. Enable browser storage before confirming. Operation: ${id}`); }
    setRecoveryId(id);
  }
  const preview = (proposal: TariffBatchProposal | unknown) => run(async () => {
    if (pending) return;
    setOperation(null);
    const result = await request<{ operation: TariffBatchOperation }>('/preview', proposal);
    remember(result.operation.id);
    if (mounted.current) { setOperation(result.operation); setNow(Date.now()); }
  });
  const confirm = () => run(async () => {
    if (!operation || operation.status !== 'previewed' || pending || operation.plan.counts.conflict || Date.now() >= Date.parse(operation.expiresAt)) return;
    remember(operation.id);
    setUncertain(true);
    try {
      const result = await request<{ operation: TariffBatchOperation }>('/confirm', { operationId: operation.id, fingerprint: operation.fingerprint });
      if (mounted.current) { setOperation(result.operation); setUncertain(false); }
      void refreshOptions().catch(() => {});
    } catch { throw new Error('Response unavailable. Check the saved operation status; do not confirm a new batch.'); }
  });
  const lookup = (id = recoveryId, reconcile = false) => run(async () => {
    if (!id) return;
    const result = await request<{ operation: TariffBatchOperation }>(reconcile ? '/reconcile' : `/status?operationId=${encodeURIComponent(id)}`,
      reconcile ? { operationId: id } : undefined);
    remember(id);
    if (mounted.current) { setOperation(result.operation); setUncertain(false); setNow(Date.now()); }
  });
  function reset() {
    if (running.current || pending) return;
    setOperation(null); setError(null); setRecoveryId(null);
    try { localStorage.removeItem(storageKey); } catch { /* No new write is sent by resetting a draft. */ }
  }
  return { options, operation, recoveryId, error, busy, pending, uncertain,
    expired: Boolean(operation && now >= Date.parse(operation.expiresAt)), preview, confirm, lookup, reset };
}
