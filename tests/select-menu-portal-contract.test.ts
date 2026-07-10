import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const selectMenuSource = readFileSync('frontend/components/ui/SelectMenu.tsx', 'utf8');
const coreSettingsSource = readFileSync('frontend/components/CoreSettingsBar.tsx', 'utf8');
const imageSettingsSource = readFileSync('frontend/components/ImageSettingsBar.tsx', 'utf8');
const imageAdvancedSettingsSource = readFileSync('frontend/components/ImageAdvancedSettings.tsx', 'utf8');
const priceEstimatorSelectSource = readFileSync(
  'frontend/components/marketing/price-estimator/PriceEstimatorSelectGroup.tsx',
  'utf8'
);

test('workspace settings opt into a portaled SelectMenu without changing its default consumers', () => {
  assert.match(selectMenuSource, /portal\?: boolean/);
  assert.match(selectMenuSource, /portal = false/);
  assert.match(selectMenuSource, /createPortal\([\s\S]*document\.body/);
  assert.match(selectMenuSource, /portal[\s\S]*'fixed[\s\S]*'absolute left-0/);
  assert.match(selectMenuSource, /menuRef\.current\?\.contains\(target\)/);
  assert.match(coreSettingsSource, /<SelectMenu[\s\S]*portal=\{compact\}/);
  assert.match(imageSettingsSource, /<SelectMenu[\s\S]*portal=\{compact\}/);
  assert.doesNotMatch(imageAdvancedSettingsSource, /portal=/);
  assert.doesNotMatch(priceEstimatorSelectSource, /portal=/);
});

test('portaled SelectMenu closes on focus departure without stealing Tab or competing control keys', () => {
  assert.match(selectMenuSource, /document\.addEventListener\('focusin', handleFocusIn\)/);
  assert.match(selectMenuSource, /containerRef\.current\?\.contains\(target\) \|\| menuRef\.current\?\.contains\(target\)/);
  assert.match(selectMenuSource, /if \(!isWithinSelect\) return;/);
  assert.doesNotMatch(selectMenuSource, /event\.key === 'Tab'[\s\S]{0,160}event\.preventDefault\(\)/);
});

test('portaled SelectMenu exposes stable trigger and listbox ARIA ownership', () => {
  assert.match(selectMenuSource, /const triggerId = useId\(\)/);
  assert.match(selectMenuSource, /const listboxId = useId\(\)/);
  assert.match(selectMenuSource, /id=\{triggerId\}/);
  assert.match(selectMenuSource, /aria-controls=\{listboxId\}/);
  assert.match(selectMenuSource, /id=\{listboxId\}/);
  assert.match(selectMenuSource, /aria-labelledby=\{triggerId\}/);
});

test('SelectMenu can retain disabled option explanations', () => {
  assert.match(selectMenuSource, /title\?: string/);
  assert.match(selectMenuSource, /title=\{option\.title\}/);
});
