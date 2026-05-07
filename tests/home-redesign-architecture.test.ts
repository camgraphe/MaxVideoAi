import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const sectionsPath = join(root, 'frontend/components/marketing/home/HomeRedesignSections.tsx');
const typesPath = join(root, 'frontend/components/marketing/home/home-redesign-types.ts');

const sectionsSource = readFileSync(sectionsPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');

test('home redesign sections delegate shared content contracts', () => {
  assert.ok(existsSync(typesPath), 'home redesign contracts should live beside the home section components');
  assert.match(
    sectionsSource,
    /from '@\/components\/marketing\/home\/home-redesign-types'/,
    'home sections should import reusable content contracts from the local type module'
  );
  assert.match(
    sectionsSource,
    /export type \{[\s\S]*HomeHeroContent[\s\S]*WorkflowSeoSummaryCopy[\s\S]*\} from '@\/components\/marketing\/home\/home-redesign-types'/,
    'home sections should keep its public type export surface stable for route imports'
  );
});

test('home redesign sections do not regain extracted type ownership', () => {
  for (const typeName of ['HomeHeroContent', 'HomeExampleCard', 'ComparisonCard', 'WorkflowSeoSummaryCopy']) {
    assert.doesNotMatch(
      sectionsSource,
      new RegExp(`export type ${typeName}\\b`),
      `${typeName} belongs in home-redesign-types.ts`
    );
    assert.match(typesSource, new RegExp(`export type ${typeName}\\b`), `${typeName} should be exported by the type module`);
  }

  const lineCount = sectionsSource.split('\n').length;
  assert.ok(lineCount <= 1400, `HomeRedesignSections should stay below 1400 lines after type extraction, got ${lineCount}`);
});
