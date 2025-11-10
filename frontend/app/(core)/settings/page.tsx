"use client";

import { useCallback, useMemo, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { FlagPill } from '@/components/FlagPill';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useMarketingPreference } from '@/hooks/useMarketingPreference';
import { FEATURES } from '@/content/feature-flags';
import type { Session } from '@supabase/supabase-js';
import deepmerge from 'deepmerge';
import { useI18n } from '@/lib/i18n/I18nProvider';

type Tab = 'account' | 'team' | 'keys' | 'privacy' | 'notifications';

const DEFAULT_SETTINGS_COPY = {
  title: 'Settings',
  tabs: {
    account: 'Account',
    team: 'Team',
    keys: 'API Keys',
    privacy: 'Privacy & Safety',
    notifications: 'Notifications',
  },
  account: {
    title: 'Account',
    fields: {
      name: { label: 'Name', placeholder: 'Your name' },
      email: { label: 'Email', placeholder: 'you@domain.com' },
      locale: { label: 'Locale', options: ['EN', 'FR', 'ES'] },
      theme: { label: 'Theme', options: ['System', 'Light', 'Dark'] },
    },
  },
  team: {
    title: 'Team',
    srLive: 'Live',
    srSoon: 'Coming soon',
    liveDescription: 'Manage members, roles, budgets and integrations.',
    invite: 'Invite member',
    createProject: 'Create project',
    upcomingPrefix: 'Coming soon — shared wallets, approvals, and budgets. Join the beta at ',
    upcomingEmail: 'support@maxvideoai.com',
    upcomingSuffix: '.',
  },
  keys: {
    title: 'API Keys',
    placeholder: 'sk_live_…',
    copy: 'Copy',
    revoke: 'Revoke',
    create: 'Create new key',
  },
  privacy: {
    title: 'Privacy & Safety',
    allowIndexLabel: 'Allow indexing by default',
    allowIndexDescription:
      'New videos can appear in the gallery, sitemap, and search previews. You can still uncheck individual renders from their detail view.',
    saving: 'Saving preference…',
    disableHint:
      'Disable this toggle if you prefer every render to stay private by default. Published videos will keep their current visibility until you change them individually.',
    preferenceError: 'Failed to update preference',
  },
  notifications: {
    title: 'Notifications',
    comingSoon: 'Coming soon — email digests and web push alerts for spend, queue health, and job status.',
    srSoon: 'Coming soon',
    srLive: 'Live',
    marketing: {
      title: 'Marketing emails',
      description: 'Receive occasional updates, launch announcements, and workflow tips. You can unsubscribe anytime.',
      lastUpdatedPrefix: 'Last updated:',
      confirmPending: 'Confirmation required — check your inbox to finish subscribing.',
    },
    toggles: {
      jobDone: 'Job done',
      jobFailed: 'Job failed',
      lowWallet: 'Low wallet',
      weeklySummary: 'Weekly summary',
    },
    errors: {
      generic: 'Failed to update preference',
    },
  },
} as const;

