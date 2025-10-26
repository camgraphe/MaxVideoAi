"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import useSWR from 'swr';
import type { Session } from '@supabase/supabase-js';

type Tab = 'account' | 'team' | 'keys' | 'privacy' | 'notifications';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('account');
  const { loading: authLoading, session } = useRequireAuth();
  const {
    data: preferences,
    isLoading: prefsLoading,
    error: preferencesError,
    mutate: mutatePreferences,
  } = useUserPreferences(!authLoading && Boolean(session));
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);

  const handleDefaultIndexChange = useCallback(
    async (next: boolean) => {
      if (prefSaving) return;
      setPrefSaving(true);
      setPrefError(null);
      try {
        const res = await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ defaultAllowIndex: next }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? 'Failed to update preference');
        }
        await mutatePreferences(
          (current) => (current ? { ...current, defaultAllowIndex: next } : current),
          false
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update preference';
        setPrefError(message);
        console.error('[settings] default index update failed', error);
      } finally {
        setPrefSaving(false);
      }
    },
    [prefSaving, mutatePreferences]
  );

  if (authLoading || !session) {
    return null;
  }

  const preferencesLoadError = preferencesError instanceof Error ? preferencesError.message : null;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <h1 className="mb-4 text-xl font-semibold text-text-primary">Settings</h1>

          <nav className="mb-4 flex flex-wrap gap-2" aria-label="Settings tabs">
            <TabLink id="account" label="Account" active={tab === 'account'} onClick={() => setTab('account')} />
            <TabLink id="team" label="Team" active={tab === 'team'} onClick={() => setTab('team')} />
            <TabLink id="keys" label="API Keys" active={tab === 'keys'} onClick={() => setTab('keys')} />
            <TabLink id="privacy" label="Privacy & Safety" active={tab === 'privacy'} onClick={() => setTab('privacy')} />
            <TabLink id="notifications" label="Notifications" active={tab === 'notifications'} onClick={() => setTab('notifications')} />
          </nav>

          {tab === 'account' && <AccountTab session={session} />}
          {tab === 'team' && <TeamTab />}
          {tab === 'keys' && <KeysTab />}
          {tab === 'privacy' && (
            <PrivacyTab
              defaultAllowIndex={preferences?.defaultAllowIndex}
              loading={prefsLoading}
              saving={prefSaving}
              loadError={preferencesLoadError}
              error={prefError}
              onToggleIndexing={(value) => {
                void handleDefaultIndexChange(value);
              }}
            />
          )}
          {tab === 'notifications' && <NotificationsTab />}
        </main>
      </div>
    </div>
  );
}

function TabLink({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      id={`settings-tab-${id}`}
      onClick={onClick}
      className={`rounded-input border px-3 py-2 text-sm ${active ? 'border-accent bg-white text-text-primary shadow-card' : 'border-border bg-bg text-text-secondary hover:bg-white'}`}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </button>
  );
}

type CurrencySummary = {
  ok: boolean;
  currency?: string | null;
  defaultCurrency?: string;
  enabled?: string[];
  balances?: Array<{ currency: string | null; balanceCents: number }>;
  locked?: boolean;
  error?: string;
};

