'use client';

import { useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type Tab = 'account' | 'team' | 'keys' | 'privacy' | 'notifications';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('account');
  const { loading: authLoading, session } = useRequireAuth();

  if (authLoading || !session) {
    return null;
  }

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

          {tab === 'account' && <AccountTab />}
          {tab === 'team' && <TeamTab />}
          {tab === 'keys' && <KeysTab />}
          {tab === 'privacy' && <PrivacyTab />}
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

function AccountTab() {
  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">Account</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">Name</span>
          <input className="w-full rounded-input border border-border bg-bg px-3 py-2" placeholder="Your name" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">Email</span>
          <input type="email" className="w-full rounded-input border border-border bg-bg px-3 py-2" placeholder="you@domain.com" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">Locale</span>
          <select className="w-full rounded-input border border-border bg-bg px-3 py-2">
            <option>EN</option>
            <option>FR</option>
            <option>ES</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-text-secondary">Theme</span>
          <select className="w-full rounded-input border border-border bg-bg px-3 py-2">
            <option>System</option>
            <option>Light</option>
            <option>Dark</option>
          </select>
        </label>
        <div className="col-span-full">
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" className="h-4 w-4" defaultChecked />
            Collapsed sidebar by default
          </label>
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

function PrivacyTab() {
  return (
    <section className="rounded-card border border-border bg-white p-4 shadow-card">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">Privacy & Safety</h2>
      <div className="space-y-3 text-sm text-text-secondary">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" />
          Feature this render (off by default)
        </label>
        <label className="block">
          <span className="mb-1 block">Safety level</span>
          <select className="w-full rounded-input border border-border bg-bg px-3 py-2">
            <option>Standard</option>
            <option>High</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block">Data retention</span>
          <select className="w-full rounded-input border border-border bg-bg px-3 py-2">
            <option>30 days</option>
            <option>90 days</option>
            <option>180 days</option>
          </select>
        </label>
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
