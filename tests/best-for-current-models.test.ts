import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { BEST_FOR_PAGES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config.ts';

const EXPECTED_SHORTLISTS: Record<string, string[]> = {
  'image-to-video': ['seedance-2-5', 'minimax-h3', 'grok-imagine-video-1-5', 'wan-3-prime', 'kling-o3-pro'],
  'cinematic-realism': ['seedance-2-5', 'wan-3-prime', 'minimax-h3-max', 'minimax-h3', 'kling-o3-pro'],
  'character-reference': ['seedance-2-5', 'kling-o3-pro', 'minimax-h3', 'wan-3-prime', 'grok-imagine-video-1-5'],
  'reference-to-video': ['seedance-2-5', 'minimax-h3', 'wan-3-prime', 'kling-o3-pro', 'grok-imagine-video-1-5'],
  'multi-shot-video': ['seedance-2-5', 'wan-3-prime', 'minimax-h3', 'kling-o3-pro', 'wan-3'],
  '4k-video': ['minimax-h3', 'veo-3-1', 'kling-3-4k', 'veo-3-1-fast', 'seedance-2-0'],
  ads: ['seedance-2-5', 'wan-3-prime', 'minimax-h3', 'kling-o3-pro', 'grok-imagine-video-1-5'],
  'ugc-ads': ['seedance-2-5', 'happy-horse-1-1', 'minimax-h3', 'grok-imagine-video-1-5', 'kling-o3-pro'],
  'product-videos': ['seedance-2-5', 'wan-3-prime', 'minimax-h3-max', 'ltx-2-5-pro', 'kling-o3-pro'],
  'lipsync-dialogue': ['seedance-2-5', 'happy-horse-1-1', 'kling-o3-pro', 'minimax-h3', 'minimax-h3-max'],
  'fast-drafts': ['ltx-2-5-fast', 'minimax-h3-max', 'grok-imagine-video-1-5', 'seedance-2-0-fast', 'kling-3-standard'],
  'stylized-anime': ['seedance-2-5', 'minimax-h3', 'kling-o3-pro', 'grok-imagine-video-1-5', 'ltx-2-5-fast'],
};

const OBSOLETE_RECOMMENDATIONS = new Set([
  'pika-text-to-video',
  'minimax-hailuo-02-text',
  'happy-horse-1-0',
  'dreamina-seedance-2-0-mini',
  'ltx-2-3-fast',
  'ltx-2-3-pro',
]);

const LOCALE_MODEL_PREFIX = {
  en: '/models/',
  fr: '/fr/modeles/',
  es: '/es/modelos/',
} as const;

function extractRankedModelSlugs(source: string, prefix: string): string[] {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\d+\\.\\s+\\*\\*\\[[^\\]]+\\]\\(${escapedPrefix}([^)]+)\\)\\*\\*`, 'gm');
  return Array.from(source.matchAll(pattern), (match) => match[1]);
}

test('best-for rankings replace obsolete recommendations with current frontier models', () => {
  const bySlug = new Map(BEST_FOR_PAGES.map((entry) => [entry.slug, entry.topPicks ?? []]));

  assert.equal(bySlug.size, 12);
  for (const [usecase, expected] of Object.entries(EXPECTED_SHORTLISTS)) {
    assert.deepEqual(bySlug.get(usecase), expected, `${usecase} should expose the approved current shortlist`);
  }

  for (const [usecase, shortlist] of bySlug) {
    assert.equal(
      shortlist.some((slug) => OBSOLETE_RECOMMENDATIONS.has(slug)),
      false,
      `${usecase} should not recommend a replaced model`,
    );
  }
});

test('localized editorial rankings stay aligned with the shortlist cards', () => {
  for (const [usecase, expected] of Object.entries(EXPECTED_SHORTLISTS)) {
    for (const [locale, prefix] of Object.entries(LOCALE_MODEL_PREFIX)) {
      const source = readFileSync(path.join(process.cwd(), `content/${locale}/best-for/${usecase}.mdx`), 'utf8');
      assert.deepEqual(
        extractRankedModelSlugs(source, prefix),
        expected,
        `${locale}/${usecase} should describe the same ranked models as the UI cards`,
      );
    }
  }
});
