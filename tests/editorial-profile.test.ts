import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const profilePath = 'frontend/lib/editorial/profile.ts';

test('verified editorial profile has a dedicated server-safe source', () => {
  assert.equal(existsSync(profilePath), true);
});

test('verified editorial profile resolves localized identity URLs', async () => {
  const module = await import('../frontend/lib/editorial/profile') as unknown as {
    DEFAULT_EDITORIAL_PROFILE_ID: string;
    getEditorialProfile(locale: 'en' | 'fr' | 'es', id?: string): {
      id: string;
      name: string;
      jobTitle: string;
      location: string;
      bio: string;
      aboutHref: string;
    };
    getEditorialProfileAbsoluteUrl(profile: { aboutHref: string }): string;
  };
  const expected = {
    en: '/about#adrien-millot',
    fr: '/fr/a-propos#adrien-millot',
    es: '/es/acerca-de#adrien-millot',
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const profile = module.getEditorialProfile(locale);
    assert.equal(profile.id, module.DEFAULT_EDITORIAL_PROFILE_ID);
    assert.equal(profile.name, 'Adrien Millot');
    assert.equal(profile.jobTitle, 'Founder & Product Lead');
    assert.equal(profile.location, 'France');
    assert.equal(profile.aboutHref, expected[locale]);
    assert.ok(profile.bio.length >= 80);
    assert.equal(
      module.getEditorialProfileAbsoluteUrl(profile),
      `https://maxvideoai.com${expected[locale]}`,
    );
  }
});

test('unknown future author ids fail closed to the verified default', async () => {
  const module = await import('../frontend/lib/editorial/profile') as unknown as {
    getEditorialProfile(locale: 'en', id?: string): { id: string };
  };
  assert.equal(module.getEditorialProfile('en', 'unknown-person').id, 'adrien-millot');
});
