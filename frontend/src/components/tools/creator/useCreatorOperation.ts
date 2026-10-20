'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dispatchAnalyticsEvent } from '@/lib/analytics-client';
import { authFetch } from '@/lib/authFetch';
import type { CreatorOperationInput, CreatorSourceInput } from '@/lib/toolbox/creator-tools';
import { LIVE_PRICING_POLICY_REVISION, PRICING_POLICY_HEADER } from '@/lib/membership-policy';

export const webPricingPolicyHeaders = () => ({ 'Content-Type': 'application/json', [PRICING_POLICY_HEADER]: LIVE_PRICING_POLICY_REVISION });
export type CreatorQuote = { price: { amountCents: number; currency: string }; expiresAt: string; topupRequired?: boolean;breakdown?: {transcription:{amountCents:number;currency:string};mixPreparation:{amountCents:number;currency:string}} };
type Prepared = { sourceSummary?: {kind:'sequence';name:string;revision:number};operationId: string; quote: CreatorQuote; operation?: { profile?: { disclosure?: string } }; exportEstimate?: { amountCents: number; currency: string; included?: boolean } | null };
type SubtitleRecovery = {
  source: CreatorSourceInput['source'] | null;
  settings: {language?:string;keyterms:string[]};
  document?: {id:string;revision:number};
  sequence?: {projectId:string;sequenceId:string;expectedRevision:number};
  sourceMedia?: {readUrl:string|null;thumbnailReadUrl?:string|null;name?:string;durationSec?:number};
};
type CreatorReadContext = {input?:CreatorOperationInput;sourceMedia?:Array<{role:CreatorSourceInput['role'];ref:CreatorSourceInput['source'];segment?:CreatorSourceInput['segment'];readUrl:string|null;thumbnailReadUrl?:string|null;name?:string;durationSec?:number}>};
type OperationReply<Result> = { ok: boolean; operationId: string; status?: string; state?: string; result?: Result | null; error?: { code?: string } | string; retryAfterSeconds?: number; needsAttention?: boolean; retryable?: boolean; subtitle?:SubtitleRecovery } & Partial<Prepared> & CreatorReadContext;
// Stored finalization errors predate structured error codes. Only recognize our exact duration failure;
// never expose arbitrary provider/server error text as interface copy.
function creatorFailureCode(error: OperationReply<unknown>['error']): string {
  const durationError = 'Output duration differs from the selected segment. No audio was cut or looped.';
  return error === durationError || error === `${durationError} The charge was refunded.` ? 'OUTPUT_DURATION_MISMATCH' : 'OPERATION_FAILED';
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function readPrepared(value: Partial<Prepared>): Prepared | null {
  const quote = value.quote;
  return typeof value.operationId === 'string' && uuid.test(value.operationId) && quote && Number.isSafeInteger(quote.price?.amountCents) && quote.price.amountCents >= 0 && /^[A-Z]{3}$/.test(quote.price.currency) && Number.isFinite(Date.parse(quote.expiresAt))
    ? { operationId: value.operationId, quote, operation: value.operation, exportEstimate: value.exportEstimate,sourceSummary:value.sourceSummary } : null;
}

/** A confirmation always refers to the same server snapshot, including after transport failure. */
export function useCreatorOperation<Result = unknown>({ userId, toolId, family, executionEnabled = true, initialOperationId, resumeStored = true, recoveryScope }: { userId?: string; toolId: string; family: 'creator' | 'subtitles';executionEnabled?:boolean;initialOperationId?:string;resumeStored?:boolean;recoveryScope?:string }) {
  const context = recoveryScope ?? (initialOperationId ? JSON.stringify(['operation',initialOperationId]) : undefined);
  const base = `/api/tools/${family}`, storageKey = `creator:operation:${userId ?? 'guest'}:${toolId}${context ? `:${encodeURIComponent(context)}` : ''}`;
  const [prepared, setPrepared] = useState<Prepared | null>(null), [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null), [busy, setBusy] = useState(false), [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null), [needsConfirmation, setNeedsConfirmation] = useState(false), [expired, setExpired] = useState(false);
  const [sourceSummary,setSourceSummary] = useState<Prepared['sourceSummary']>();
  const [subtitle,setSubtitle] = useState<SubtitleRecovery>();
  const [readContext,setReadContext] = useState<CreatorReadContext | null>(null), [readRevision,setReadRevision] = useState(0);
  const preparedRef = useRef<Prepared | null>(null);
  function updatePrepared(value: Prepared | null) { preparedRef.current = value; if(value?.sourceSummary)setSourceSummary(value.sourceSummary); setPrepared(value); }
  const observedWork = useRef(new Set<string>());
  const lastOperationId = useRef<string | null>(null);
  const active = useRef(true), locked = useRef(false), paid = useRef(false), epoch = useRef(0);
  const [needsAttention,setNeedsAttention] = useState(false);
  const submittedHere = useRef(new Set<string>()), reported = useRef(new Set<string>());
  const report = useCallback((event: 'tool_start'|'tool_complete', operationId: string, hasResult = false) => {
    const key = `${storageKey}:metric:${event}:${operationId}`;
    if (reported.current.has(key)) return;
    reported.current.add(key);
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key,'1'); } catch { /* In-memory deduplication still applies. */ }
    dispatchAnalyticsEvent(event,{route_family:'app_tools',tool_name:(toolId === 'subtitles-export' ? 'subtitles' : toolId).replace(/-/g,'_'),tool_surface:'workspace',logged_in:true,...event === 'tool_complete' ? {result_count:hasResult ? 1 : 0} : {}});
  },[storageKey,toolId]);
  const [pollRevision, setPollRevision] = useState(0);
  const forget = () => { try { sessionStorage.removeItem(storageKey); } catch { /* Browser persistence is optional. */ } };
  useEffect(() => { active.current = true; return () => { active.current = false; epoch.current += 1; }; }, []);
  useEffect(() => {
    if (!userId) return;
    if (resumeStored) try {
      const stored = readPrepared(JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') ?? {});
      if (stored) { observedWork.current.add(stored.operationId); lastOperationId.current = stored.operationId; updatePrepared(stored); setPending(stored.operationId); setRunning(true); paid.current = true; return; }
    } catch { /* Malformed or unavailable browser storage is not execution authority. */ }
    if (initialOperationId && uuid.test(initialOperationId)) {lastOperationId.current = initialOperationId;setPending(initialOperationId);setRunning(true);paid.current = true;}
  }, [storageKey, userId, initialOperationId, resumeStored]);
  useEffect(() => {
    if (!prepared) { setExpired(false); return; }
    const delay = Date.parse(prepared.quote.expiresAt) - Date.now();
    setExpired(delay <= 0);
    if (delay <= 0) return;
    const timer = setTimeout(() => setExpired(true), Math.min(delay, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [prepared]);
  useEffect(() => {
    if (!pending || !userId) return;
    let cancelled = false, timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await authFetch(`${base}/operations/${encodeURIComponent(pending!)}`, { signal: controller.signal });
        const data = await response.json() as OperationReply<Result>;
        if (cancelled) return;
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          setError('OPERATION_UNAVAILABLE'); setRunning(false); setPending(null); paid.current = false; updatePrepared(null);
          try { sessionStorage.removeItem(storageKey); } catch { /* Optional storage. */ }
          return;
        }
        if (!response.ok || !data.ok || data.operationId !== pending) throw new Error('STATUS_UNAVAILABLE');
        const state = data.status ?? data.state;
        if (data.input && data.sourceMedia) setReadContext({input:data.input,sourceMedia:data.sourceMedia});
        if(data.sourceSummary)setSourceSummary(data.sourceSummary);
        setNeedsAttention(data.needsAttention === true || data.retryable === false);
        if (!['prepared','failed','completed'].includes(state ?? '')) observedWork.current.add(pending!);
        if (state !== 'prepared' && state !== 'failed' && submittedHere.current.has(pending!)) report('tool_start',pending!);
        if (state === 'completed' && (submittedHere.current.has(pending!) || observedWork.current.has(pending!))) report('tool_complete',pending!,Boolean(data.result));
        if (state === 'completed' || state === 'failed') {
          setReadRevision(value => value + 1); setResult(state === 'completed' ? data.result ?? null : null); setError(state === 'failed' ? creatorFailureCode(data.error) : null);
          setRunning(false); setPending(null); setNeedsConfirmation(false); updatePrepared(null); paid.current = false;
          if (state === 'failed') try { sessionStorage.removeItem(storageKey); } catch { /* Optional storage. */ }
          return;
        }
        setError(null);
        if (data.needsAttention || data.retryable === false) { setNeedsConfirmation(false); return; }
        if (state === 'prepared') {
          const recovered = readPrepared(data);
          if (!recovered) throw new Error('STATUS_UNAVAILABLE');
          setSubtitle(data.subtitle);
          updatePrepared(recovered); setNeedsConfirmation(true); setRunning(false); setPending(null); paid.current = false;
          return;
        }
        setNeedsConfirmation(false);
        timer = setTimeout(() => void poll(), Math.min(30, Math.max(2, data.retryAfterSeconds ?? 5)) * 1000);
      } catch {
        if (cancelled) return;
        setError('STATUS_UNAVAILABLE'); timer = setTimeout(() => void poll(), 5000);
      }
    }
    void poll();
    return () => { cancelled = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [base, pending, pollRevision, storageKey, userId, report]);
  function invalidate() {
    if (paid.current) return;
    epoch.current += 1; setReadContext(null); setSourceSummary(undefined); setSubtitle(undefined); setNeedsAttention(false); setNeedsConfirmation(false); lastOperationId.current = null; updatePrepared(null); setError(null); setResult(null); forget();
  }
  async function prepare(input: unknown, path = '/prepare') {
    if (!executionEnabled || !userId || locked.current || paid.current) return;
    const attempt = ++epoch.current;
    locked.current = true; setBusy(true); setError(null); setNeedsConfirmation(false); updatePrepared(null);
    try {
      const response = await authFetch(`${base}${path}`, { method: 'POST', headers: webPricingPolicyHeaders(), body: JSON.stringify(input) });
      const data = await response.json() as OperationReply<Result>;
      if (!active.current || epoch.current !== attempt) return;
      const next = readPrepared(data);
      if (!response.ok || !data.ok || !next) throw new Error(typeof data.error === 'object' ? data.error?.code : 'QUOTE_UNAVAILABLE');
      updatePrepared(next);
    } catch (failure) { if (active.current && epoch.current === attempt) setError(failure instanceof Error ? failure.message : 'QUOTE_UNAVAILABLE'); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  async function confirm() {
    const snapshot = preparedRef.current;
    if (!executionEnabled || !userId || !snapshot || locked.current || Date.parse(snapshot.quote.expiresAt) <= Date.now() || snapshot.quote.topupRequired) return; lastOperationId.current = snapshot.operationId;
    submittedHere.current.add(snapshot.operationId);
    locked.current = true; paid.current = true; setBusy(true); setRunning(true); setError(null); setNeedsConfirmation(false);
    try { sessionStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch { /* Server job identity still survives in memory. */ }
    try {
      const response = await authFetch(`${base}/confirm`, { method: 'POST', headers: webPricingPolicyHeaders(), body: JSON.stringify({ operationId: snapshot.operationId, confirmed: true }) });
      const data = await response.json() as OperationReply<Result>;
      if (!active.current) return;
      const code = typeof data.error === 'object' ? data.error?.code : undefined;
      const rejected = ['INSUFFICIENT_FUNDS','CURRENCY_MISMATCH','QUOTE_EXPIRED','SUBTITLE_QUOTE_EXPIRED','PRICING_POLICY_OUTDATED'].includes(code ?? '');
      if (!response.ok && (rejected || [401,403,404].includes(response.status))) {
        paid.current = false; setRunning(false); setPending(null); updatePrepared(null); forget();
        setError(typeof data.error === 'object' ? data.error?.code ?? 'CONFIRMATION_FAILED' : 'CONFIRMATION_FAILED'); return;
      }
      // Read the authoritative status for both accepted and ambiguous confirmation responses.
      setPending(snapshot.operationId); setPollRevision(value => value + 1);
    } catch { if (active.current) { setPending(snapshot.operationId); setPollRevision(value => value + 1); setError('STATUS_UNAVAILABLE'); } }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  return { quote: prepared?.quote ?? null, sourceSummary, subtitle, disclosure: prepared?.operation?.profile?.disclosure, exportEstimate: prepared?.exportEstimate,
    result, readContext, readRevision, busy, running, error, needsConfirmation, needsAttention, expired, invalidate, prepare, confirm,
    retry: () => { if (!lastOperationId.current) return; paid.current = true; setRunning(true); setPending(lastOperationId.current); setPollRevision(value => value + 1); },
    discardExpired: () => { if (!expired || !needsConfirmation || locked.current) return; paid.current = false; setRunning(false); setPending(null); setNeedsConfirmation(false); invalidate(); },
    reset: () => { if (paid.current || locked.current) return; invalidate(); setResult(null); },
  };
}
