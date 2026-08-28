import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

import { SettingsTabs } from '../frontend/components/settings/SettingsTabs';
import {
  isSettingsPath,
  resolveSettingsContentTab,
} from '../frontend/lib/settings-navigation';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const labels = {
  account: 'Account',
  connections: 'Connected apps',
  privacy: 'Privacy & Safety',
  notifications: 'Notifications',
};

test('settings navigation exposes connected applications as an active, deep-linkable tab', () => {
  const markup = renderToStaticMarkup(
    React.createElement(SettingsTabs, {
      activeTab: 'connections',
      labels,
      notificationsLive: false,
      notificationsSoonLabel: 'Coming soon',
    })
  );
  const document = new JSDOM(markup).window.document;
  const nav = document.querySelector('nav[aria-label="Settings tabs"]');
  const links = [...(nav?.querySelectorAll('a') ?? [])];

  assert.equal(links.length, 4);
  assert.deepEqual(
    links.map((link) => [link.textContent?.trim(), link.getAttribute('href')]),
    [
      ['Account', '/settings'],
      ['Connected apps', '/account/connections'],
      ['Privacy & Safety', '/settings?tab=privacy'],
      ['NotificationsComing soon', '/settings?tab=notifications'],
    ]
  );
  assert.equal(nav?.querySelector('[aria-current="page"]')?.textContent?.trim(), 'Connected apps');
});

test('settings query tabs resolve safely and keep connected-app routes inside Settings', () => {
  assert.equal(resolveSettingsContentTab('privacy'), 'privacy');
  assert.equal(resolveSettingsContentTab('notifications'), 'notifications');
  assert.equal(resolveSettingsContentTab('connections'), 'account');
  assert.equal(resolveSettingsContentTab('unknown'), 'account');

  assert.equal(isSettingsPath('/settings'), true);
  assert.equal(isSettingsPath('/settings/'), true);
  assert.equal(isSettingsPath('/account/connections'), true);
  assert.equal(isSettingsPath('/account/connections/'), true);
  assert.equal(isSettingsPath('/account'), false);
});
