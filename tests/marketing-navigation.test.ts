import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  MARKETING_NAV_BEST_FOR_HUB,
  MARKETING_NAV_BEST_FOR_USE_CASES,
  MARKETING_NAV_DROPDOWNS,
  MARKETING_TOP_NAV_LINKS,
} from '../frontend/config/navigation.ts';

const marketingNavSource = readFileSync('frontend/components/marketing/MarketingNav.tsx', 'utf8');

const bestForUseCaseLinks = [
  ['Cinematic realism', '/ai-video-engines/best-for/cinematic-realism'],
  ['Image-to-video', '/ai-video-engines/best-for/image-to-video'],
  ['Fast drafts', '/ai-video-engines/best-for/fast-drafts'],
  ['Product ads', '/ai-video-engines/best-for/ads'],
] as const;

const hrefPath = (href: unknown) => {
  if (typeof href === 'string') return href;
  if (href && typeof href === 'object' && 'pathname' in href) {
    const pathname = String((href as { pathname: string }).pathname);
    const params = (href as { params?: Record<string, string> }).params;
    if (params?.usecase) {
      return pathname.replace('[usecase]', params.usecase);
    }
    return pathname;
  }
  return '';
};

test('marketing top navigation stays clean while Best-For links live inside dropdowns', () => {
  assert.deepEqual(
    MARKETING_TOP_NAV_LINKS.map((item) => item.key),
    ['models', 'examples', 'compare', 'tools', 'pricing', 'blog']
  );

  const modelsDropdown = MARKETING_NAV_DROPDOWNS.models as {
    sections?: Array<{
      titleFallback?: string;
      hideTitle?: boolean;
      items: Array<{ label: string; href: unknown; emphasized?: boolean }>;
    }>;
  };
  const modelsUseCases = modelsDropdown.sections?.[0];
  assert.ok(modelsUseCases, 'Models dropdown should expose use-case guide links');
  assert.equal(modelsUseCases.hideTitle, true);
  assert.notEqual(modelsUseCases.titleFallback, 'Choose by use case');
  assert.deepEqual(
    modelsUseCases.items.map((item) => [item.label, hrefPath(item.href), Boolean(item.emphasized)]),
    [
      ['All use-case guides', '/ai-video-engines/best-for', true],
      ...bestForUseCaseLinks.map(([label, href]) => [label, href, false] as const),
    ]
  );

  const compareDropdown = MARKETING_NAV_DROPDOWNS.compare as {
    sections?: Array<{
      titleFallback?: string;
      hideTitle?: boolean;
      items: Array<{ label: string; href: unknown; emphasized?: boolean }>;
    }>;
  };
  const compareUseCases = compareDropdown.sections?.[0];
  assert.ok(compareUseCases, 'Compare dropdown should expose decision guide links');
  assert.equal(compareUseCases.hideTitle, true);
  assert.notEqual(compareUseCases.titleFallback, 'Decision guides');
  assert.deepEqual(
    compareUseCases.items.map((item) => [item.label, hrefPath(item.href), Boolean(item.emphasized)]),
    [
      ['Best models by use case', '/ai-video-engines/best-for', true],
      ...bestForUseCaseLinks.map(([label, href]) => [label, href, false] as const),
    ]
  );

  assert.match(marketingNavSource, /entry\.emphasized/);
  assert.match(marketingNavSource, /font-semibold text-text-primary/);
});

test('marketing footer keeps crawlable Best-For hub and priority child links', () => {
  assert.equal(hrefPath(MARKETING_NAV_BEST_FOR_HUB.href), '/ai-video-engines/best-for');
  assert.deepEqual(
    MARKETING_NAV_BEST_FOR_USE_CASES.map((item) => [item.label, hrefPath(item.href)]),
    bestForUseCaseLinks
  );
});

test('marketing footer separates Best-For use cases from popular comparisons', () => {
  const source = readFileSync('frontend/components/marketing/MarketingFooter.tsx', 'utf8');
  const comparisonBlock = source.slice(source.indexOf('const comparisonLinks'), source.indexOf('const useCaseLinks'));
  const useCaseBlock = source.slice(source.indexOf('const useCaseLinks'), source.indexOf('const exampleLinks'));

  assert.match(source, /useCasesTitle/);
  assert.match(source, /footer\.sections\.useCases\.title/);
  assert.doesNotMatch(comparisonBlock, /MARKETING_NAV_BEST_FOR_HUB/);
  assert.doesNotMatch(comparisonBlock, /MARKETING_NAV_BEST_FOR_USE_CASES/);
  assert.match(useCaseBlock, /MARKETING_NAV_BEST_FOR_HUB/);
  assert.match(useCaseBlock, /MARKETING_NAV_BEST_FOR_USE_CASES/);
});

test('marketing nav keeps logged-out state after an explicit workspace logout intent', () => {
  assert.match(marketingNavSource, /import \{ consumeLogoutIntent, setLogoutIntent \} from '@\/lib\/logout-intent';/);
  assert.match(marketingNavSource, /const logoutIntentActive = consumeLogoutIntent\(\);/);
  assert.match(marketingNavSource, /if \(logoutIntentActive\) \{\s*markLoggedOut\(\);\s*void supabase\.auth\.signOut\(\)/s);
  assert.match(marketingNavSource, /if \(logoutIntentActive\) return;/);
});

test('default marketing routes initialize the intl request locale before rendering links', () => {
  const source = readFileSync('frontend/app/default-marketing-layout.tsx', 'utf8');

  assert.match(source, /import \{ setRequestLocale \} from 'next-intl\/server';/);
  assert.match(source, /setRequestLocale\(DEFAULT_LOCALE\);/);
});

test('middleware avoids self-rewriting default-locale marketing routes on loopback', () => {
  const source = readFileSync('frontend/middleware.ts', 'utf8');
  const bypassBlock = source.slice(
    source.indexOf('if ((isBotRequest || bypassLocaleRedirect) && !hasLocalePrefix(pathname))'),
    source.indexOf('response = handleI18nRouting(req);')
  );

  assert.match(bypassBlock, /if \(defaultPrefix\)/);
  assert.match(bypassBlock, /response = NextResponse\.rewrite\(rewriteUrl\);/);
  assert.match(bypassBlock, /else \{\s*response = NextResponse\.next\(\);/s);
});
