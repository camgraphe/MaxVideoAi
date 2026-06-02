import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

const returnPolicyPagePath = join(root, 'frontend/app/(core)/return-policy/page.tsx');
const legalIndexPagePath = join(root, 'frontend/app/(core)/legal/page.tsx');
const localizedReturnPolicyPagePath = join(root, 'frontend/app/(localized)/[locale]/return-policy/page.tsx');
const nextConfigPath = join(root, 'frontend/next.config.js');
const sitemapConfigPath = join(root, 'frontend/next-sitemap.config.js');
const marketingFooterPath = join(root, 'frontend/components/marketing/MarketingFooter.tsx');
const i18nNavigationPath = join(root, 'frontend/i18n/navigation.tsx');
const routingLocalePath = join(root, 'frontend/lib/middleware/routing-locale.ts');
const internalLinkGuardPath = join(root, 'scripts/internal-link-guard.mjs');
const messageFiles = ['frontend/messages/en.json', 'frontend/messages/fr.json', 'frontend/messages/es.json'];

const read = (path: string) => readFileSync(path, 'utf8');
const lineCount = (source: string) => source.split('\n').length;

test('return policy route is a public crawlable legal page with Merchant Center copy', () => {
  assert.ok(existsSync(returnPolicyPagePath), 'public /return-policy route should exist');

  const source = read(returnPolicyPagePath);
  const normalizedSource = source.replace(/\s+/g, ' ');
  assert.match(source, /export function generateMetadata|export async function generateMetadata/);
  assert.match(source, /Refund & Return Policy \| MaxVideoAI/);
  assert.match(
    source,
    /Refund and return policy for MaxVideoAI digital AI video generation credits and services\./
  );
  assert.match(source, /canonicalOverride:\s*'https:\/\/maxvideoai\.com\/return-policy'/);
  assert.match(source, /availableLocales:\s*\['en'\]/);
  assert.doesNotMatch(source, /noindex|index:\s*false/i, 'return policy must stay indexable');

  assert.match(source, /Refund &amp; Return Policy/);
  assert.match(source, /Last updated:\s*June 2, 2026/);
  assert.match(normalizedSource, /digital AI video generation services, wallet credits, and related software access/);
  assert.match(normalizedSource, /We do not sell or ship physical products/);
  assert.match(normalizedSource, /there is no physical return process and no product exchange process/);
  assert.match(normalizedSource, /technical issue on MaxVideoAI(?:'|&apos;)s side/);
  assert.match(normalizedSource, /credits charged for a generation that never starts or never completes/);
  assert.match(normalizedSource, /subjective dissatisfaction with an AI-generated result/);
  assert.match(normalizedSource, /successfully delivered/);
  assert.match(normalizedSource, /non-returnable and non-refundable/);
  assert.match(normalizedSource, /Unused wallet credits may be reviewed for refund on request/);
  assert.match(normalizedSource, /Promotional, bonus, or free credits have no cash value/);
  assert.match(normalizedSource, /EU, EEA, or UK/);
  assert.match(normalizedSource, /We do not offer exchanges/);
  assert.match(source, /user="support"/);
  assert.match(source, /domain="maxvideoai\.com"/);
  assert.ok(lineCount(source) <= 240, `return policy page should stay focused, got ${lineCount(source)} lines`);
});

test('refund policy redirects to the canonical return policy URL', () => {
  const source = read(nextConfigPath);
  assert.match(source, /source:\s*'\/refund-policy'/);
  assert.match(source, /destination:\s*'\/return-policy'/);
  assert.match(source, /permanent:\s*true/);
});

test('return policy is exposed through legal surfaces without broken localization', () => {
  const legalIndexSource = read(legalIndexPagePath);
  const footerSource = read(marketingFooterPath);
  const navigationSource = read(i18nNavigationPath);
  const routingLocaleSource = read(routingLocalePath);
  const guardSource = read(internalLinkGuardPath);

  assert.match(legalIndexSource, /href:\s*'\/return-policy'/);
  assert.match(legalIndexSource, /key:\s*'returnPolicy'/);
  assert.match(legalIndexSource, /localize:\s*false/);
  assert.match(footerSource, /\/return-policy/);
  assert.match(footerSource, /isPolicyLink/);
  assert.match(navigationSource, /\/return-policy/);
  assert.match(routingLocaleSource, /\/return-policy/);
  assert.match(routingLocaleSource, /\/refund-policy/);
  assert.match(guardSource, /returnPolicyLinks\.length === 1/);

  for (const file of messageFiles) {
    const payload = JSON.parse(read(join(root, file)));
    const footerLinks = Array.isArray(payload?.footer?.links) ? payload.footer.links : [];
    assert.equal(
      footerLinks.filter((entry: { href?: string }) => entry?.href === '/legal').length,
      1,
      `${file}: footer should keep exactly one Legal Center link`
    );
    assert.equal(
      footerLinks.filter((entry: { href?: string }) => entry?.href === '/return-policy').length,
      1,
      `${file}: footer should include the public return policy link`
    );
  }

  assert.ok(
    !existsSync(localizedReturnPolicyPagePath),
    'return policy should stay canonical at /return-policy instead of publishing localized copies'
  );
});

test('return policy is present in the sitemap as an English-only legal URL', () => {
  const source = read(sitemapConfigPath);
  assert.match(source, /\/return-policy/);
  assert.match(source, /ENGLISH_ONLY_PATHS/);
  assert.match(source, /ENGLISH_ONLY_PATHS\.has\(englishPath\)/);
});
