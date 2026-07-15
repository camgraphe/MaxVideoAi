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
const promptSourcePath = helperPath('model-page-prompting-prompt-source.ts');
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
  assert.match(
    layoutSource,
    /resolveModelPromptingDemoPromptSource\(\{[\s\S]*content:\s*promptingContent,[\s\S]*demoMedia,[\s\S]*engineId:\s*engine\.id,[\s\S]*locale,[\s\S]*\}\)/,
    'the route should apply the explicit legacy prompt-source policy to parsed localized content',
  );
  assert.match(
    layoutSource,
    /resolveDefaultModelPromptingDemoPromptSource\(demoMedia\)/,
    'the route should derive the default renderer prompt source independently',
  );
  assert.match(
    layoutSource,
    /demoPromptSource,[\s\S]*defaultDemoPromptSource,[\s\S]*demoMedia,/,
    'the builder should receive separate decision and default prompt sources',
  );
  assert.doesNotMatch(
    layoutSource,
    /const\s+useDemoMediaPrompt\s*=\s*Boolean\(demoMedia\?\.prompt\?\.trim\(\)\)/,
    'a non-empty route media prompt must not automatically replace editorial Prompt Lab copy',
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

test('default Prompt Lab rendering consumes explicit semantic presentation state', () => {
  assert.match(viewModelSource, /defaultPresentation:\s*\{/);
  assert.match(promptingWrapperSource, /viewModel\.defaultPresentation\.locale/);
  assert.match(promptingWrapperSource, /viewModel\.defaultPresentation\.mode/);
  assert.match(promptingWrapperSource, /viewModel\.defaultPresentation\.supportsAudio/);
  assert.match(promptingWrapperSource, /defaultPresentation\.demo\.media/);
  assert.doesNotMatch(
    promptingWrapperSource,
    /Number\.parseFloat|audioChipLabel\s*===|tipPrefix\s*===|function\s+toPreviewMedia/,
    'the wrapper must not reverse-engineer runtime state from localized display labels',
  );
  assert.doesNotMatch(
    promptingWrapperSource,
    /media=\{\{[\s\S]*label:\s*demo\.title/,
    'the wrapper must preserve the original FeaturedMedia label used for alt text',
  );
});

test('prompt-source policy stays separate from the pure view-model builder', () => {
  assert.ok(existsSync(promptSourcePath));
  const promptSource = readSource(promptSourcePath);
  assert.match(promptSource, /engineId\s*===\s*['"]happy-horse-1-1['"]/);
  assert.match(promptSource, /demo\.prompt\s*===\s*summaryPrompt/);
  assert.match(promptSource, /export function resolveDefaultModelPromptingDemoPromptSource/);
  assert.match(promptSource, /demoMedia\?\.prompt\?\.trim\(\)/);
  assert.match(viewModelSource, /input\.demoPromptSource\s*===\s*['"]media['"]/);
  assert.match(viewModelSource, /input\.defaultDemoPromptSource\s*===\s*['"]media['"]/);
  assert.doesNotMatch(viewModelSource, /happy-horse-1-1|veo-3-1-fast/);
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
  if (existsSync(promptSourcePath)) assert.ok(lineCount(readSource(promptSourcePath)) <= 120);
  assert.ok(lineCount(uiCopySource) <= 180);
});
