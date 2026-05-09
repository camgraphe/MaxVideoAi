import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const settingsPageSource = readFileSync('frontend/app/(core)/settings/page.tsx', 'utf8');

test('settings copy merge replaces localized arrays instead of duplicating options', () => {
  assert.match(settingsPageSource, /deepmerge\(DEFAULT_SETTINGS_COPY, rawCopy as Partial<SettingsCopy>, \{/);
  assert.match(settingsPageSource, /arrayMerge:\s*\(_destination, source\) => source/);
  assert.match(settingsPageSource, /copy\.fields\.locale\.options\.map/);
  assert.match(settingsPageSource, /copy\.fields\.theme\.options\.map/);
});
