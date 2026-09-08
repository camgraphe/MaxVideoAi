import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HeaderWalletStatus } from '../frontend/components/header/HeaderWalletStatus';
import { getAppNavigation, getAppMenuItems, getAppNavigationSelection } from '../frontend/components/app/app-navigation';

test('creation activities select Create together without selecting unrelated app pages', () => {
  for (const [path, activity] of [['/app', 'video'], ['/app/', 'video'], ['/app/image', 'image'], ['/app/audio', 'audio']]) {
    assert.deepEqual(getAppNavigationSelection(path), { primary: 'create', activity });
  }
  for (const [path, primary] of [['/app/library', 'media'], ['/app/tools/angle', 'tools'], ['/jobs', 'activity'], ['/dashboard', 'account'], ['/settings', 'account'], ['/account/connections', 'account'], ['/billing', 'account']]) {
    assert.deepEqual(getAppNavigationSelection(path), { primary, activity: null });
  }
  for (const path of [null, undefined, '/', '/fr', '/login', '/admin', '/mcp', '/application', '/settings-other', '/app/unknown']) {
    assert.deepEqual(getAppNavigationSelection(path), { primary: null, activity: null });
  }
});

test('every existing destination keeps a named complete-menu path and tools obey their flag', () => {
  const expected = ['/app', '/app/image', '/app/audio', '/app/library', '/jobs', '/dashboard', '/settings', '/account/connections', '/billing', '/app/tools', '/app/tools/character-builder', '/app/tools/storyboard', '/app/tools/angle', '/app/tools/upscale', '/app/tools/background-removal'];
  const menu = getAppMenuItems(true, true);
  for (const href of expected) assert.ok(menu.some((item) => item.href === href && item.label.length), href);
  assert.equal(new Set(menu.map((item) => item.href)).size, menu.length);
  assert.deepEqual(getAppNavigation(true).map((item) => item.id), ['create', 'media', 'tools', 'activity', 'account']);
  assert.deepEqual(getAppNavigation(true, true).map((item) => item.id), ['create', 'studio', 'media', 'tools', 'activity', 'account']);
  assert.deepEqual(getAppNavigation(false, true).map((item) => item.id), ['create', 'studio', 'media', 'activity', 'account']);
  assert.deepEqual(getAppNavigationSelection('/app/studio/projects'), { primary: null, activity: null });
  assert.deepEqual(getAppNavigationSelection('/app/studio/projects', true, true), { primary: 'studio', activity: null });
  assert.deepEqual(getAppNavigationSelection('/app/studio/workspace/project_123', true, true), { primary: 'studio', activity: null });
  assert.ok(getAppMenuItems(false, true).every((item) => !item.href.startsWith('/app/tools')));
  assert.deepEqual(getAppNavigationSelection('/app/tools/angle', false), { primary: null, activity: null });
  assert.ok(menu.some((item) => item.id === 'studio' && item.href === '/app/studio/projects'));
  assert.ok(getAppMenuItems(true, false).every((item) => item.id !== 'studio'));
});

test('app shell keeps account authority, localized separate public links, and native dialog focus', async () => {
  const { readFileSync } = await import('node:fs');
  const header = readFileSync('frontend/components/HeaderBar.tsx', 'utf8');
  const menu = readFileSync('frontend/components/app/AppSiteMenu.client.tsx', 'utf8');
  const navigation = readFileSync('frontend/components/app/AppNavigation.client.tsx', 'utf8');
  const css = readFileSync('frontend/src/styles/app-shell.css', 'utf8');
  assert.equal((header.match(/useHeaderAccountState\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(menu, /fetch\(|useHeaderAccountState|supabase/);
  assert.match(menu, /getPathname\(\{ locale, href: item.href \}\)/);
  assert.match(menu, /target="_blank" rel="noopener noreferrer"/);
  assert.match(menu, /\/assets\/branding\/logo-mark\.svg/);
  assert.match(menu, /showModal\(\)/);
  assert.match(menu, /addEventListener\('close', restoreFocus\)/);
  assert.match(menu, /openerRef\.current\?\.focus\(\)/);
  assert.match(navigation, /getAppNavigationSelection\(pathname, undefined, studioVisible\)/);
  assert.match(css, /\.app-experience \.app-site-dialog\[open\] \{ display: flex; flex-direction: column;/);
  assert.match(css, /\.app-site-dialog-body \{ min-height: 0;[^}]*overflow-y: auto/);
  assert.match(css, /\.app-navigation-mobile \{ position: fixed; bottom: 0;/);
});

test('wallet retains its real billing destination and distinguishes zero from missing balances in each locale', async () => {
  const { readFileSync } = await import('node:fs');
  Object.assign(globalThis, { React });
  for (const [locale, loading, unavailable] of [['en', 'Loading…', 'Unavailable'], ['fr', 'Chargement…', 'Indisponible'], ['es', 'Cargando…', 'No disponible']]) {
    const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    const t = (key: string, fallback: string) => key.split('.').reduce((obj, part) => obj?.[part], dictionary) ?? fallback;
    for (const [walletLoading, wallet, expected] of [[true, null, loading], [false, null, unavailable], [false, { balance: 0 }, '$0.00'], [false, { balance: 12.3 }, '$12.30']] as const) {
      const markup = renderToStaticMarkup(React.createElement(HeaderWalletStatus, { walletLoading, wallet, t, promptId: 'wallet', walletPromptOpen: false, onOpenPrompt() {}, onSchedulePromptClose() {} }));
      assert.ok(markup.includes(`aria-label="Wallet: ${expected}"`), `${locale}: ${expected}`);
      assert.match(markup, /href="\/billing"/);
      if (!wallet) assert.ok(!markup.includes('$0.00'));
    }
  }
  for (const [walletLoading, expected] of [[true, 'Loading…'], [false, 'Unavailable']] as const) {
    const markup = renderToStaticMarkup(React.createElement(HeaderWalletStatus, { walletLoading, wallet: null, t: () => undefined, promptId: 'wallet', walletPromptOpen: false, onOpenPrompt() {}, onSchedulePromptClose() {} }));
    assert.ok(markup.includes(`aria-label="Wallet: ${expected}"`));
  }
});
