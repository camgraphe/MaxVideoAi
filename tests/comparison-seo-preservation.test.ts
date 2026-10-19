import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import en from '../frontend/messages/en.json';
import fr from '../frontend/messages/fr.json';
import es from '../frontend/messages/es.json';
import catalog from '../frontend/config/engine-catalog.json';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const owners = './frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/';

test('comparison descriptions announce the criteria actually available in the scorecard', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'comparison-seo-'));
  const output = join(directory, 'owners.cjs');
  const dictionaries = JSON.stringify({ en, fr, es });
  try {
    await build({
      stdin: { contents: 'export {buildComparePageMetadata} from "' + owners + 'compare-page-metadata";export {buildCompareWebPageJsonLd} from "' + owners + 'compare-page-schema";export {buildComparisonMetrics} from "' + owners + 'compare-page-scorecard";export {getPublishedComparisonSlugs} from "./frontend/lib/compare-hub/data";export {resolveEngines} from "' + owners + 'compare-page-routing";', resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
      plugins: [{ name: 'dictionary-request-boundary', setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/i18n\/server$/ }, () => ({ path: 'dictionary', namespace: 'request' }));
        builder.onLoad({ filter: /.*/, namespace: 'request' }, () => ({ contents: 'const dictionaries=' + dictionaries + ';export async function resolveDictionary({locale}){return {dictionary:dictionaries[locale]};}', loader: 'js' }));
        builder.onResolve({ filter: /^@\/(?:server\/videos|lib\/db)$/ }, args => ({ path: args.path, namespace: 'unused-io' }));
        builder.onLoad({ filter: /.*/, namespace: 'unused-io' }, () => ({ contents: 'export const isDatabaseConfigured=()=>false;function unavailable(){throw new Error("Metadata must not perform database or video I/O");}export {unavailable as getPublicVideosByIds,unavailable as query,unavailable as withDbTransaction,unavailable as createQueryExecutor,unavailable as getDb,unavailable as isTransactionQueryExecutor};', loader: 'js' }));
        builder.onResolve({ filter: /^[^./]/ }, args => {
          if (!args.path.startsWith('@/') && !args.path.startsWith('node:')) return { path: requireFrontend.resolve(args.path), external: true };
        });
      } }],
    });
    const { buildComparePageMetadata, buildCompareWebPageJsonLd, buildComparisonMetrics, getPublishedComparisonSlugs, resolveEngines } = requireFrontend(output);
    const descriptions = {
      en: 'Compare Gemini Omni Flash 1.1 vs Google Veo 3.1 Fast on MaxVideoAI with key specs, and a scorecard across 10 criteria.',
      fr: 'Comparez Gemini Omni Flash 1.1 vs Google Veo 3.1 Fast sur MaxVideoAI avec des caractéristiques clés et une grille de scores sur 10 critères.',
      es: 'Compara Gemini Omni Flash 1.1 vs Google Veo 3.1 Fast en MaxVideoAI con specs clave y un scorecard en 10 criterios.',
    };
    for (const locale of ['en', 'fr', 'es'] as const) await t.test(locale + ' generic description, Open Graph and Twitter', async () => {
      const metadata = await buildComparePageMetadata({ params: Promise.resolve({ locale, slug: 'gemini-omni-flash-vs-veo-3-1-fast' }) });
      assert.equal(metadata.description, descriptions[locale]);
      assert.equal(metadata.openGraph.description, descriptions[locale]);
      assert.equal(metadata.twitter.description, descriptions[locale]);
    });
    await t.test('authored English 11-point wording announces the displayed count', async () => {
      const metadata = await buildComparePageMetadata({ params: Promise.resolve({ locale: 'en', slug: 'kling-2-6-pro-vs-ltx-2' }) });
      assert.match(metadata.description, /a 10-criterion scorecard/);
      assert.equal(metadata.openGraph.description, metadata.description);
      assert.equal(metadata.twitter.description, metadata.description);
    });
    const left = catalog.find(entry => entry.modelSlug === 'gemini-omni-flash')!;
    const right = catalog.find(entry => entry.modelSlug === 'veo-3-1-fast')!;
    for (const pairHasNativeAudio of [true, false]) await t.test('WebPage description matches the ' + (pairHasNativeAudio ? 'audio' : 'silent') + ' scorecard', () => {
      const schema = buildCompareWebPageJsonLd({ compareCopy: en.comparePage, comparisonCanonicalUrl: 'https://maxvideoai.com/ai-video-engines/gemini-omni-flash-vs-veo-3-1-fast', pairHasNativeAudio, left, right, pairHasKling3Native4k: false });
      const metrics = buildComparisonMetrics({ compareCopy: en.comparePage, pairHasNativeAudio, leftScore: null, rightScore: null, speedScores: { leftScore: null, rightScore: null } });
      assert.equal(metrics.length, pairHasNativeAudio ? 10 : 9);
      assert.match(schema.description, new RegExp('\\b' + metrics.length + ' criteria\\b'));
      const authored = buildCompareWebPageJsonLd({ compareCopy: en.comparePage, comparisonCanonicalUrl: 'https://maxvideoai.com/ai-video-engines/gemini-omni-flash-vs-veo-3-1-fast', pairHasNativeAudio, left, right, pairHasKling3Native4k: false, metaOverride: { description: 'Compare {left} vs {right} with an 11-point scorecard.' } });
      assert.equal(authored.description, 'Compare Gemini Omni Flash 1.1 vs Google Veo 3.1 Fast with a ' + metrics.length + '-criterion scorecard.');
    });
    await t.test('all published pairs keep metadata counts aligned with their real scorecard in each locale', async () => {
      for (const slug of getPublishedComparisonSlugs()) {
        const pair = resolveEngines(slug);
        assert.ok(pair, slug);
        const pairHasNativeAudio = Boolean(pair.left.engine?.audio) || Boolean(pair.right.engine?.audio);
        const metrics = buildComparisonMetrics({ compareCopy: en.comparePage, pairHasNativeAudio, leftScore: null, rightScore: null, speedScores: { leftScore: null, rightScore: null } });
        for (const locale of ['en', 'fr', 'es'] as const) {
          const metadata = await buildComparePageMetadata({ params: Promise.resolve({ locale, slug }) });
          const description = metadata.description ?? '';
          const count = description.match(/\b(\d+)(?: criteria\b| critères\b| criterios\b|-point scorecard\b|-criterion scorecard\b)/)?.[1];
          if (count) assert.equal(Number(count), metrics.length, locale + ' ' + slug + ': ' + description);
          assert.equal(metadata.openGraph.description, description);
          assert.equal(metadata.twitter.description, description);
        }
      }
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
