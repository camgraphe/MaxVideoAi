import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const copyPath = 'frontend/app/(localized)/[locale]/(marketing)/company/_lib/company-copy.ts';
const viewPath = 'frontend/app/(localized)/[locale]/(marketing)/company/_components/CompanyTrustView.tsx';

test('Company trust hub has focused copy and view owners', () => {
  assert.equal(existsSync(copyPath), true);
  assert.equal(existsSync(viewPath), true);
});

test('Company exposes the complete trust graph in every locale', async () => {
  const copyModule = await import('../frontend/app/(localized)/[locale]/(marketing)/company/_lib/company-copy') as unknown as {
    getCompanyCopy(locale: 'en' | 'fr' | 'es'): {
      resources: Array<{ links: Array<{ href: string }> }>;
      rights: { commercialUse: string; privacy: string };
    };
  };
  const required = [
    '/about',
    '/editorial-standards',
    '/benchmarks',
    '/legal/terms',
    '/legal/privacy',
    '/legal/subprocessors',
  ];

  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = copyModule.getCompanyCopy(locale);
    const hrefs = copy.resources.flatMap((group) => group.links.map((link) => link.href));
    for (const href of required) {
      assert.ok(hrefs.includes(href), `${locale} should include ${href}`);
    }
    assert.match(copy.rights.commercialUse, /commercial|commercialement|comercialmente/i);
    assert.match(copy.rights.privacy, /private|privés|privados/i);
  }

  assert.equal(
    copyModule.getCompanyCopy('fr').rights.commercialUse,
    'Les utilisateurs peuvent utiliser commercialement leurs générations, sous réserve des droits de tiers, des lois applicables et des éventuelles restrictions propres au modèle ou fournisseur utilisé.',
  );
});

test('Company route delegates visual ownership to a focused view', () => {
  const page = readFileSync('frontend/app/(localized)/[locale]/(marketing)/company/page.tsx', 'utf8');
  const view = readFileSync(viewPath, 'utf8');
  assert.match(page, /CompanyTrustView/);
  assert.match(page, /getCompanyCopy/);
  assert.doesNotMatch(page, /copy\.links\.map/);
  assert.ok(page.split('\n').length <= 100);
  assert.match(view, /generated-media-rights/);
  assert.match(view, /return-policy/);
  assert.doesNotMatch(view, /['"]use client['"]/);
});

test('internal link guard follows the extracted Company owner and allows the About trust link', () => {
  const guard = readFileSync('scripts/internal-link-guard.mjs', 'utf8');
  assert.match(guard, /company\/_lib\/company-copy\.ts/);
  assert.match(guard, /about\/_components\/AboutView\.tsx/);
  assert.match(guard, /companySources/);
});