const currencyFetcher = async (url: string): Promise<CurrencySummary> => {
  const res = await fetch(url, { credentials: 'include' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) {
    const message = json?.error ?? 'Unable to load currency preferences';
    throw new Error(message);
  }
  return json as CurrencySummary;
};

type AccountTabProps = {
  session: Session | null;
};

function AccountTab({ session }: AccountTabProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [hasTouchedCurrency, setHasTouchedCurrency] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencySaveError, setCurrencySaveError] = useState<string | null>(null);
  const [currencySuccess, setCurrencySuccess] = useState<string | null>(null);

  const shouldFetchCurrency = Boolean(session);
  const {
    data: currencyData,
    error: currencyFetchError,
    isLoading: currencyLoading,
    mutate: mutateCurrency,
  } = useSWR<CurrencySummary>(shouldFetchCurrency ? '/api/me/currency' : null, currencyFetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!currencyData || hasTouchedCurrency) return;
    const next = currencyData.currency ?? currencyData.defaultCurrency ?? null;
    setSelectedCurrency(next);
  }, [currencyData, hasTouchedCurrency]);

  const currencyOptions = useMemo(() => currencyData?.enabled ?? ['EUR', 'USD'], [currencyData]);
  const currentCurrency = currencyData?.currency ?? currencyData?.defaultCurrency ?? null;
  const pendingCurrency = selectedCurrency ?? currentCurrency;

  const balancesByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    currencyData?.balances?.forEach((entry) => {
      if (entry.currency) {
        map.set(entry.currency, entry.balanceCents);
      }
    });
    return map;
  }, [currencyData]);

  const currentBalanceCents = currentCurrency ? balancesByCurrency.get(currentCurrency) ?? 0 : 0;
  const blockingBalance = useMemo(() => {
    if (!pendingCurrency) return null;
    return currencyData?.balances?.find(
      (entry) => entry.currency && entry.currency !== pendingCurrency && entry.balanceCents > 0
    ) ?? null;
  }, [currencyData, pendingCurrency]);

  const hasPendingChange = Boolean(pendingCurrency && currentCurrency && pendingCurrency !== currentCurrency);
  const disableUpdate =
    !pendingCurrency || savingCurrency || currencyLoading || Boolean(currencyFetchError) || !hasPendingChange;

  const formatCurrencyValue = useCallback((cents: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
    } catch {
      return `${(cents / 100).toFixed(2)} ${currency}`;
    }
  }, []);

  const handleCurrencyChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value || null;
    setSelectedCurrency(value);
    setHasTouchedCurrency(true);
    setCurrencySaveError(null);
    setCurrencySuccess(null);
  }, []);

  const handleCurrencySave = useCallback(async () => {
    if (!pendingCurrency || pendingCurrency === currentCurrency) {
      return;
    }
    const confirmed = window.confirm(
      `Confirm switching the wallet currency to ${pendingCurrency}? This applies to all future top-ups and direct payments.`
    );
    if (!confirmed) return;

    setSavingCurrency(true);
    setCurrencySaveError(null);
    setCurrencySuccess(null);

    try {
      const res = await fetch('/api/me/currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currency: pendingCurrency.toLowerCase(), confirm: true }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const message = json?.error ?? 'Failed to update currency';
        throw new Error(message);
      }
      setCurrencySuccess('Currency updated.');
      setHasTouchedCurrency(false);
      await mutateCurrency();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update currency';
      setCurrencySaveError(message);
    } finally {
      setSavingCurrency(false);
    }
  }, [pendingCurrency, currentCurrency, mutateCurrency]);

  const nameDefault =
    typeof session?.user?.user_metadata?.full_name === 'string'
      ? session?.user?.user_metadata?.full_name
      : session?.user?.user_metadata?.name ?? '';
  const emailDefault = session?.user?.email ?? '';

  const currencyFetchErrorMessage = currencyFetchError instanceof Error ? currencyFetchError.message : null;

  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">Account</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">Name</span>
          <input
            className="w-full rounded-input border border-border bg-bg px-3 py-2"
            placeholder="Your name"
            defaultValue={nameDefault}
            readOnly={!nameDefault}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">Email</span>
          <input
            type="email"
            className="w-full rounded-input border border-border bg-bg px-3 py-2"
            placeholder="you@domain.com"
            defaultValue={emailDefault}
            readOnly
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">Locale</span>
          <select className="w-full rounded-input border border-border bg-bg px-3 py-2" defaultValue="EN" disabled>
            <option>EN</option>
            <option>FR</option>
            <option>ES</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">Theme</span>
          <select className="w-full rounded-input border border-border bg-bg px-3 py-2" defaultValue="System" disabled>
            <option>System</option>
            <option>Light</option>
            <option>Dark</option>
          </select>
        </label>
        <div className="col-span-full rounded-input border border-border bg-bg px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Wallet currency</p>
              <p className="text-xs text-text-secondary">
                Wallet balance stays in USD; this only changes the Stripe charge currency.
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-text-secondary">
              {currentCurrency ?? '—'}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              className="w-full rounded-input border border-border bg-white px-3 py-2 sm:max-w-[200px]"
              value={pendingCurrency ?? ''}
              onChange={handleCurrencyChange}
              disabled={currencyLoading || savingCurrency || Boolean(currencyFetchError)}
            >
              {currencyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-input border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleCurrencySave}
              disabled={disableUpdate}
            >
              {savingCurrency ? 'Saving…' : 'Update currency'}
            </button>
          </div>
          {currencyLoading && <p className="mt-2 text-xs text-text-secondary">Loading currency…</p>}
          {currencyFetchErrorMessage && (
            <p className="mt-2 text-xs text-red-500">{currencyFetchErrorMessage}</p>
          )}
          {currencySaveError && <p className="mt-2 text-xs text-red-500">{currencySaveError}</p>}
          {currencySuccess && <p className="mt-2 text-xs text-green-600">{currencySuccess}</p>}
          {typeof currentBalanceCents === 'number' && currentCurrency && (
            <p className="mt-2 text-xs text-text-secondary">
              Available balance:&nbsp;{formatCurrencyValue(currentBalanceCents, currentCurrency)}
            </p>
          )}
          {blockingBalance?.currency && (
            <p className="mt-1 text-xs text-amber-600">
              Clear your {blockingBalance.currency} balance ({formatCurrencyValue(
                blockingBalance.balanceCents,
                blockingBalance.currency
              )}) before changing currency.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function TeamTab() {
  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">Team</h2>
      <p className="text-sm text-text-secondary">Manage members, roles, budgets and integrations.</p>
      <div className="mt-3 flex gap-2">
        <button className="rounded-input border border-border px-3 py-2 text-sm hover:bg-bg">Invite member</button>
        <button className="rounded-input border border-border px-3 py-2 text-sm hover:bg-bg">Create project</button>
      </div>
    </section>
  );
}

function KeysTab() {
  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">API Keys</h2>
      <div className="flex items-center gap-2 text-sm">
        <input className="flex-1 rounded-input border border-border bg-bg px-3 py-2" placeholder="sk_live_…" readOnly value="sk_demo_xxx" />
        <button className="rounded-input border border-border px-3 py-2 hover:bg-bg">Copy</button>
        <button className="rounded-input border border-border px-3 py-2 hover:bg-bg">Revoke</button>
      </div>
      <div className="mt-3">
        <button className="rounded-input border border-border px-3 py-2 text-sm hover:bg-bg">Create new key</button>
      </div>
    </section>
  );
}