type SettingsCopy = typeof DEFAULT_SETTINGS_COPY;

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('account');
  const { loading: authLoading, session } = useRequireAuth();
  const { t } = useI18n();
  const rawCopy = t('workspace.settings', DEFAULT_SETTINGS_COPY);
  const copy = useMemo<SettingsCopy>(() => {
    if (!rawCopy || typeof rawCopy !== 'object') return DEFAULT_SETTINGS_COPY;
    return deepmerge(DEFAULT_SETTINGS_COPY, rawCopy as Partial<SettingsCopy>);
  }, [rawCopy]);
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
        const message = error instanceof Error ? error.message : copy.privacy.preferenceError;
        setPrefError(message);
        console.error('[settings] default index update failed', error);
      } finally {
        setPrefSaving(false);
      }
    },
    [prefSaving, mutatePreferences, copy.privacy.preferenceError]
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
          <h1 className="mb-4 text-xl font-semibold text-text-primary">{copy.title}</h1>

          <nav className="mb-4 flex flex-wrap gap-2" aria-label="Settings tabs">
            <TabLink id="account" label={copy.tabs.account} active={tab === 'account'} onClick={() => setTab('account')} />
            <TabLink
              id="team"
              label={copy.tabs.team}
              active={tab === 'team'}
              onClick={() => setTab('team')}
              badgeLive={teamsLive}
              badgeSrLive={copy.team.srLive}
              badgeSrSoon={copy.team.srSoon}
            />
            <TabLink id="keys" label={copy.tabs.keys} active={tab === 'keys'} onClick={() => setTab('keys')} />
            <TabLink id="privacy" label={copy.tabs.privacy} active={tab === 'privacy'} onClick={() => setTab('privacy')} />
            <TabLink
              id="notifications"
              label={copy.tabs.notifications}
              active={tab === 'notifications'}
              onClick={() => setTab('notifications')}
              badgeLive={notificationsLive}
              badgeSrLive={copy.notifications.srLive}
              badgeSrSoon={copy.notifications.srSoon}
            />
          </nav>

          {tab === 'account' && <AccountTab session={session} copy={copy.account} />}
          {tab === 'team' && <TeamTab live={teamsLive} copy={copy.team} />}
          {tab === 'keys' && <KeysTab copy={copy.keys} />}
          {tab === 'privacy' && (
            <PrivacyTab
              defaultAllowIndex={preferences?.defaultAllowIndex}
              loading={prefsLoading}
              saving={prefSaving}
              loadError={preferencesLoadError}
              error={prefError}
              copy={copy.privacy}
              onToggleIndexing={(value) => {
                void handleDefaultIndexChange(value);
              }}
            />
          )}
          {tab === 'notifications' && <NotificationsTab live={notificationsLive} copy={copy.notifications} />}
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
  badgeSrLive,
  badgeSrSoon,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
  badgeLive?: boolean;
  badgeSrLive?: string;
  badgeSrSoon?: string;
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
            <span className="sr-only">{badgeLive ? badgeSrLive ?? 'Live' : badgeSrSoon ?? 'Coming soon'}</span>
          </>
        )}
      </span>
    </button>
  );
}

type AccountTabProps = {
  session: Session | null;
  copy: SettingsCopy['account'];
};

