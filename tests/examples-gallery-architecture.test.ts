import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const gridPath = join(root, 'frontend/components/examples/ExamplesGalleryGrid.client.tsx');
const cardPath = join(root, 'frontend/components/examples/ExampleGalleryCard.tsx');
const helpersPath = join(root, 'frontend/components/examples/examples-gallery-helpers.ts');
const columnsHookPath = join(root, 'frontend/components/examples/useExamplesGalleryColumns.ts');
const typesPath = join(root, 'frontend/components/examples/examples-gallery-types.ts');

const readSource = (path: string) => readFileSync(path, 'utf8');
const lineCount = (source: string) => source.split('\n').length;

test('examples gallery delegates card rendering, helpers, column state, and types', () => {
  for (const path of [gridPath, cardPath, helpersPath, columnsHookPath, typesPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const gridSource = readSource(gridPath);
  const cardSource = readSource(cardPath);
  const helpersSource = readSource(helpersPath);
  const columnsHookSource = readSource(columnsHookPath);
  const typesSource = readSource(typesPath);

  assert.match(gridSource, /<ExampleGalleryCard/, 'grid should compose focused cards');
  assert.match(gridSource, /useExamplesGalleryColumns/, 'grid should delegate column breakpoint state');
  assert.doesNotMatch(gridSource, /IntersectionObserver|AudioEqualizerBadge|data-examples-card|function parseAspectRatio/, 'grid should not own card media or helper internals');
  assert.match(cardSource, /IntersectionObserver|AudioEqualizerBadge|data-examples-card/, 'card should own media loading and hover playback');
  assert.match(helpersSource, /export function splitIntoColumns|export function dedupeExamples|export function parseAspectRatio/, 'helpers should own gallery pure logic');
  assert.match(columnsHookSource, /window\.matchMedia|export function useExamplesGalleryColumns/, 'column hook should own viewport breakpoints');
  assert.match(typesSource, /export type ExampleGalleryVideo|export type ExampleSort/, 'types module should own public gallery contracts');
  assert.match(gridSource, /detailsCtaLabel=\{detailsCtaLabel\}/, 'grid should pass the detail affordance to every card');
  assert.match(cardSource, /aria-label=\{watchAnchorText\}/, 'the full-card watch link should own the descriptive accessible name');
  assert.match(cardSource, /aria-hidden="true"/, 'the visual detail affordance should not duplicate the link name');
  assert.doesNotMatch(cardSource, /aria-label=\{altText\}/, 'image alt text should not replace the link action name');
  assert.doesNotMatch(cardSource, /recreateHref|showRecreateLink/, 'gallery cards should route through the watch page before recreation');
  assert.match(helpersSource, /View settings and price for/, 'watch-link names should describe the detail destination');
});

test('examples gallery modules stay focused', () => {
  const gridSource = readSource(gridPath);
  const cardSource = readSource(cardPath);
  const helpersSource = readSource(helpersPath);
  const columnsHookSource = readSource(columnsHookPath);
  const typesSource = readSource(typesPath);

  assert.ok(lineCount(gridSource) <= 240, `ExamplesGalleryGrid should stay below 240 lines, got ${lineCount(gridSource)}`);
  assert.ok(lineCount(cardSource) <= 230, `ExampleGalleryCard should stay below 230 lines, got ${lineCount(cardSource)}`);
  assert.ok(lineCount(helpersSource) <= 90, `examples gallery helpers should stay below 90 lines, got ${lineCount(helpersSource)}`);
  assert.ok(lineCount(columnsHookSource) <= 70, `examples gallery columns hook should stay below 70 lines, got ${lineCount(columnsHookSource)}`);
  assert.ok(lineCount(typesSource) <= 40, `examples gallery types should stay below 40 lines, got ${lineCount(typesSource)}`);
});
