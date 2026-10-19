import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const profilePath = 'frontend/lib/editorial/profile.ts';

test('brand editorial profile has a dedicated server-safe source', () => {
  assert.equal(existsSync(profilePath), true);
});

test('brand editorial profile resolves localized identity URLs', async () => {
  const module = await import('../frontend/lib/editorial/profile') as unknown as {
    DEFAULT_EDITORIAL_PROFILE_ID: string;
    getEditorialProfile(locale: 'en' | 'fr' | 'es', id?: string): {
      id: string;
      name: string;
      bio: string;
      aboutHref: string;
    };
    getEditorialProfileAbsoluteUrl(profile: { aboutHref: string }): string;
  };
  const expected = {
    en: '/about#maxvideoai',
    fr: '/fr/a-propos#maxvideoai',
    es: '/es/acerca-de#maxvideoai',
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const profile = module.getEditorialProfile(locale);
    assert.equal(profile.id, module.DEFAULT_EDITORIAL_PROFILE_ID);
    assert.equal(profile.name, 'MaxVideoAI');
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
  assert.equal(module.getEditorialProfile('en', 'unknown-person').id, 'maxvideoai');
});