function AccountTab({ session, copy }: AccountTabProps) {
  const nameDefault =
    typeof session?.user?.user_metadata?.full_name === 'string'
      ? session?.user?.user_metadata?.full_name
      : session?.user?.user_metadata?.name ?? '';
  const emailDefault = session?.user?.email ?? '';

  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">{copy.title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">{copy.fields.name.label}</span>
          <input
            className="w-full rounded-input border border-border bg-bg px-3 py-2"
            placeholder={copy.fields.name.placeholder}
            defaultValue={nameDefault}
            readOnly={!nameDefault}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">{copy.fields.email.label}</span>
          <input
            type="email"
            className="w-full rounded-input border border-border bg-bg px-3 py-2"
            placeholder={copy.fields.email.placeholder}
            defaultValue={emailDefault}
            readOnly
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">{copy.fields.locale.label}</span>
          <select
            className="w-full rounded-input border border-border bg-bg px-3 py-2"
            defaultValue={copy.fields.locale.options[0]}
            disabled
          >
            {copy.fields.locale.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">{copy.fields.theme.label}</span>
          <select
            className="w-full rounded-input border border-border bg-bg px-3 py-2"
            defaultValue={copy.fields.theme.options[0]}
            disabled
          >
            {copy.fields.theme.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function TeamTab({ live, copy }: { live: boolean; copy: SettingsCopy['team'] }) {
  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-text-primary">
        {copy.title}
        <FlagPill live={live} />
        <span className="sr-only">{live ? copy.srLive : copy.srSoon}</span>
      </h2>
      {live ? (
        <>
          <p className="text-sm text-text-secondary">{copy.liveDescription}</p>
          <div className="mt-3 flex gap-2">
            <button className="rounded-input border border-border px-3 py-2 text-sm hover:bg-bg">{copy.invite}</button>
            <button className="rounded-input border border-border px-3 py-2 text-sm hover:bg-bg">{copy.createProject}</button>
          </div>
        </>
      ) : (
        <div className="mt-2 rounded-xl border border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
          {copy.upcomingPrefix}
          <a className="underline underline-offset-2" href={`mailto:${copy.upcomingEmail}`}>
            {copy.upcomingEmail}
          </a>
          {copy.upcomingSuffix}
        </div>
      )}
    </section>
  );
}

function KeysTab({ copy }: { copy: SettingsCopy['keys'] }) {
  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">{copy.title}</h2>
      <div className="flex items-center gap-2 text-sm">
        <input className="flex-1 rounded-input border border-border bg-bg px-3 py-2" placeholder={copy.placeholder} readOnly value="sk_demo_xxx" />
        <button className="rounded-input border border-border px-3 py-2 hover:bg-bg">{copy.copy}</button>
        <button className="rounded-input border border-border px-3 py-2 hover:bg-bg">{copy.revoke}</button>
      </div>
      <div className="mt-3">
        <button className="rounded-input border border-border px-3 py-2 text-sm hover:bg-bg">{copy.create}</button>
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
  copy,
}: {
  defaultAllowIndex?: boolean | null;
  loading: boolean;
  saving: boolean;
  loadError?: string | null;
  error: string | null;
  onToggleIndexing: (next: boolean) => void;
  copy: SettingsCopy['privacy'];
}) {
  const allowIndex = defaultAllowIndex ?? true;
  const isDisabled = loading || saving || Boolean(loadError);

  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">{copy.title}</h2>
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
              <span className="block font-medium text-text-primary">{copy.allowIndexLabel}</span>
              <span className="mt-1 block text-xs text-text-muted">{copy.allowIndexDescription}</span>
            </span>
          </label>
          {saving ? <p className="mt-2 text-xs text-text-muted">{copy.saving}</p> : null}
          {loadError ? <p className="mt-2 text-xs text-state-warning">{loadError}</p> : null}
          {error ? <p className="mt-2 text-xs text-state-warning">{error}</p> : null}
        </div>
        <p className="text-xs text-text-muted">{copy.disableHint}</p>
      </div>
    </section>
  );
}

function NotificationsTab({ live, copy }: { live: boolean; copy: SettingsCopy['notifications'] }) {
  const { data: marketingPref, isLoading, mutate } = useMarketingPreference(live);
  const [saving, setSaving] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);

  if (!live) {
    return (
      <section className="rounded-card border border-border bg-white p-4 shadow-card">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-text-primary">
          {copy.title}
          <FlagPill live={false} />
          <span className="sr-only">{copy.srSoon}</span>
        </h2>
        <div className="rounded-xl border border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
          {copy.comingSoon}
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
        throw new Error(json?.error ?? copy.errors.generic);
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
      setPrefError(error instanceof Error ? error.message : copy.errors.generic);
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
      <h2 className="mb-3 text-lg font-semibold text-text-primary">{copy.title}</h2>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-input border border-border bg-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">{copy.marketing.title}</p>
            <p className="text-xs text-text-secondary">{copy.marketing.description}</p>
            {lastUpdatedLabel ? (
              <p className="mt-1 text-xs text-text-muted">
                {copy.marketing.lastUpdatedPrefix} {lastUpdatedLabel}
              </p>
            ) : null}
            {doubleOptInPending ? (
              <p className="mt-1 text-xs text-accent">{copy.marketing.confirmPending}</p>
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
          <ToggleRow label={copy.toggles.jobDone} />
          <ToggleRow label={copy.toggles.jobFailed} />
          <ToggleRow label={copy.toggles.lowWallet} />
          <ToggleRow label={copy.toggles.weeklySummary} />
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
