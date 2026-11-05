import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';

const source = `
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from './lib/i18n/I18nProvider';
import { WorkspaceBootSurface } from './app/(core)/(workspace)/app/_components/WorkspaceBootSurface';
import { WorkspaceAppShell } from './app/(core)/(workspace)/app/_components/WorkspaceAppShell';

const group = { id: 'personal', layout: 'x1', provider: 'fal', status: 'ready', items: [
  { id: 'last', jobId: 'last', aspect: '9:16', url: '/never-played.mp4',
    thumb: '/fixture-poster.svg', meta: { mediaType: 'video', status: 'completed' } }
] };
function Fixture() {
  const [ready, setReady] = useState(false);
  return <I18nProvider locale="en" dictionary={{}} fallback={{}}>
    <button style={{position:'fixed',right:0,bottom:0,zIndex:99}} onClick={() => setReady(true)}>Finish loading</button>
    {ready ? <WorkspaceAppShell displayCompositeGroup={group} modeLabelLocale="en" recentMedia={<span />}
      normalizedPendingGroups={[]} renderGroups={new Map()} engines={[]} engineId="fixture" selectedEngineId="fixture" activeMode="t2v" composerSurface={<span data-editor-ready />} />
      : <WorkspaceBootSurface initialPreviewGroup={group} />}
  </I18nProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);`;

// Use real video boot, ready shell, dock and CSS. Account/network readers are irrelevant to placement.
test('the personal poster keeps its position when the video editor replaces the boot surface', { timeout: 60_000 }, async () => {
  const fixture = await startWorkspaceReferenceFixture({ source, config: {}, assistanceLive: true, hostModules: {
    '@/components/HeaderBar': 'export function HeaderBar() { return <header className="app-connected-header" />; }',
    '@/components/AppSidebar': 'export function AppSidebar() { return null; }',
    './AppNavigation.client': 'export function AppNavigation() { return <nav className="app-navigation-activities" />; }',
    '@/components/GalleryRail': 'export function GalleryRail() { return <aside />; }',
    '@/components/EngineSettingsBar': 'export function EngineSettingsBar() { return null; }',
    '@/components/composer/WorkspaceComposerModel.client': 'export function WorkspaceComposerModel() { return null; }',
  } });
  const browser = await chromium.launch();
  try {
    for (const viewport of [{ width: 412, height: 823 }, { width: 1440, height: 900 }]) {
      const page = await browser.newPage({ viewport });
      try {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/fixture-poster.svg', route => route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="160"><rect width="90" height="160" fill="#ca7"/></svg>',
        }));
        await page.goto(fixture.url);
        assert.deepEqual(errors, []);
        const poster = page.locator('main [data-workspace-preview-media] figure img');
        await expect(poster).toBeVisible();
        const before = await poster.boundingBox();
        await page.getByRole('button', { name: 'Finish loading' }).click();
        await expect.poll(async () => errors[0] ?? await page.locator('[data-editor-ready]').count()).toBe(1);
        await expect(poster).toBeVisible();
        const after = await poster.boundingBox();
        assert.ok(before && after);
        for (const key of ['x', 'y', 'width', 'height'] as const) {
          assert.ok(Math.abs(after[key] - before[key]) <= 2,
            `${viewport.width}px poster ${key} changed from ${before[key]} to ${after[key]}`);
        }
      } finally { await page.close(); }
    }
  } finally {
    await browser.close();
    await fixture.close();
  }
});
