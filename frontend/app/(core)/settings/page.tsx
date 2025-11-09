"use client";

import { useCallback, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { FlagPill } from '@/components/FlagPill';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useMarketingPreference } from '@/hooks/useMarketingPreference';
import { FEATURES } from '@/content/feature-flags';
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
  const teamsLive = FEATURES.workflows.approvals && FEATURES.workflows.budgetControls;
  const notificationsLive = FEATURES.notifications.center;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <h1 className="mb-4 text-xl font-semibold text-text-primary">Settings</h1>

          <nav className="mb-4 flex flex-wrap gap-2" aria-label="Settings tabs">
            <TabLink id="account" label="Account" active={tab === 'account'} onClick={() => setTab('account')} />
            <TabLink id="team" label="Team" active={tab === 'team'} onClick={() => setTab('team')} badgeLive={teamsLive} />
            <TabLink id="keys" label="API Keys" active={tab === 'keys'} onClick={() => setTab('keys')} />
            <TabLink id="privacy" label="Privacy & Safety" active={tab === 'privacy'} onClick={() => setTab('privacy')} />
            <TabLink
              id="notifications"
              label="Notifications"
              active={tab === 'notifications'}
              onClick={() => setTab('notifications')}
              badgeLive={notificationsLive}
            />
          </nav>

          {tab === 'account' && <AccountTab session={session} />}
          {tab === 'team' && <TeamTab live={teamsLive} />}
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
          {tab === 'notifications' && <NotificationsTab live={notificationsLive} />}
        </main>
      </div>
    </div>
  );
}

function TabLink({
  id,
  label,
  active,
  onClick,
  badgeLive,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
  badgeLive?: boolean;
}) {
  return (
    <button
      type="button"
      id={`settings-tab-${id}`}
      onClick={onClick}
      className={`rounded-input border px-3 py-2 text-sm ${active ? 'border-accent bg-white text-text-primary shadow-card' : 'border-border bg-bg text-text-secondary hover:bg-white'}`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="flex items-center gap-2">
        {label}
        {badgeLive === undefined ? null : (
          <>
            <FlagPill live={badgeLive} />
            <span className="sr-only">{badgeLive ? 'Live' : 'Coming soon'}</span>
          </>
        )}
      </span>
    </button>
  );
}

type AccountTabProps = {
  session: Session | null;
};

function AccountTab({ session }: AccountTabProps) {
  const nameDefault =
    typeof session?.user?.user_metadata?.full_name === 'string'
      ? session?.user?.user_metadata?.full_name
      : session?.user?.user_metadata?.name ?? '';
  const emailDefault = session?.user?.email ?? '';

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
      </div>
    </section>
  );
}

function TeamTab({ live }: { live: boolean }) {
  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-text-primary">
        Team
        <FlagPill live={live} />
        <span className="sr-only">{live ? 'Live' : 'Coming soon'}</span>
      </h2>
      {live ? (
        <>
          <p className="text-sm text-text-secondary">Manage members, roles, budgets and integrations.</p>
          <div className="mt-3 flex gap-2">
            <button className="rounded-input border border-border px-3 py-2 text-sm hover:bg-bg">Invite member</button>
            <button className="rounded-input border border-border px-3 py-2 text-sm hover:bg-bg">Create project</button>
          </div>
        </>
      ) : (
        <div className="mt-2 rounded-xl border border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
          Coming soon — shared wallets, approvals, and budgets. Join the beta at{' '}
          <a className="underline underline-offset-2" href="mailto:support@maxvideoai.com">
            support@maxvideoai.com
          </a>
          .
        </div>
      )}
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

function NotificationsTab({ live }: { live: boolean }) {
  const { data: marketingPref, isLoading, mutate } = useMarketingPreference(live);
  const [saving, setSaving] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);

  if (!live) {
    return (
      <section className="rounded-card border border-border bg-white p-4 shadow-card">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-text-primary">
          Notifications
          <FlagPill live={false} />
          <span className="sr-only">Coming soon</span>
        </h2>
        <div className="rounded-xl border border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
          Coming soon — email digests and web push alerts for spend, queue health, and job status.
        </div>
      </section>
    );
  }

  const handleMarketingToggle = async () => {
    if (saving) return;
    setSaving(true);
    setPrefError(null);
    try {
      const res = await fetch('/api/account/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ optIn: !(marketingPref?.optIn ?? false) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Failed to update preference');
      }
      await mutate(
        () => ({
          optIn: json.optIn as boolean,
          updatedAt: (json.updatedAt as string | null) ?? null,
          requiresDoubleOptIn: json.requiresDoubleOptIn as boolean | undefined,
        }),
        false
      );
    } catch (error) {
      setPrefError(error instanceof Error ? error.message : 'Failed to update preference');
    } finally {
      setSaving(false);
    }
  };

  const marketingEnabled = marketingPref?.optIn ?? false;
  const doubleOptInPending = Boolean(marketingPref?.requiresDoubleOptIn);
  const lastUpdatedLabel = marketingPref?.updatedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(marketingPref.updatedAt))
    : null;

  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">Notifications</h2>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-input border border-border bg-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">Marketing emails</p>
            <p className="text-xs text-text-secondary">
              Receive occasional updates, launch announcements, and workflow tips. You can unsubscribe anytime.
            </p>
            {lastUpdatedLabel ? (
              <p className="mt-1 text-xs text-text-muted">Last updated: {lastUpdatedLabel}</p>
            ) : null}
            {doubleOptInPending ? (
              <p className="mt-1 text-xs text-accent">
                Confirmation required — check your inbox to finish subscribing.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleMarketingToggle}
            disabled={isLoading || saving}
            className={`flex h-7 w-12 items-center rounded-full border transition ${marketingEnabled ? 'border-accent bg-accent' : 'border-border bg-white'}`}
            aria-pressed={marketingEnabled}
          >
            <span
              className={`ml-1 block h-5 w-5 rounded-full bg-white shadow transition ${marketingEnabled ? 'translate-x-5' : ''}`}
            />
          </button>
        </div>
        {prefError ? <p className="text-xs text-state-warning">{prefError}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow label="Job done" />
          <ToggleRow label="Job failed" />
          <ToggleRow label="Low wallet" />
          <ToggleRow label="Weekly summary" />
        </div>
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
