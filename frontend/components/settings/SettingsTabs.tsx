import React from 'react';

import { FlagPill } from '@/components/FlagPill';
import { ButtonLink } from '@/components/ui/Button';
import {
  SETTINGS_TAB_ITEMS,
  type SettingsTab,
} from '@/lib/settings-navigation';

export type SettingsTabLabels = Record<SettingsTab, string>;

export const DEFAULT_SETTINGS_TAB_LABELS: SettingsTabLabels = {
  account: 'Account',
  connections: 'Connected apps',
  privacy: 'Privacy & Safety',
  notifications: 'Notifications',
};

export function SettingsTabs({
  activeTab,
  labels = DEFAULT_SETTINGS_TAB_LABELS,
  notificationsLive,
  notificationsLiveLabel = 'Live',
  notificationsSoonLabel = 'Coming soon',
}: {
  activeTab: SettingsTab;
  labels?: SettingsTabLabels;
  notificationsLive: boolean;
  notificationsLiveLabel?: string;
  notificationsSoonLabel?: string;
}) {
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Settings tabs">
      {SETTINGS_TAB_ITEMS.map((item) => {
        const active = activeTab === item.id;
        return (
          <ButtonLink
            key={item.id}
            href={item.href}
            prefetch={false}
            variant="outline"
            size="sm"
            className={`px-3 text-sm ${
              active
                ? 'border-brand bg-surface text-text-primary shadow-card hover:border-brand'
                : 'border-border bg-bg text-text-secondary hover:bg-surface'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="flex items-center gap-2">
              {labels[item.id]}
              {item.id === 'notifications' ? (
                <FlagPill
                  live={notificationsLive}
                  liveLabel={notificationsLiveLabel}
                  soonLabel={notificationsSoonLabel}
                />
              ) : null}
            </span>
          </ButtonLink>
        );
      })}
    </nav>
  );
}
