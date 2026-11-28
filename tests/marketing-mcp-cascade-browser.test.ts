import './helpers/server-view-styles';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import tailwindConfig from '../frontend/tailwind.config';
import { McpPageView } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpPageView';
import { IntegrationPageView } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationPageView';
import { getMcpPageCopy } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy';
import { getIntegrationCopy } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy';
import { getMcpCompatibilityEvidence } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility';
import { getMcpHostProof } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-host-proof';
import { GlamaDirectoryGuide } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/GlamaDirectoryGuide';
import { getMcpPublicIntegrationIds } from '../frontend/lib/mcp-integration-registry';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const publication = { renderPublicPage: true, connectionAvailable: true, indexable: true,
  showTrialClaim: false, showPaidGenerationClaim: true, showReferenceClaim: true };

test('real MCP views retain their computed layout when route CSS arrives after the shared styles', async () => {
  const frontend = resolve('frontend');
  const require = createRequire(join(frontend, 'package.json'));
  const paths = ['app/globals.css', 'src/styles/tokens.css', 'src/styles/skeleton.css'];
  // This fixture injects the production config with absolute content paths.
  // Remove file-level config selection; public-prose-styles tests the real @config boundary.
  const source = (await Promise.all(paths.map(path => readFile(join(frontend, path), 'utf8')))).join('\n').replace(/^@(?:import|config) .*;$/gm, '');
  const base = (await require('postcss')([require('tailwindcss')({ ...tailwindConfig,
    content: tailwindConfig.content.map(path => join(frontend, path)) })]).process(source, { from: undefined })).css;
  const common = (await Promise.all(['marketing-redesign', 'marketing-cinema', 'marketing-navigation']
    .map(style => readFile(join(frontend, `src/styles/${style}.css`), 'utf8')))).join('\n');
  const mcp = (await Promise.all(['marketing-mcp', 'marketing-mcp-hub', 'marketing-integration-guides'].map(style => readFile(join(frontend, `src/styles/${style}.css`), 'utf8')))).join('\n');
  const compatibility = getMcpCompatibilityEvidence();
  const browser = await chromium.launch({ headless: true });
  let scenarios = 0;
  let nativeGuideScreens = 0;
  let hubScreens = 0;
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      // This fixture isolates the cascade. Built-route checks separately cover
      // original assets, first-load stylesheet delivery and real SPA navigation.
      await page.route('**/*', route => route.fulfill(route.request().resourceType() === 'document'
        ? { contentType: 'text/html', body: '<html><body></body></html>' }
        : { contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="615"/>' }));
      // An intercepted loopback origin resolves controlled relative resources without a server.
      await page.goto('http://localhost/__mcp_css_fixture__');
      for (const locale of ['en', 'fr', 'es'] as const) {
        const views = [React.createElement(McpPageView, { compatibility, copy: getMcpPageCopy(locale),
          locale, publication, hostProof: getMcpHostProof('claude', locale) }),
        ...getMcpPublicIntegrationIds().map(client => React.createElement(IntegrationPageView, {
          copy: getIntegrationCopy(locale, client), compatibility: compatibility.clients[client]!,
          locale, publication, hostProof: getMcpHostProof(client, locale) })),
          React.createElement(GlamaDirectoryGuide, { locale, connectionAvailable: true })];
        for (const [index, view] of views.entries()) {
          const markup = renderToStaticMarkup(view);
          await page.setContent(`<html lang="${locale}"><head><style>${base}</style><style id="cascade"></style></head><body><div class="marketing-site"><main>${markup}</main></div></body></html>`);
          const snapshots = [];
          for (const styles of [mcp + '\n' + common, common + '\n' + mcp]) {
            await page.evaluate(css => { document.getElementById('cascade')!.textContent = css; }, styles);
            snapshots.push(await page.evaluate(async () => {
              await document.fonts.ready;
              for (const element of document.querySelectorAll('main *')) element.getBoundingClientRect();
              await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
              return [...document.querySelectorAll('main .container-page, main h1, main h2, main h3')].map(el => {
                const box = el.getBoundingClientRect(), css = getComputedStyle(el);
                return { tag: el.tagName, class: el.getAttribute('class'),
                  geometry: [box.x, box.y, box.width, box.height],
                  maxWidth: css.maxWidth, lineHeight: css.lineHeight, letterSpacing: css.letterSpacing };
              });
            }));
          }
          assert.deepEqual(snapshots[1], snapshots[0], `${locale}/${index} at ${width}px: direct and retained-shared CSS orders differ`);
          const screen = await page.evaluate(() => {
            const native = document.querySelector('.guide-native-capture');
            const hub = document.querySelector('.hub-screenshot');
            const el = native ?? hub;
            if (!el) return null;
            const box = el.getBoundingClientRect();
            return { kind: native ? 'guide' : 'hub', width: box.width, right: box.right, left: box.left };
          });
          if (screen) {
            assert.ok(screen.width > 100 && screen.left >= 0 && screen.right <= width + 1, 'native proof should fit the viewport');
            if (screen.kind === 'guide') nativeGuideScreens++;
            else hubScreens++;
          }
          scenarios++;
        }
      }
      await context.close();
    }
    assert.equal(scenarios, 42);
    assert.equal(nativeGuideScreens, 30);
    assert.equal(hubScreens, 6);
  } finally { await browser.close(); }
});
