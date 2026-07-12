import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('marketing locale switch uses the locale prefix in the current URL over stale client state', () => {
  const source = readFileSync('frontend/components/marketing/LanguageToggle.tsx', 'utf8');

  assert.match(source, /resolveMarketingLocaleFromPathname\(rawPathname, locale\)/);
  assert.match(source, /return match \? \(match\[1\]\.toLowerCase\(\) as Locale\) : 'en';/);
});
