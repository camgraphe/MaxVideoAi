import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const termsPagePath = join(root, 'frontend/app/(core)/legal/terms/page.tsx');
const privacyPagePath = join(root, 'frontend/app/(core)/legal/privacy/page.tsx');
const termsArticlePath = join(root, 'frontend/app/(core)/legal/terms/_components/TermsArticle.tsx');
const privacyArticlePath = join(root, 'frontend/app/(core)/legal/privacy/_components/PrivacyArticle.tsx');
const termsCopyPath = join(root, 'frontend/app/(core)/legal/terms/_lib/terms-page-copy.ts');
const privacyCopyPath = join(root, 'frontend/app/(core)/legal/privacy/_lib/privacy-page-copy.ts');
const localizedTermsPath = join(root, 'frontend/app/(localized)/[locale]/legal/terms/page.tsx');
const localizedPrivacyPath = join(root, 'frontend/app/(localized)/[locale]/legal/privacy/page.tsx');

const termsPageSource = readFileSync(termsPagePath, 'utf8');
const privacyPageSource = readFileSync(privacyPagePath, 'utf8');
const termsArticleSource = readFileSync(termsArticlePath, 'utf8');
const privacyArticleSource = readFileSync(privacyArticlePath, 'utf8');
const termsCopySource = readFileSync(termsCopyPath, 'utf8');
const privacyCopySource = readFileSync(privacyCopyPath, 'utf8');
const localizedTermsSource = readFileSync(localizedTermsPath, 'utf8');
const localizedPrivacySource = readFileSync(localizedPrivacyPath, 'utf8');

test('legal terms and privacy pages stay route orchestrators', () => {
  assert.ok(existsSync(termsArticlePath), 'terms article should live in a route-local component');
  assert.ok(existsSync(privacyArticlePath), 'privacy article should live in a route-local component');
  assert.ok(existsSync(termsCopyPath), 'terms copy should live in a route-local lib module');
  assert.ok(existsSync(privacyCopyPath), 'privacy copy should live in a route-local lib module');

  assert.match(termsPageSource, /from '\.\/_components\/TermsArticle'/);
  assert.match(termsPageSource, /from '\.\/_lib\/terms-page-copy'/);
  assert.match(privacyPageSource, /from '\.\/_components\/PrivacyArticle'/);
  assert.match(privacyPageSource, /from '\.\/_lib\/privacy-page-copy'/);
  assert.match(termsPageSource, /export async function generateMetadata/);
  assert.match(privacyPageSource, /export async function generateMetadata/);

  assert.ok(
    termsPageSource.split('\n').length <= 160,
    `terms page should stay below 160 lines after article extraction, got ${termsPageSource.split('\n').length}`
  );
  assert.ok(
    privacyPageSource.split('\n').length <= 170,
    `privacy page should stay below 170 lines after article extraction, got ${privacyPageSource.split('\n').length}`
  );
});

test('legal pages do not regain localized article ownership', () => {
  assert.doesNotMatch(termsPageSource, /function TermsArticleEn/, 'terms article variants belong in TermsArticle');
  assert.doesNotMatch(termsPageSource, /function TermsArticleFr/, 'terms article variants belong in TermsArticle');
  assert.doesNotMatch(termsPageSource, /function TermsArticleEs/, 'terms article variants belong in TermsArticle');
  assert.doesNotMatch(privacyPageSource, /function PrivacyArticleEn/, 'privacy article variants belong in PrivacyArticle');
  assert.doesNotMatch(privacyPageSource, /function PrivacyArticleFr/, 'privacy article variants belong in PrivacyArticle');
  assert.doesNotMatch(privacyPageSource, /function PrivacyArticleEs/, 'privacy article variants belong in PrivacyArticle');
  assert.doesNotMatch(termsPageSource, /<section className="stack-gap-sm">/, 'terms page should not own legal article sections');
  assert.doesNotMatch(privacyPageSource, /<section className="stack-gap-sm">/, 'privacy page should not own legal article sections');
});

test('legal article and copy modules expose the expected contracts', () => {
  assert.match(termsArticleSource, /export function TermsArticle/);
  assert.match(termsArticleSource, /function TermsArticleEn/);
  assert.match(termsArticleSource, /function TermsArticleFr/);
  assert.match(termsArticleSource, /function TermsArticleEs/);
  assert.match(privacyArticleSource, /export function PrivacyArticle/);
  assert.match(privacyArticleSource, /function PrivacyArticleEn/);
  assert.match(privacyArticleSource, /function PrivacyArticleFr/);
  assert.match(privacyArticleSource, /function PrivacyArticleEs/);
  assert.match(termsCopySource, /export const METADATA_COPY/);
  assert.match(termsCopySource, /export const HEADER_COPY/);
  assert.match(privacyCopySource, /export const METADATA_COPY/);
  assert.match(privacyCopySource, /export const HEADER_COPY/);
});

test('localized legal routes continue to re-export core legal pages', () => {
  assert.match(localizedTermsSource, /export \{ generateMetadata \} from '@\/app\/\(core\)\/legal\/terms\/page'/);
  assert.match(localizedTermsSource, /export \{ default \} from '@\/app\/\(core\)\/legal\/terms\/page'/);
  assert.match(localizedPrivacySource, /export \{ generateMetadata \} from '@\/app\/\(core\)\/legal\/privacy\/page'/);
  assert.match(localizedPrivacySource, /export \{ default \} from '@\/app\/\(core\)\/legal\/privacy\/page'/);
});
