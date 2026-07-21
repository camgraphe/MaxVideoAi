import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layoutPath = 'frontend/app/(localized)/[locale]/(marketing)/layout.tsx';
const childSurfacePaths = [
  'frontend/app/(localized)/[locale]/(marketing)/about/_components/AboutView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForDetailView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkLabView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/blog/page.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/company/_components/CompanyTrustView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsIndexView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_components/EditorialStandardsView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx',
] as const;

test('localized marketing layout owns the only main landmark', () => {
  const layoutSource = readFileSync(layoutPath, 'utf8');
  assert.equal((layoutSource.match(/<main\b/g) ?? []).length, 1);
  assert.equal((layoutSource.match(/<\/main>/g) ?? []).length, 1);

  for (const path of childSurfacePaths) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /<\/?main\b/, `${path} must render inside the layout main`);
  }
});
