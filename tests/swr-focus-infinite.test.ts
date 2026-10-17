import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

async function buildFixture() {
  const frontend = resolve('frontend');
  const output = await build({
    absWorkingDir: frontend, bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', write: false,
    tsconfig: resolve('frontend/tsconfig.json'), define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'navigation-host', setup(builder) {
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'host' }));
      builder.onLoad({ filter: /.*/, namespace: 'host' }, () => ({
        contents: 'export function usePathname(){return window.location.pathname;}',
      }));
    } }],
    stdin: { loader: 'tsx', resolveDir: frontend, contents: `
      import React, { act } from 'react';
      import { createRoot } from 'react-dom/client';
      import useSWRInfinite from 'swr/infinite';
      import { SWRProvider } from './components/swr/SWRProvider';
      import { SWRFocusResync } from './components/swr/SWRFocusResync';
      const root = createRoot(document.getElementById('root'));
      function Consumer() {
        const jobs = useSWRInfinite((index, previous) => {
          if (previous && !previous.nextCursor) return null;
          return ['jobs', 'account', 20, index === 0 ? null : previous.nextCursor];
        }, async ([,,, cursor]) => {
          window.host.jobReads.push(cursor);
          return { jobs: [cursor ? 'job-2' : 'job-1'], nextCursor: cursor ? null : 'next' };
        }, { keepPreviousData: false, persistSize: false, dedupingInterval: 0 });
        const library = useSWRInfinite((index, previous) => {
          if (previous && !previous.nextCursor) return null;
          return '/api/media-library/assets?cursor='+(index === 0 ? '' : previous.nextCursor);
        }, async (url) => {
          window.host.libraryReads.push(url);
          return { assets: [url.endsWith('next') ? 'asset-2' : 'asset-1'], nextCursor: url.endsWith('next') ? null : 'next' };
        }, { revalidateOnFocus: false, revalidateFirstPage: false, dedupingInterval: 0 });
        window.fixture.loadMore = async () => act(async () => { await Promise.all([jobs.setSize(2), library.setSize(2)]); });
        return <output data-jobs={jobs.data?.flatMap(page => page.jobs).join(',') ?? ''}
          data-assets={library.data?.flatMap(page => page.assets).join(',') ?? ''} />;
      }
      window.fixture = {
        async render(path) {
          window.history.replaceState(null, '', path);
          await act(async () => root.render(<SWRProvider><SWRFocusResync/><Consumer/></SWRProvider>));
        },
        async focus() { await act(async () => { window.dispatchEvent(new Event('focus')); await new Promise(resolve => setTimeout(resolve, 10)); }); },
        async unmount() { await act(async () => root.unmount()); },
      };
    ` },
  });
  return output.outputFiles[0].text;
}

for (const initialPath of ['/app', '/login']) {
  test(`Infinite lists load, paginate and retain focus policy from ${initialPath}`, async () => {
    const dom = new JSDOM('<div id="root"></div>', { url: `https://maxvideoai.com${initialPath}`, runScripts: 'outside-only' });
    const win = dom.window as JSDOM['window'] & {
      IS_REACT_ACT_ENVIRONMENT: boolean;
      host: { jobReads: (string | null)[]; libraryReads: string[] };
      fixture: { render(path: string): Promise<void>; focus(): Promise<void>; loadMore(): Promise<void>; unmount(): Promise<void> };
    };
    Object.defineProperty(win, 'MessageChannel', { value: class {
      port1 = { onmessage: () => {} };
      port2 = { postMessage: () => setImmediate(() => this.port1.onmessage()) };
    } });
    Object.defineProperty(win.document, 'visibilityState', { value: 'visible' });
    win.IS_REACT_ACT_ENVIRONMENT = true;
    win.host = { jobReads: [], libraryReads: [] };
    let now = 10_000;
    win.Date.now = () => now;
    win.eval(await buildFixture());
    const output = () => win.document.querySelector('output') as HTMLOutputElement;
    try {
      await win.fixture.render(initialPath);
      assert.deepEqual([...win.host.jobReads], [null], 'Activity fetches its initial page');
      assert.equal(win.host.libraryReads.length, 1, 'library fetches its initial page');
      assert.equal(output().dataset.jobs, 'job-1');
      assert.equal(output().dataset.assets, 'asset-1');

      await win.fixture.loadMore();
      assert.equal(output().dataset.jobs, 'job-1,job-2');
      assert.equal(output().dataset.assets, 'asset-1,asset-2');
      assert.equal(win.host.jobReads.at(-1), 'next');
      assert.equal(win.host.libraryReads.length, 2);

      const jobReads = win.host.jobReads.length;
      const libraryReads = win.host.libraryReads.length;
      await win.fixture.render('/app');
      assert.equal(output().dataset.jobs, 'job-1,job-2', 'route transitions preserve both loaded pages');
      assert.equal(output().dataset.assets, 'asset-1,asset-2');
      assert.equal(win.host.jobReads.length, jobReads, 'route transitions do not refetch or disable Infinite');
      now += 6_000;
      await win.fixture.focus();
      assert.equal(win.host.jobReads.length, jobReads + 1, 'Activity keeps one native focus refresh');
      assert.equal(win.host.jobReads.at(-1), null, 'focus refreshes only the first Activity page');
      assert.equal(win.host.libraryReads.length, libraryReads, 'paginated library keeps its focus opt-out');
      assert.equal(output().dataset.jobs, 'job-1,job-2');
    } finally {
      await win.fixture.unmount();
      dom.window.close();
    }
  });
}
