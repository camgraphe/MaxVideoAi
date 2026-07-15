import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const ROUTE_ROOT = join(
  ROOT,
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]',
);
const componentPath = (fileName: string) => join(ROUTE_ROOT, '_components', fileName);
const helperPath = (fileName: string) => join(ROUTE_ROOT, '_lib', fileName);
const readSource = (filePath: string) => readFileSync(filePath, 'utf8');
const lineCount = (source: string) => source.trimEnd().split('\n').length;

const layoutSource = readSource(componentPath('MarketingModelPageLayout.tsx'));
const promptingWrapperSource = readSource(componentPath('ModelPromptingSection.tsx'));
const decisionSource = readSource(componentPath('ModelDecisionPromptingSection.tsx'));
const tabsSource = readSource(componentPath('ModelDecisionPromptTabs.client.tsx'));
const imageExamplesSource = readSource(componentPath('ModelDecisionImagePromptExamples.tsx'));
const parserSource = readSource(helperPath('model-page-prompting-content.ts'));
const viewModelSource = readSource(helperPath('model-page-prompting-view-model.ts'));
const uiCopySource = readSource(helperPath('model-page-prompting-ui-copy.ts'));
const legacyPath = helperPath('model-page-prompting-legacy.ts');

test('model prompting parses and builds once before rendering', () => {
  assert.equal(
    [...layoutSource.matchAll(/parseModelPromptingContent\(/g)].length,
    1,
    'the server layout should parse Prompt Lab content exactly once',
  );
  assert.match(
    layoutSource,
    /parseModelPromptingContent\(\s*localizedContent\.prompting,\s*engine\.modelSlug,\s*locale,/,
  );
  assert.equal(
    [...layoutSource.matchAll(/buildModelPromptingViewModel\(/g)].length,
    1,
    'the server layout should build the Prompt Lab view model exactly once',
  );
  assert.match(layoutSource, /promptingProps=\{\{\s*viewModel:\s*promptingViewModel\s*\}\}/);
});

test('server Prompt Lab renderers accept only the render-ready view model', () => {
  assert.match(promptingWrapperSource, /viewModel:\s*ModelPromptingViewModel/);
  assert.match(decisionSource, /viewModel:\s*ModelPromptingViewModel/);
  assert.match(promptingWrapperSource, /<ModelDecisionPromptingSection\s+viewModel=\{viewModel\}/);
  assert.doesNotMatch(
    `${promptingWrapperSource}\n${decisionSource}`,
    /buildLegacyModelPromptingContent|SoraCopy|engineSlug:\s*string|locale:\s*AppLocale|getRouteDemoSummary|getImagePromptExamples/,
  );
  assert.doesNotMatch(
    `${layoutSource}\n${promptingWrapperSource}\n${decisionSource}`,
    /from ['"]\.\.\/_lib\/model-page-prompting-legacy['"]/,
  );
  assert.ok(existsSync(legacyPath), 'Task 5 should leave the temporary legacy projector for Task 6');
});

test('interactive Prompt Lab children receive derived labels and destinations', () => {
  assert.match(tabsSource, /tabs:\s*ModelPromptingViewModel\['tabs'\]\['items'\]/);
  assert.match(tabsSource, /labels:\s*Pick<ModelPromptingUiCopy,/);
  assert.match(tabsSource, /exampleHref:\s*string\s*\|\s*null/);
  assert.match(tabsSource, /usePromptHref:\s*string/);
  assert.doesNotMatch(tabsSource, /getCopy|AppLocale|engineSlug|isImageEngine|encodeURIComponent/);
  assert.match(decisionSource, /usePromptHref=\{viewModel\.tabs\.usePromptHref\}/);
  assert.match(decisionSource, /workspaceHref=\{viewModel\.imageExamples\.workspaceHref\}/);
  assert.match(imageExamplesSource, /workspaceHref:\s*string/);
  assert.doesNotMatch(imageExamplesSource, /engineSlug|encodeURIComponent|\/app\/image\?engine=/);
});

test('prompting renderer and helpers respect permanent line caps', () => {
  assert.ok(lineCount(decisionSource) <= 300);
  assert.ok(lineCount(parserSource) <= 300);
  assert.ok(lineCount(viewModelSource) <= 300);
  assert.ok(lineCount(uiCopySource) <= 180);
});
