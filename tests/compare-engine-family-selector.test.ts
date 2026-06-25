import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const familySelectPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_components/CompareEngineFamilySelect.client.tsx'
);
const detailSelectorPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/CompareEngineSelector.client.tsx'
);
const hubWidgetPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/CompareNowWidget.client.tsx'
);

const familySelectSource = readFileSync(familySelectPath, 'utf8');
const detailSelectorSource = readFileSync(detailSelectorPath, 'utf8');
const hubWidgetSource = readFileSync(hubWidgetPath, 'utf8');

test('compare engine selectors use the family/model selector instead of a flat select menu', () => {
  assert.ok(existsSync(familySelectPath), 'family selector should live in compare route components');
  assert.match(familySelectSource, /export function CompareEngineFamilySelect/);
  assert.match(familySelectSource, /sm:grid-cols-\[170px_minmax\(0,1fr\)\]/);
  assert.match(familySelectSource, /function getDropdownPosition/);
  assert.match(familySelectSource, /className="fixed z-50/);
  assert.match(familySelectSource, /maxHeight: dropdownPosition\.maxHeight/);
  assert.match(familySelectSource, /overflow-x-hidden overflow-y-auto/);
  assert.doesNotMatch(familySelectSource, /left-1\/2 top-full/);
  assert.match(familySelectSource, /grid min-h-\[250px\] min-w-0/);
  assert.match(familySelectSource, /overflow-x-auto overscroll-x-contain/);
  assert.match(familySelectSource, /max-h-\[min\(36vh,300px\)\]/);
  assert.match(familySelectSource, /formatEngineSelectScore\(engineScores\?\.\[option\.value\]\)/);
  assert.match(familySelectSource, /Score \$\{value\}\/10/);
  assert.doesNotMatch(familySelectSource, /formatEngineSelectScorePercent\(engineScores/);
  assert.match(familySelectSource, /getEngineSelectFamilyRank/);
  assert.match(familySelectSource, /EngineIcon/);

  assert.match(detailSelectorSource, /CompareEngineFamilySelect/);
  assert.doesNotMatch(detailSelectorSource, /<SelectMenu\b/);

  assert.match(hubWidgetSource, /CompareEngineFamilySelect/);
  assert.doesNotMatch(hubWidgetSource, /<SelectMenu\b/);
});
