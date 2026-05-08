import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const sectionsPath = join(root, 'frontend/components/marketing/home/HomeRedesignSections.tsx');
const typesPath = join(root, 'frontend/components/marketing/home/home-redesign-types.ts');
const visualsPath = join(root, 'frontend/components/marketing/home/home-redesign-visuals.ts');
const workflowSummaryPath = join(root, 'frontend/components/marketing/home/HomeWorkflowSeoSummary.tsx');
const conversionSectionsPath = join(root, 'frontend/components/marketing/home/HomeConversionSections.tsx');

const sectionsSource = readFileSync(sectionsPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');
const visualsSource = readFileSync(visualsPath, 'utf8');
const workflowSummarySource = readFileSync(workflowSummaryPath, 'utf8');
const conversionSectionsSource = readFileSync(conversionSectionsPath, 'utf8');

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
  assert.ok(existsSync(visualsPath), 'home visual constants should live in a local visual module');
  assert.ok(existsSync(workflowSummaryPath), 'workflow SEO summary should live in its own component module');
  assert.ok(existsSync(conversionSectionsPath), 'home conversion sections should live in their own component module');
  assert.match(
    sectionsSource,
    /from '@\/components\/marketing\/home\/home-redesign-visuals'/,
    'home sections should consume visual constants from the local visual module'
  );
  assert.match(
    sectionsSource,
    /export \{ WorkflowSeoSummary \} from '@\/components\/marketing\/home\/HomeWorkflowSeoSummary'/,
    'home sections should re-export WorkflowSeoSummary for existing route imports'
  );
  assert.match(
    sectionsSource,
    /from '@\/components\/marketing\/home\/HomeConversionSections'/,
    'home sections should re-export conversion sections for existing route imports'
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
  assert.ok(lineCount <= 720, `HomeRedesignSections should stay below 720 lines after conversion section extraction, got ${lineCount}`);
  assert.doesNotMatch(sectionsSource, /const\s+TOOLBOX_VISUALS/);
  assert.doesNotMatch(sectionsSource, /const\s+WORKFLOW_BASICS_COPY/);
  assert.match(visualsSource, /export\s+const\s+TOOLBOX_VISUALS/);
  assert.match(visualsSource, /export\s+const\s+HERO_ENGINE_MEDIA/);
  assert.match(workflowSummarySource, /const\s+WORKFLOW_BASICS_COPY/);
  assert.match(workflowSummarySource, /export\s+function\s+WorkflowSeoSummary/);
  assert.match(conversionSectionsSource, /export function ComparisonPreview/);
  assert.match(conversionSectionsSource, /export function ReferenceWorkflow/);
  assert.match(conversionSectionsSource, /export function AiVideoToolbox/);
  assert.match(conversionSectionsSource, /export function TransparentPricingBlock/);
  assert.match(conversionSectionsSource, /export function ProviderEngineStrip/);
  assert.match(conversionSectionsSource, /export function HomeFaq/);
  assert.doesNotMatch(sectionsSource, /function ComparisonScorecard/);
  assert.doesNotMatch(sectionsSource, /export function AiVideoToolbox/);
});
