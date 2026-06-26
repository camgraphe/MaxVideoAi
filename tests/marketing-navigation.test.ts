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
const marketingDesktopNavSource = readFileSync('frontend/components/marketing/MarketingDesktopNav.tsx', 'utf8');
const marketingFooterSource = readFileSync('frontend/components/marketing/MarketingFooter.tsx', 'utf8');
const headerBarSource = readFileSync('frontend/components/HeaderBar.tsx', 'utf8');

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

  assert.match(marketingDesktopNavSource, /entry\.emphasized/);
  assert.match(marketingDesktopNavSource, /font-semibold text-text-primary/);
});

test('localized marketing dropdown sections avoid English fallbacks', () => {
  const expectedUseCaseKeys = ['cinematic-realism', 'image-to-video', 'fast-drafts', 'ads'];
  const forbiddenFallbacks = [
    'All use-case guides',
    'Best models by use case',
    'Cinematic realism',
    'Fast drafts',
    'Product ads',
    'AI Upscale',
  ];

  for (const locale of ['fr', 'es'] as const) {
    const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    const dropdown = dictionary.nav.dropdown;
    const modelsSection = dropdown.models.sections.useCaseGuides.items;
    const compareSection = dropdown.compare.sections.useCaseGuides.items;

    assert.equal(typeof modelsSection['all-use-case-guides'], 'string', `${locale} models dropdown should localize all-use-case-guides`);
    assert.equal(typeof compareSection['best-for'], 'string', `${locale} compare dropdown should localize best-for`);

    for (const key of expectedUseCaseKeys) {
      assert.equal(typeof modelsSection[key], 'string', `${locale} models dropdown should localize ${key}`);
      assert.equal(typeof compareSection[key], 'string', `${locale} compare dropdown should localize ${key}`);
    }
    assert.equal(typeof dropdown.tools.items.upscale, 'string', `${locale} tools dropdown should localize upscale`);

    const navJson = JSON.stringify(dropdown);
    for (const fallback of forbiddenFallbacks) {
      assert.equal(navJson.includes(fallback), false, `${locale} dropdown should not expose "${fallback}"`);
    }
  }

  assert.match(headerBarSource, /nav\.dropdown\.\$\{item\.key\}\.sections/);
});

test('marketing footer keeps crawlable Best-For hub and priority child links', () => {
  assert.equal(hrefPath(MARKETING_NAV_BEST_FOR_HUB.href), '/ai-video-engines/best-for');
  assert.deepEqual(
    MARKETING_NAV_BEST_FOR_USE_CASES.map((item) => [item.label, hrefPath(item.href)]),
    bestForUseCaseLinks
  );
});

test('marketing footer separates Best-For use cases from popular comparisons', () => {
  const source = marketingFooterSource;
  const comparisonBlock = source.slice(source.indexOf('const comparisonLinks'), source.indexOf('const useCaseLinks'));
  const useCaseBlock = source.slice(source.indexOf('const useCaseLinks'), source.indexOf('const exampleLinks'));

  assert.match(source, /useCasesTitle/);
  assert.match(source, /footer\.sections\.useCases\.title/);
  assert.doesNotMatch(comparisonBlock, /MARKETING_NAV_BEST_FOR_HUB/);
  assert.doesNotMatch(comparisonBlock, /MARKETING_NAV_BEST_FOR_USE_CASES/);
  assert.match(useCaseBlock, /MARKETING_NAV_BEST_FOR_HUB/);
  assert.match(useCaseBlock, /MARKETING_NAV_BEST_FOR_USE_CASES/);
});

test('marketing brand logo images are decorative when brand text is visible', () => {
  assert.match(marketingNavSource, /src="\/assets\/branding\/logo-mark\.svg"[\s\S]+alt=""/);
  assert.match(marketingNavSource, /src="\/assets\/branding\/logo-mark\.svg"[\s\S]+aria-hidden/);
  assert.match(marketingFooterSource, /src="\/assets\/branding\/logo-mark\.svg"[\s\S]+alt=""/);
  assert.match(marketingFooterSource, /src="\/assets\/branding\/logo-mark\.svg"[\s\S]+aria-hidden/);
  assert.doesNotMatch(marketingNavSource, /alt="MaxVideoAI"/);
  assert.doesNotMatch(marketingFooterSource, /alt="MaxVideoAI"/);
});

