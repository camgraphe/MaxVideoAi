import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const settingsPageSource = readFileSync('frontend/app/(core)/settings/page.tsx', 'utf8');

test('settings page delegates functional account preferences while preserving copy fallback merging', () => {
  assert.match(settingsPageSource, /deepmerge\(DEFAULT_SETTINGS_COPY, rawCopy as Partial<SettingsCopy>, \{/);
  assert.match(settingsPageSource, /arrayMerge:\s*\(_destination, source\) => source/);
  assert.match(settingsPageSource, /<AccountSettingsPanel user=\{user\} copy=\{copy\.account\}/);
  assert.doesNotMatch(settingsPageSource, /function AccountTab/);
});
