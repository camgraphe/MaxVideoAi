import { expect, test } from '@playwright/test';
import { openMinimalEditorWorkspace } from './editor-helpers';

const viewports = [
  { width: 1440, height: 900 }, { width: 390, height: 844 },
  { width: 320, height: 844 }, { width: 844, height: 390 },
];
const projectLabels = { en: 'Projects', fr: 'Projets', es: 'Proyectos' };

for (const locale of ['en', 'fr', 'es'] as const) {
  for (const viewport of viewports) {
    for (const theme of ['light', 'dark'] as const) {
      test(`Studio fitted canvas ${viewport.width}x${viewport.height} ${theme} ${locale}`, async ({ page, baseURL }, testInfo) => {
        expect(baseURL).toBeTruthy();
        await page.context().addCookies([
          { name: 'mvid_locale', value: locale, url: baseURL! },
          { name: 'NEXT_LOCALE', value: locale, url: baseURL! },
        ]);
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
        await page.addInitScript((selectedTheme) => {
          localStorage.setItem('maxvideoai.studio.theme.v1', selectedTheme);
          localStorage.setItem('maxvideoai.studio.theme.userOverride.v1', 'true');
        }, theme);
        await page.route('**/api/legal/cookies/version', (route) => route.fulfill({ json: { ok: true, version: 'studio-local-fixture', publishedAt: null } }));
        await page.route('**/api/legal/cookies', (route) => route.fulfill({ json: { ok: true } }));
        await openMinimalEditorWorkspace(page);
        await expect(page.locator('header').getByRole('button', { name: projectLabels[locale], exact: true })).toBeVisible();
        await expect(page.locator(`[data-studio-theme="${theme}"]`)).toBeVisible();

        const node = page.locator('.react-flow__node[data-id="minimal-start-video"]');
        await expect(node).toBeVisible();
        await expect(node).toHaveClass(/selected/);
        await expect(node.locator('[class*="nodeHeader"]')).toHaveCount(1);
        await expect(node.locator('[data-shot-generation-action]')).toBeVisible();
        const navigator = page.locator('[data-canvas-navigator="true"]');
        const mapToggle = navigator.locator('button[aria-controls="canvas-map-content"]');
        if (await mapToggle.getAttribute('aria-expanded') !== 'true') await mapToggle.click();
        // The existing three-button zoom group is minus / fit / plus in every locale.
        await navigator.getByRole('group').getByRole('button').nth(1).click();
        await mapToggle.click();
        await expect(mapToggle).toHaveAttribute('aria-expanded', 'false');
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

        const violations = await node.evaluate((element) => {
          const essential = Array.from(element.querySelectorAll<HTMLElement>(
            '[class*="nodeHeader"], [data-shot-generation-action], [data-canvas-node-inspect-button]',
          ));
          const overlays = Array.from(document.querySelectorAll<HTMLElement>(
            '[data-canvas-selection-actions], [data-canvas-floating-toolbar="true"], [data-canvas-navigator="true"], [data-studio-mobile-panel-controls="true"]',
          ));
          const canvas = element.closest('.react-flow')!.getBoundingClientRect();
          return essential.flatMap((control) => {
            const box = control.getBoundingClientRect();
            const name = control.getAttribute('aria-label') ?? control.textContent?.trim().slice(0, 80) ?? control.tagName;
            const outside = box.left < Math.max(0, canvas.left) - 1 || box.right > Math.min(innerWidth, canvas.right) + 1
              || box.top < Math.max(0, canvas.top) - 1 || box.bottom > Math.min(innerHeight, canvas.bottom) + 1;
            const collisions = overlays.flatMap((overlay) => {
              const style = getComputedStyle(overlay);
              const other = overlay.getBoundingClientRect();
              if (style.display === 'none' || style.visibility === 'hidden' || !other.width || !other.height) return [];
              const overlapX = Math.min(box.right, other.right) - Math.max(box.left, other.left);
              const overlapY = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top);
              return overlapX > 1 && overlapY > 1
                ? [{ overlay: overlay.getAttribute('aria-label') ?? overlay.getAttribute('class'), overlapX, overlapY }] : [];
            });
            return !box.width || !box.height || outside || collisions.length ? [{ name, outside, collisions }] : [];
          });
        });
        await testInfo.attach(`fitted-${viewport.width}-${viewport.height}-${theme}-${locale}`, {
          body: await page.screenshot(), contentType: 'image/png',
        });
        // Containment alone also accepts a broken fit clamped to minimum zoom.
        // Compact screens retain an overview plus unscaled selection commands;
        // desktop must leave the two-node starter large enough to inspect directly.
        expect((await node.boundingBox())?.width, 'Fit must not reduce the starter to a postage stamp.')
          .toBeGreaterThanOrEqual(viewport.width >= 1000 ? 160 : 64);
        expect(violations, 'Fit must keep titles and essential actions inside usable canvas, outside floating controls.').toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      });
    }
  }
}
