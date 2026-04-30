import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const customerFacingFiles = [
  'frontend/app/(core)/legal/mentions/page.tsx',
  'frontend/app/(core)/legal/privacy/page.tsx',
  'frontend/app/(core)/legal/terms/page.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/contact/page.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/docs/page.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/status/page.tsx',
  'frontend/lib/i18n/dictionaries.ts',
  'frontend/messages/en.json',
  'frontend/messages/fr.json',
  'frontend/messages/es.json',
];

const stripeLegalAddress = "324 Rue De La Mare D'ovillers, 60730 Novillers, France";

test('customer-facing support references use the maxvideoai.com mailbox', () => {
  for (const file of customerFacingFiles) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /support@maxvideo\.ai/, `${file} should not use the old support mailbox`);
  }
});

test('legal mentions use the Stripe public business address exactly', () => {
  const source = readFileSync('frontend/app/(core)/legal/mentions/page.tsx', 'utf8');
  assert.equal((source.match(new RegExp(stripeLegalAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 3);
  assert.doesNotMatch(source, /324 rue de la mare, 60730 Novillers/i);
});
