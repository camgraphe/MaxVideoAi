import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MARKETING_NAV_BEST_FOR_HUB,
  MARKETING_NAV_BEST_FOR_USE_CASES,
  MARKETING_NAV_DROPDOWNS,
  MARKETING_TOP_NAV_LINKS,
} from '../frontend/config/navigation.ts';

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
    sections?: Array<{ titleFallback: string; items: Array<{ label: string; href: unknown }> }>;
  };
  const chooseByUseCase = modelsDropdown.sections?.find((section) => section.titleFallback === 'Choose by use case');
  assert.ok(chooseByUseCase, 'Models dropdown should expose a Choose by use case section');
  assert.deepEqual(
    chooseByUseCase.items.map((item) => [item.label, hrefPath(item.href)]),
    [...bestForUseCaseLinks, ['All use-case guides', '/ai-video-engines/best-for']]
  );

  const compareDropdown = MARKETING_NAV_DROPDOWNS.compare as {
    sections?: Array<{ titleFallback: string; items: Array<{ label: string; href: unknown }> }>;
  };
  const decisionGuides = compareDropdown.sections?.find((section) => section.titleFallback === 'Decision guides');
  assert.ok(decisionGuides, 'Compare dropdown should expose a Decision guides section');
  assert.deepEqual(
    decisionGuides.items.map((item) => [item.label, hrefPath(item.href)]),
    [['Best models by use case', '/ai-video-engines/best-for'], ...bestForUseCaseLinks]
  );
});

test('marketing footer keeps crawlable Best-For hub and priority child links', () => {
  assert.equal(hrefPath(MARKETING_NAV_BEST_FOR_HUB.href), '/ai-video-engines/best-for');
  assert.deepEqual(
    MARKETING_NAV_BEST_FOR_USE_CASES.map((item) => [item.label, hrefPath(item.href)]),
    bestForUseCaseLinks
  );
});
