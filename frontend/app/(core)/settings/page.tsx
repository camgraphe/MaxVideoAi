"use client";

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { FlagPill } from '@/components/FlagPill';
import { SettingsTabs } from '@/components/settings/SettingsTabs';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useMarketingPreference } from '@/hooks/useMarketingPreference';
import { FEATURES } from '@/content/feature-flags';
import deepmerge from 'deepmerge';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { Button } from '@/components/ui/Button';
import { resolveSettingsContentTab } from '@/lib/settings-navigation';
import { AccountSettingsPanel } from './_components/AccountSettingsPanel';

const DEFAULT_SETTINGS_COPY = {
  title: 'Settings',
  tabs: {
    account: 'Account',
    connections: 'Connected apps',
    team: 'Team',
    privacy: 'Privacy & Safety',
    notifications: 'Notifications',
  },
  account: {
    title: 'Account',
    guest: {
      description: 'Sign in to update your account preferences.',
      action: 'Log in',
    },
    fields: {
      name: { label: 'Name', placeholder: 'Your name', help: '1–80 characters.' },
      email: { label: 'Email', placeholder: 'you@domain.com', readOnly: 'Email changes are managed separately.' },
      locale: { label: 'Language', description: 'Interface language:' },
      theme: {
        label: 'Appearance',
        description: 'Saved on this device.',
        options: { light: 'Light', dark: 'Dark', system: 'System' },
      },
    },
    actions: { save: 'Save', saving: 'Saving…', cancel: 'Cancel' },
    validation: { required: 'Enter a name.', tooLong: 'Name must be 80 characters or fewer.' },
    status: { success: 'Name saved.', genericError: 'Could not save your name. Try again.' },
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
  privacy: {
    title: 'Privacy & Safety',
    summary:
      'New renders are private by default. Public publishing and search exposure are handled through the MaxVideoAI review workflow.',
    reviewNote:
      'If the team promotes a render publicly, it can still stay out of the video SEO rollout unless it is explicitly curated as a watch page.',
    supportPrefix: 'If you need a public render delisted or removed, contact ',
    supportEmail: 'support@maxvideoai.com',
    supportSuffix: ' and the team will review the request.',
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
  const searchParams = useSearchParams();
  const tab = resolveSettingsContentTab(searchParams?.get('tab'));
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { t } = useI18n();
  const rawCopy = t('workspace.settings', DEFAULT_SETTINGS_COPY);
  const copy = useMemo<SettingsCopy>(() => {
    if (!rawCopy || typeof rawCopy !== 'object') return DEFAULT_SETTINGS_COPY;
    return deepmerge(DEFAULT_SETTINGS_COPY, rawCopy as Partial<SettingsCopy>, {
      arrayMerge: (_destination, source) => source,
    });
  }, [rawCopy]);
  const isGuest = !user;

  if (authLoading) {
    return null;
  }

  const notificationsLive = FEATURES.notifications.center;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0">
        <AppSidebar />
        <main className="app-settings-main min-w-0 flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pt-7">
          <div className="mx-auto max-w-5xl">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.tabs[tab]}</p>
            <h1 className="mt-1 text-2xl font-semibold text-text-primary">{copy.title}</h1>
          </div>

          <SettingsTabs
            activeTab={tab}
            labels={copy.tabs}
            notificationsLive={notificationsLive}
            notificationsLiveLabel={copy.notifications.srLive}
            notificationsSoonLabel={copy.notifications.srSoon}
          />

          {tab === 'account' && <AccountSettingsPanel user={user} copy={copy.account} />}
          {tab === 'privacy' && <PrivacyTab guest={isGuest} copy={copy.privacy} />}
          {tab === 'notifications' && <NotificationsTab live={notificationsLive} copy={copy.notifications} guest={isGuest} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function PrivacyTab({
  guest,
  copy,
}: {
  guest: boolean;
  copy: SettingsCopy['privacy'];
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">{copy.title}</h2>
      <div className="space-y-4 text-sm text-text-secondary">
        <div className="rounded-card border border-hairline bg-bg px-4 py-3">
          <p className="text-sm text-text-primary">{copy.summary}</p>
          <p className="mt-2 text-xs text-text-muted">{copy.reviewNote}</p>
          {guest ? (
            <p className="mt-2 text-xs text-text-muted">
              Sign in to manage your workspace and request visibility changes for existing renders.
            </p>
          ) : null}
        </div>
        <p className="text-xs text-text-muted">
          {copy.supportPrefix}
          <ObfuscatedEmailLink
            user="support"
            domain="maxvideoai.com"
            label={copy.supportEmail}
            placeholder="support [at] maxvideoai.com"
            className="underline underline-offset-2"
          />
          {copy.supportSuffix}
        </p>
      </div>
    </section>
  );
}

function NotificationsTab({
  live,
  copy,
  guest,
}: {
  live: boolean;
  copy: SettingsCopy['notifications'];
  guest: boolean;
}) {
  const { data: marketingPref, isLoading, mutate } = useMarketingPreference(live && !guest);
  const [saving, setSaving] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);

  if (!live) {
    return (
      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
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
    if (guest || saving) return;
    setSaving(true);
    setPrefError(null);
    try {
      const res = await authFetch('/api/account/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <section className="rounded-card border border-border bg-surface p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">{copy.title}</h2>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 rounded-input border border-border bg-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">{copy.marketing.title}</p>
            <p className="text-xs text-text-secondary">{copy.marketing.description}</p>
            {lastUpdatedLabel ? (
              <p className="mt-1 text-xs text-text-muted">
                {copy.marketing.lastUpdatedPrefix} {lastUpdatedLabel}
              </p>
            ) : null}
            {doubleOptInPending ? (
              <p className="mt-1 text-xs text-brand">{copy.marketing.confirmPending}</p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleMarketingToggle}
            disabled={guest || isLoading || saving}
            className={`h-7 w-12 min-h-0 rounded-full border p-0 ${marketingEnabled ? 'border-brand bg-brand' : 'border-border bg-surface'}`}
            aria-pressed={marketingEnabled}
          >
            <span
              className={`ml-1 block h-5 w-5 rounded-full bg-surface shadow transition ${marketingEnabled ? 'translate-x-5' : ''}`}
            />
          </Button>
        </div>
        {prefError ? <p className="text-xs text-state-warning">{prefError}</p> : null}
        <div className="grid grid-gap-sm sm:grid-cols-2">
          <ToggleRow label={copy.toggles.jobDone} soonLabel={copy.srSoon} />
          <ToggleRow label={copy.toggles.jobFailed} soonLabel={copy.srSoon} />
          <ToggleRow label={copy.toggles.lowWallet} soonLabel={copy.srSoon} />
          <ToggleRow label={copy.toggles.weeklySummary} soonLabel={copy.srSoon} />
        </div>
      </div>
    </section>
  );
}

function ToggleRow({ label, soonLabel }: { label: string; soonLabel: string }) {
  return (
    <div className="flex items-center justify-between rounded-input border border-border bg-bg px-3 py-2 text-sm opacity-70">
      <span className="text-text-secondary">{label}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{soonLabel}</span>
    </div>
  );
}
