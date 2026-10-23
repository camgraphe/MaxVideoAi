import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import tailwindConfig from '../frontend/tailwind.config';

test(
  'marketing admin handles copy, retry, placement protection and reuse at mobile and desktop widths',
  { timeout: 120000 },
  async () => {
    const frontend = join(process.cwd(), 'frontend');
    const requireFrontend = createRequire(join(frontend, 'package.json'));
    const source = `import React from 'react';import {createRoot} from 'react-dom/client';import {MarketingMediaLibrary} from './app/(core)/admin/marketing-media/_components/MarketingMediaLibrary.client';createRoot(document.getElementById('root')).render(<main className="admin-workspace p-4"><MarketingMediaLibrary initialVideoId="stable-video"/></main>);`;
    const bundle = await build({
      absWorkingDir: frontend,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      jsx: 'automatic',
      define: { 'process.env': '{"NODE_ENV":"production"}' },
      write: false,
      stdin: { contents: source, loader: 'tsx', resolveDir: frontend },
      tsconfig: join(frontend, 'tsconfig.json'),
      plugins: [
        {
          name: 'auth-transport',
          setup(b) {
            b.onResolve({ filter: /^@\/lib\/authFetch$/ }, () => ({ path: 'auth', namespace: 'test' }));
            b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
              contents: 'export const authFetch=(...args)=>fetch(...args);',
            }));
          },
        },
      ],
    });
    const styles = await Promise.all(
      ['app/globals.css', 'src/styles/tokens.css', 'components/admin-system/shell/admin-workspace.css'].map((path) =>
        readFile(join(frontend, path), 'utf8'),
      ),
    );
    const css = await requireFrontend('postcss')([
      requireFrontend('tailwindcss')({
        ...tailwindConfig,
        content: [
          ...tailwindConfig.content.map((pattern: string) => join(frontend, pattern)),
          { raw: source, extension: 'tsx' },
        ],
      }),
    ]).process(styles.join('\n').replace(/@(import|config)[^;]+;/g, ''), { from: join(frontend, 'app/globals.css') });
    const server = createServer((req, res) => {
      const script = req.url === '/fixture.js',
        style = req.url === '/fixture.css';
      res.setHeader('Content-Type', script ? 'text/javascript' : style ? 'text/css' : 'text/html');
      res.end(
        script
          ? bundle.outputFiles[0].text
          : style
            ? css.css
            : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>',
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      for (const width of [390, 1440]) {
        let items: any[] = [];
        let posts = 0;
        let mediaRequests = 0;
        await page.unrouteAll({ behavior: 'wait' });
        await page.route('**/api/admin/**', async (route) => {
          const req = route.request();
          let body: unknown = { ok: true, items, nextOffset: null };
          let status = 200;
          if (req.method() === 'POST') {
            posts++;
            await new Promise((r) => setTimeout(r, 200));
            if (posts === 1) {
              status = 502;
              body = { ok: false, error: 'Reference unavailable. Retry the copy.' };
            } else {
              items = [
                {
                  videoId: 'stable-video',
                  state: 'ready',
                  visibility: 'public',
                  prompt: 'Exact original prompt',
                  engineLabel: 'Luma',
                  sizeBytes: 123456,
                  createdAt: '2026-10-22',
                  videoUrl: '/fixture.mp4',
                  placements: [{ kind: 'playlist', label: 'Homepage collection', href: '/admin/playlists' }],
                },
              ];
              body = { ok: true, item: items[0] };
            }
          }
          if (req.method() === 'DELETE') {
            status = 409;
            body = { ok: false, error: 'This media is still used on the site.' };
          }
          await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        });
        await page.route('**/*.mp4', (route) => {
          mediaRequests++;
          return route.abort();
        });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`http://127.0.0.1:${address.port}`);
        await page.getByText('No marketing media yet.').waitFor();
        await page.getByLabel(/permission to use/).check();
        await page.getByRole('button', { name: 'Add to marketing media', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Copying…' }).isDisabled(), true);
        await page.getByRole('alert').filter({ hasText: 'Reference unavailable' }).waitFor();
        assert.equal(await page.getByLabel('Video ID or link').inputValue(), 'stable-video');
        await page.getByRole('button', { name: 'Add to marketing media', exact: true }).click();
        await page.getByRole('link', { name: 'Reuse settings' }).waitFor();
        assert.equal(
          await page.getByRole('link', { name: 'Reuse settings' }).getAttribute('href'),
          '/app?from=stable-video',
        );
        assert.equal(await page.getByRole('button', { name: 'Delete copy', exact: true }).isDisabled(), true);
        assert.equal(mediaRequests, 0, 'no original video request before explicit Play');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await mkdir('output/marketing-media', { recursive: true });
        await page.screenshot({ path: `output/marketing-media/admin-${width}.png`, fullPage: true });
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    }
  },
);
