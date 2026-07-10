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