test('marketing footer preserves crawl equity for ranking comparison targets', () => {
  const source = readFileSync('frontend/components/marketing/MarketingFooter.tsx', 'utf8');
  const comparisonItemsBlock = source.slice(source.indexOf('const comparisonItems'), source.indexOf('const comparisonLinks'));
  const rankingComparisonTargets = [
    ['seedance-1-5-pro', 'seedance-2-0'],
    ['ltx-2', 'ltx-2-3-fast'],
    ['ltx-2-3-fast', 'seedance-2-0'],
    ['ltx-2-3-fast', 'veo-3-1'],
    ['kling-3-pro', 'ltx-2-3-pro'],
  ] as const;

  for (const [left, right] of rankingComparisonTargets) {
    assert.match(comparisonItemsBlock, new RegExp(`left: '${left}'[\\s\\S]+right: '${right}'`));
  }
});

test('marketing footer links to the pay-as-you-go support page without promoting it to top nav', () => {
  const productLinksBlock = marketingFooterSource.slice(
    marketingFooterSource.indexOf('const productLinks'),
    marketingFooterSource.indexOf('const companyLinks')
  );

  assert.match(productLinksBlock, /footer\.sections\.product\.items\.paygVideo/);
  assert.match(productLinksBlock, /\/pay-as-you-go-ai-video-generator/);
  assert.doesNotMatch(marketingNavSource, /pay-as-you-go-ai-video-generator/);
});

test('marketing nav keeps logged-out state after an explicit workspace logout intent', () => {
  assert.match(marketingNavSource, /import \{ consumeLogoutIntent, setLogoutIntent \} from '@\/lib\/logout-intent';/);
  assert.match(marketingNavSource, /const logoutIntentActive = consumeLogoutIntent\(\);/);
  assert.match(marketingNavSource, /if \(logoutIntentActive\) \{\s*await supabase\.auth\.signOut\(\)\.catch\(\(\) => undefined\);\s*return;/s);
  assert.match(marketingNavSource, /if \(logoutIntentActive\) return;/);
});

test('default marketing routes initialize the intl request locale before rendering links', () => {
  const source = readFileSync('frontend/app/default-marketing-layout.tsx', 'utf8');

  assert.match(source, /import \{ setRequestLocale \} from 'next-intl\/server';/);
  assert.match(source, /setRequestLocale\(DEFAULT_LOCALE\);/);
});

test('intl request config does not let locale cookies override unprefixed marketing routes', () => {
  const source = readFileSync('frontend/i18n/request.ts', 'utf8');

  assert.doesNotMatch(source, /next\/headers/);
  assert.doesNotMatch(source, /LOCALE_COOKIE/);
  assert.doesNotMatch(source, /cookieLocale/);
  assert.match(source, /\(isAppLocale\(segmentLocale\) && segmentLocale\) \|\|\s*defaultLocale/s);
});

test('404 pages use plain localized hrefs without requiring an intl link provider', () => {
  const globalNotFoundSource = readFileSync('frontend/app/not-found.tsx', 'utf8');
  const localizedNotFoundSource = readFileSync('frontend/app/(localized)/[locale]/(marketing)/404/page.tsx', 'utf8');

  for (const source of [globalNotFoundSource, localizedNotFoundSource]) {
    assert.doesNotMatch(source, /@\/i18n\/navigation/);
    assert.doesNotMatch(source, /linkComponent=\{Link\}/);
    assert.match(source, /localizePathFromEnglish/);
    assert.match(source, /homeHref=\{localizePathFromEnglish\([^,]+, '\/'\)\}/);
    assert.match(source, /modelsHref=\{localizePathFromEnglish\([^,]+, '\/models'\)\}/);
  }
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
