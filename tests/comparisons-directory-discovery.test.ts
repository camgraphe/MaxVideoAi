import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { getHubEngines, getRankedComparisonPairs } from '../frontend/lib/compare-hub/data';
import { isComparisonIndexable } from '../frontend/lib/compare-hub/indexation';
import { getHubCopy } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-copy';

const requireFrontend = createRequire(resolve('frontend/package.json'));

test('every eligible comparison has a localized HTML anchor before interaction', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'comparison-discovery-'));
  try {
    const output = join(directory, 'directory.cjs');
    await build({
      entryPoints: ['frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/ComparisonsDirectory.client.tsx'],
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external',
      tsconfig: 'frontend/tsconfig.json', jsx: 'automatic',
      plugins: [{ name: 'frontend-packages', setup(builder) {
        builder.onResolve({ filter: /^[^./]/ }, args => {
          if (!args.path.startsWith('@/')) return { path: requireFrontend.resolve(args.path), external: true };
        });
      } }],
    });
    const React = requireFrontend('react');
    const { renderToStaticMarkup } = requireFrontend('react-dom/server');
    const { NextIntlClientProvider } = requireFrontend('next-intl');
    const { ComparisonsDirectory } = requireFrontend(output);
    for (const locale of ['en', 'fr', 'es'] as const) await t.test(locale, () => {
      const entries = getRankedComparisonPairs(getHubEngines({ includeLimited: true, includeWaitlist: true }))
        .filter(pair => isComparisonIndexable(locale, pair.slug));
      assert.ok(entries.some(entry => entry.slug === 'minimax-h3-vs-minimax-h3-max'));
      assert.equal(entries.some(entry => entry.slug.includes('seedance-1-5-pro')), false, 'archives retain their separate discovery policy');
      assert.ok(entries.length > 24, 'exercise destinations beyond the first batch');
      const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {
        locale, messages: {}, timeZone: 'UTC',
      }, React.createElement(ComparisonsDirectory, { entries, labels: getHubCopy(locale).listLabels })));
      const dom = new JSDOM(html);
      try {
        const doc = dom.window.document;
        const base = { en: '/ai-video-engines', fr: '/fr/comparatif', es: '/es/comparativa' }[locale];
        assert.deepEqual([...doc.querySelectorAll('a')].map(a => a.getAttribute('href')), entries.map(entry => `${base}/${entry.slug}`));
        assert.equal(doc.querySelectorAll('details a').length, entries.length - 24);
        assert.equal(doc.querySelector('details')?.hasAttribute('open'), false, 'keep the opening compact');
        assert.ok(doc.querySelector('details > summary'), 'the rest opens with native HTML without JavaScript');
        assert.equal(doc.querySelectorAll('img,video,iframe').length, 0, 'discovery adds no media readers');
      } finally { dom.window.close(); }
    });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
