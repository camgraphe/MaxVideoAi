'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { runPreflight, useEngines } from '@/lib/api';
import type { EngineCaps, Mode, Resolution, AspectRatio } from '@/types/engines';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type ReceiptItem = {
  id: number;
  type: string;
  amount_cents: number;
  currency: string;
  description: string | null;
  created_at: string;
  job_id: string | null;
  tax_amount_cents: number | null;
  discount_amount_cents: number | null;
};

export const dynamic = 'force-dynamic';

const GOOGLE_ADS_CONVERSION_TARGET = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID ?? 'AW-992154028/7oDUCMuC9rQbEKyjjNkD';
const GOOGLE_ADS_CONVERSION_CURRENCY = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CURRENCY ?? 'EUR';
const GOOGLE_ADS_CONVERSION_VALUE_ENV = Number(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_VALUE ?? 1);
const GOOGLE_ADS_CONVERSION_VALUE_FALLBACK = Number.isFinite(GOOGLE_ADS_CONVERSION_VALUE_ENV) ? GOOGLE_ADS_CONVERSION_VALUE_ENV : 1;

export default function BillingPage() {
  const { data, error } = useEngines();
  const engines = useMemo(() => data?.engines ?? [], [data]);
  const { session, loading: authLoading } = useRequireAuth();

  const [engineId, setEngineId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('t2v');
  const [durationSec, setDurationSec] = useState<number>(4);
  const [resolution, setResolution] = useState<Resolution>('1080p' as Resolution);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [estimate, setEstimate] = useState<{ total?: number; currency?: string; messages?: string[] } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const selected = useMemo<EngineCaps | null>(() => engines.find((e) => e.id === engineId) ?? engines[0] ?? null, [engines, engineId]);

  useEffect(() => {
    if (!selected) return;
    setEngineId((current) => current ?? selected.id);
    setMode((current) => (selected.modes.includes(current) ? current : selected.modes[0]));
    setDurationSec((current) => Math.min(selected.maxDurationSec, current ?? Math.min(8, selected.maxDurationSec)));
    setResolution((current) => (current && selected.resolutions.includes(current) ? current : (selected.resolutions[0] || '1080p') as Resolution));
    setAspectRatio((current) => (current && selected.aspectRatios.includes(current) ? current : (selected.aspectRatios[0] || '16:9') as AspectRatio));
  }, [selected]);

  useEffect(() => {
    let canceled = false;
    async function fetchEstimate() {
      if (!selected) return;
      setEstimating(true);
      try {
        const res = await runPreflight({
          engine: selected.id,
          mode,
          durationSec,
          resolution,
          aspectRatio,
          fps: selected.fps[0],
          user: { memberTier: 'Plus' },
        });
        if (!canceled) setEstimate({ total: res.total, currency: res.currency, messages: res.messages });
      } catch {
        if (!canceled) setEstimate({ total: undefined, currency: 'USD', messages: ['Estimator failed'] });
      } finally {
        if (!canceled) setEstimating(false);
      }
    }
    fetchEstimate();
    return () => {
      canceled = true;
    };
  }, [selected, mode, durationSec, resolution, aspectRatio]);

  const [wallet, setWallet] = useState<{ balance: number; currency: string } | null>(null);
  const [member, setMember] = useState<{ tier: string; savingsPct: number; spent30?: number } | null>(null);
  const [stripeMode, setStripeMode] = useState<'test' | 'live' | 'disabled'>('disabled');
  const [toast, setToast] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<{
    items: ReceiptItem[];
    nextCursor: string | null;
    loading: boolean;
    error?: string | null;
  }>({ items: [], nextCursor: null, loading: false });
  const conversionSentRef = useRef(false);

  const triggerGoogleAdsConversion = (value?: number, currency?: string) => {
    if (typeof window === 'undefined') return;
    if (!GOOGLE_ADS_CONVERSION_TARGET) return;
    if (conversionSentRef.current) return;
    conversionSentRef.current = true;

    const normalizedValue = typeof value === 'number' && Number.isFinite(value) ? value : GOOGLE_ADS_CONVERSION_VALUE_FALLBACK;
    const payload = {
      send_to: GOOGLE_ADS_CONVERSION_TARGET,
      value: normalizedValue,
      currency: currency ?? GOOGLE_ADS_CONVERSION_CURRENCY,
    };

    const dispatch = (attempt: number) => {
      const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', payload);
        return;
      }
      if (attempt >= 20) return;
      window.setTimeout(() => dispatch(attempt + 1), 200);
    };

    dispatch(0);
  };

  useEffect(() => {
    if (authLoading || !session) return;

    let mounted = true;
    async function load() {
      const token = session?.access_token ?? null;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      fetch('/api/wallet', { headers })
        .then((r) => r.json())
        .then((d) => mounted && setWallet(d))
        .catch(() => mounted && setWallet({ balance: 0, currency: 'USD' }));
      fetch('/api/member-status', { headers })
        .then((r) => r.json())
        .then((d) => mounted && setMember(d))
        .catch(() => mounted && setMember({ tier: 'Member', savingsPct: 0 }));

      // Load receipts first page
      setReceipts((s) => ({ ...s, loading: true, error: null }));
      fetch('/api/receipts?limit=25', { headers })
        .then((r) => r.json())
        .then((d) => mounted && setReceipts({ items: (d.receipts ?? []) as ReceiptItem[], nextCursor: d.nextCursor ?? null, loading: false }))
        .catch(() => mounted && setReceipts({ items: [], nextCursor: null, loading: false, error: 'Failed to load receipts' }));
    }
    load();
    return () => {
      mounted = false;
    };
  }, [authLoading, session]);

  // Detect Stripe mode for badge
  useEffect(() => {
    let mounted = true;
    fetch('/api/stripe-mode')
      .then((r) => r.json())
      .then((d) => mounted && setStripeMode(d.mode ?? 'disabled'))
      .catch(() => mounted && setStripeMode('disabled'));
    return () => {
      mounted = false;
    };
  }, []);

  // Show toast on return from Checkout
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const url = new URL(window.location.href);
    const status = url.searchParams.get('status');
    const amountParam = url.searchParams.get('amount');
    const currencyParam = url.searchParams.get('currency');
    if (!status) return undefined;
    const message = status === 'success' ? 'Payment successful. Funds added to your wallet.' : status === 'cancelled' ? 'Payment cancelled. No charges applied.' : null;
    if (message) {
      setToast(message);
      const timeout = window.setTimeout(() => setToast(null), 4000);
      if (status === 'success') {
        const value = amountParam ? Number(amountParam) : undefined;
        triggerGoogleAdsConversion(value, currencyParam ?? undefined);
      }
      if (status) {
        url.searchParams.delete('status');
        if (amountParam) url.searchParams.delete('amount');
        if (currencyParam) url.searchParams.delete('currency');
        window.history.replaceState({}, '', url.toString());
      }
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, []);

  async function handleTopUp(amountCents: number) {
    const token = session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch('/api/wallet', { method: 'POST', headers, body: JSON.stringify({ amountCents }) });
    const json = await res.json();
    if (json?.url) window.location.href = json.url as string;
  }

  async function loadMoreReceipts() {
    if (receipts.loading || receipts.nextCursor === null) return;
    setReceipts((s) => ({ ...s, loading: true }));
    const token = session?.access_token;
    const headers: Record<string, string> | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
    const url = receipts.nextCursor ? `/api/receipts?limit=25&cursor=${encodeURIComponent(receipts.nextCursor)}` : '/api/receipts?limit=25';
    try {
      const r = await fetch(url, { headers });
      const d = await r.json();
      setReceipts((s) => ({ items: [...s.items, ...((d.receipts ?? []) as ReceiptItem[])], nextCursor: d.nextCursor ?? null, loading: false }));
    } catch {
      setReceipts((s) => ({ ...s, loading: false, error: 'Failed to load more receipts' }));
    }
  }

  async function exportCSV() {
    const rows: string[] = ['id,type,amount,currency,description,created_at,job_id,tax_amount_cents,discount_amount_cents'];
    const toSign = (type: string, cents: number) => (type === 'charge' ? -cents : cents);
    receipts.items.forEach((r) => {
      const amt = (toSign(r.type, r.amount_cents) / 100).toFixed(2);
      rows.push(
        `${r.id},${r.type},${amt},${r.currency},"${(r.description ?? '').replaceAll('"', '""')}",${r.created_at},${r.job_id ?? ''},${r.tax_amount_cents ?? ''},${r.discount_amount_cents ?? ''}`
      );
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receipts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
      }),
    []
  );

  const formatMoney = (amountCents: number, currency: string) => {
    const amount = amountCents / 100;
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  if (authLoading || !session) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="relative flex-1 overflow-y-auto p-5 lg:p-7">
          {toast && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2 transform rounded-input border border-border bg-white px-4 py-2 text-sm text-text-primary shadow-card">
              {toast}
            </div>
          )}
          <h1 className="mb-4 text-xl font-semibold text-text-primary">Billing</h1>
          {/* Pricing Hero */}
          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
            <h2 className="text-xl font-semibold text-text-primary">Price before you generate.</h2>
            <p className="mt-1 text-sm text-text-secondary">Pay only for what you run. Start with Starter Credits ($10). No subscription. No lock‑in.</p>
            {stripeMode !== 'disabled' && (
              <div className="mt-2">
                <span className={`rounded-full px-2 py-1 text-xs ${stripeMode==='test' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {stripeMode === 'test' ? 'Test Mode' : 'Live Mode'}
                </span>
              </div>
            )}
          </section>

          <section className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-card border border-border bg-white p-4 shadow-card">
              <h2 className="mb-2 text-lg font-semibold text-text-primary">Wallet</h2>
              <p className="text-sm text-text-secondary">Starter Credits ($10). Top up once, then pay per render to the cent. Any unused balance stays yours.</p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">${(wallet?.balance ?? 0).toFixed(2)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <button onClick={() => handleTopUp(1000)} className="rounded-input border border-border px-3 py-2 hover:bg-bg">Add funds $10</button>
                <button onClick={() => handleTopUp(2500)} className="rounded-input border border-border px-3 py-2 hover:bg-bg">$25</button>
                <button onClick={() => handleTopUp(5000)} className="rounded-input border border-border px-3 py-2 hover:bg-bg">$50</button>
                <Link href="/settings" className="ml-auto rounded-input border border-border px-3 py-2 hover:bg-bg">Enable auto top‑up (optional)</Link>
              </div>
              {(wallet?.balance ?? 0) < 2 && (
                <p className="mt-2 text-sm text-state-warning">Your balance is low. Top up to keep creating.</p>
              )}
            </div>
            <div className="rounded-card border border-border bg-white p-4 shadow-card">
              <h2 className="mb-2 text-lg font-semibold text-text-primary">Member Status</h2>
              <p className="text-sm text-text-secondary">Status is automatic — no subscription. Calculated on a rolling 30 days of spend. Status updates daily based on your last 30 days of spend.</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-bg px-2 py-1 text-xs text-text-secondary">{member?.tier ?? 'Member'}</span>
                <span className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">{`You save ${member?.savingsPct ?? 0}%`}</span>
              </div>
              <ul className="mt-3 list-disc pl-5 text-sm text-text-secondary">
                <li>Member — standard pricing.</li>
                <li>Plus (≥ $50 / 30 days) — 5% off every run + Saved Styles (unlimited).</li>
                <li>Pro (≥ $200 / 30 days) — 10% off every run + early access to new engines + light queue boost.</li>
              </ul>
            </div>
          </section>

          {/* For Teams (optional module) */}
          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
            <h2 className="mb-1 text-lg font-semibold text-text-primary">For Teams (optional)</h2>
            <p className="text-sm text-text-secondary">Shared wallet & roles. Let your team create with one balance. Set soft/hard project budgets. Daily summary by email.</p>
            <div className="mt-3 flex gap-2">
              <button className="rounded-input border border-border bg-white px-3 py-2 text-sm hover:bg-bg">Invite teammates</button>
              <button className="rounded-input border border-border bg-white px-3 py-2 text-sm hover:bg-bg">Set project budgets</button>
            </div>
            <p className="mt-2 text-xs text-text-muted">Team note: On shared wallets, status applies to all members.</p>
          </section>

          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
            <h2 className="mb-3 text-lg font-semibold text-text-primary">Cost Estimator</h2>
            <p className="mb-2 text-sm text-text-secondary">Select Engine · Duration · Resolution → This render: {estimating ? '…' : typeof estimate?.total === 'number' ? `$${estimate.total.toFixed(2)}` : '—'} (estimate)</p>
            {error && <p className="mb-2 text-sm text-state-warning">Failed to load engines.</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                <span className="mb-1 block text-text-secondary">Engine</span>
                <select
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={engineId ?? engines[0]?.id ?? ''}
                  onChange={(e) => setEngineId(e.target.value)}
                >
                  {engines.map((e) => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-text-secondary">Mode</span>
                <select
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                >
                  {(selected?.modes ?? ['t2v']).map((m) => (
                    <option key={m} value={m}>{m.toUpperCase()}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-text-secondary">Duration (sec)</span>
                <input
                  type="number"
                  min={1}
                  max={selected?.maxDurationSec ?? 8}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-text-secondary">Resolution</span>
                <select
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as Resolution)}
                >
                  {(selected?.resolutions ?? ['1080p']).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 rounded-input border border-border bg-bg p-3 text-sm">
              <p className="text-text-secondary">Note: You’ll be charged only if the render succeeds.</p>
              <div className="mt-2 flex items-center gap-2">
                {member?.savingsPct ? (
                  <span className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">Member price — You save {member.savingsPct}%</span>
                ) : (
                  <span className="rounded-full bg-bg px-2 py-1 text-xs text-text-secondary">Member price</span>
                )}
              </div>
            </div>
          </section>

          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
            <h2 className="mb-2 text-lg font-semibold text-text-primary">Receipts</h2>
            <p className="text-sm text-text-secondary">Itemized by engine, duration, and resolution. VAT included where applicable.</p>
            {receipts.error && <p className="text-sm text-state-warning">{receipts.error}</p>}
            <div className="mt-3 space-y-3">
              {receipts.items.length === 0 && !receipts.loading && (
                <p className="text-sm text-text-secondary">No receipts yet.</p>
              )}
              {receipts.items.map((r) => {
                const signedCents = r.type === 'charge' ? -r.amount_cents : r.amount_cents;
                const amountDisplay = formatMoney(signedCents, r.currency);
                const typeLabel = r.type === 'charge' ? 'Charge' : r.type === 'refund' ? 'Refund' : 'Top-up';
                const typeClass =
                  r.type === 'charge'
                    ? 'bg-rose-100 text-rose-700'
                    : r.type === 'refund'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-emerald-100 text-emerald-700';
                const amountClass = signedCents < 0 ? 'text-text-primary' : 'text-emerald-600';
                const taxCents = Number(r.tax_amount_cents ?? 0);
                const discountCents = Number(r.discount_amount_cents ?? 0);
                return (
                  <article key={r.id} className="space-y-3 rounded-card border border-border bg-bg p-4 text-sm text-text-secondary">
                    <header className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-text-muted" suppressHydrationWarning>
                          {dateFormatter.format(new Date(r.created_at))}
                        </span>
                        {r.job_id && <span className="text-[11px] text-text-muted">Job {r.job_id}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-micro ${typeClass}`}>
                          {typeLabel}
                        </span>
                        <span className={`text-base font-semibold ${amountClass}`}>{amountDisplay}</span>
                      </div>
                    </header>
                    {r.description && <p className="text-xs text-text-muted">{r.description}</p>}
                    <dl className="grid gap-1 text-xs sm:text-sm">
                      <div className="flex justify-between font-semibold text-text-primary">
                        <dt>Total</dt>
                        <dd>{formatMoney(r.amount_cents, r.currency)}</dd>
                      </div>
                      {taxCents > 0 && (
                        <div className="flex justify-between text-text-muted">
                          <dt>Tax</dt>
                          <dd>{formatMoney(taxCents, r.currency)}</dd>
                        </div>
                      )}
                      {discountCents > 0 && (
                        <div className="flex justify-between text-text-muted">
                          <dt>Discount</dt>
                          <dd>{formatMoney(-discountCents, r.currency)}</dd>
                        </div>
                      )}
                    </dl>
                  </article>
                );
              })}
              {receipts.loading && (
                <p className="text-sm text-text-secondary">Loading…</p>
              )}
              <div className="flex items-center gap-2">
                {receipts.nextCursor && (
                  <button onClick={loadMoreReceipts} disabled={receipts.loading} className="rounded-input border border-border bg-white px-3 py-2 text-sm hover:bg-bg disabled:opacity-60">
                    {receipts.loading ? 'Loading…' : 'Load more'}
                  </button>
                )}
                <button onClick={exportCSV} className="ml-auto rounded-input border border-border bg-white px-3 py-2 text-sm hover:bg-bg">Export CSV</button>
              </div>
            </div>
          </section>

          {/* Refunds & Protections */}
          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
            <h2 className="mb-2 text-lg font-semibold text-text-primary">Refunds & Protections</h2>
            <ul className="list-disc pl-5 text-sm text-text-secondary">
              <li>Failed render: automatic refund.</li>
              <li>Budget control: set soft/hard limits per project.</li>
              <li>No vendor lock‑in: Works with leading engines; trademarks belong to their owners.</li>
            </ul>
          </section>

          {/* Micro‑FAQ */}
          <section className="mb-6 rounded-card border border-border bg-white p-4 shadow-card">
            <h2 className="mb-2 text-lg font-semibold text-text-primary">Micro‑FAQ</h2>
            <div className="grid gap-2 text-sm text-text-secondary">
              <p><span className="font-medium text-text-primary">Do I need a subscription?</span> No. Pay as you go.</p>
              <p><span className="font-medium text-text-primary">Can I buy just one small render?</span> Yes — funds are debited per run from your $10 Starter balance.</p>
              <p><span className="font-medium text-text-primary">Will my credits expire?</span> Credits don’t expire while your account remains active.</p>
              <p><span className="font-medium text-text-primary">How do discounts work?</span> Member status applies automatically based on your last 30 days of spend.</p>
            </div>
            <p className="mt-3 text-xs text-text-muted">VAT included where applicable. Refunds on failed renders. “Works with” indicates compatibility; trademarks belong to their respective owners.</p>
          </section>

        </main>
      </div>
    </div>
  );
}