function PrivacyTab({
  defaultAllowIndex,
  loading,
  saving,
  loadError,
  error,
  onToggleIndexing,
}: {
  defaultAllowIndex?: boolean | null;
  loading: boolean;
  saving: boolean;
  loadError?: string | null;
  error: string | null;
  onToggleIndexing: (next: boolean) => void;
}) {
  const allowIndex = defaultAllowIndex ?? true;
  const isDisabled = loading || saving || Boolean(loadError);

  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">Privacy & Safety</h2>
      <div className="space-y-4 text-sm text-text-secondary">
        <div className="rounded-card border border-hairline bg-bg px-4 py-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border border-border accent-accent"
              checked={allowIndex}
              onChange={(event) => onToggleIndexing(event.target.checked)}
              disabled={isDisabled}
            />
            <span>
              <span className="block font-medium text-text-primary">Allow indexing by default</span>
              <span className="mt-1 block text-xs text-text-muted">
                New videos can appear in the gallery, sitemap, and search previews. You can still uncheck individual renders from their detail view.
              </span>
            </span>
          </label>
          {saving ? <p className="mt-2 text-xs text-text-muted">Saving preference…</p> : null}
          {loadError ? <p className="mt-2 text-xs text-state-warning">{loadError}</p> : null}
          {error ? <p className="mt-2 text-xs text-state-warning">{error}</p> : null}
        </div>
        <p className="text-xs text-text-muted">
          Disable this toggle if you prefer every render to stay private by default. Published videos will keep their current visibility until you change them individually.
        </p>
      </div>
    </section>
  );
}

function NotificationsTab() {
  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">Notifications</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow label="Job done" />
        <ToggleRow label="Job failed" />
        <ToggleRow label="Low wallet" />
        <ToggleRow label="Weekly summary" />
      </div>
    </section>
  );
}

function ToggleRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-input border border-border bg-bg px-3 py-2 text-sm">
      <span className="text-text-secondary">{label}</span>
      <label className="inline-flex cursor-pointer items-center">
        <input type="checkbox" className="peer sr-only" defaultChecked />
        <span className="h-5 w-9 rounded-full bg-white ring-1 ring-border transition peer-checked:bg-accent" />
      </label>
    </div>
  );
}
