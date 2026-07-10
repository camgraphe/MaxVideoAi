import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/server/watch-page-signals.ts');
const signalsDir = join(root, 'frontend/server/watch-page-signals');
const focusedModules = [
  'constants.ts',
  'canonical.ts',
  'content.ts',
  'derive.ts',
  'engine.ts',
  'formatting.ts',
  'normalization.ts',
  'recommendations.ts',
  'related.ts',
  'snapshot.ts',
  'tags.ts',
  'types.ts',
  'visual.ts',
];

const facadeSource = readFileSync(facadePath, 'utf8');

function readModule(moduleName: string): string {
  return readFileSync(join(signalsDir, moduleName), 'utf8');
}

test('watch page signals public module stays a thin facade', () => {
  assert.ok(existsSync(facadePath), 'watch-page-signals facade should exist');
  assert.match(facadeSource, /from '\.\/watch-page-signals\/derive'/);
  assert.match(facadeSource, /from '\.\/watch-page-signals\/related'/);
  assert.match(facadeSource, /from '\.\/watch-page-signals\/types'/);

  const lineCount = facadeSource.split('\n').length;
  assert.ok(lineCount <= 30, `watch-page-signals.ts should stay a thin facade, got ${lineCount} lines`);
});

test('watch page signal responsibilities live in focused modules', () => {
  for (const moduleName of focusedModules) {
    const modulePath = join(signalsDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under watch-page-signals`);
    const lineCount = readModule(moduleName).split('\n').length;
    assert.ok(lineCount <= 250, `${moduleName} should stay focused and below 250 lines, got ${lineCount}`);
  }
});

test('watch page signal facade does not regain parsing or scoring ownership', () => {
  for (const pattern of [
    /const MODE_LABELS/,
    /const STYLE_PATTERNS/,
    /const DESCRIPTOR_PATTERNS/,
    /function parseSnapshot/,
    /function extractStyleTags/,
    /function buildCapabilityTags/,
    /function buildDetailRows/,
    /function overlapCount/,
    /DEFAULT_ENGINE_GUIDE/,
  ]) {
    assert.doesNotMatch(facadeSource, pattern);
  }
});

test('watch page signal modules expose the expected contracts', () => {
  assert.match(readModule('derive.ts'), /export function deriveWatchPageSignals/);
  assert.match(readModule('related.ts'), /export function toWatchPageRelatedCandidate/);
  assert.match(readModule('related.ts'), /export function pickRelatedWatchPages/);
  assert.match(readModule('snapshot.ts'), /export function parseSnapshot/);
  assert.match(readModule('tags.ts'), /export function extractStyleTags/);
  assert.match(readModule('tags.ts'), /export function buildCapabilityTags/);
  assert.match(readModule('content.ts'), /export function buildDetailRows/);
  assert.match(readModule('canonical.ts'), /export function buildWatchPageCanonicalState/);
  assert.match(readModule('engine.ts'), /export function resolveEngineEntry/);
  assert.match(readModule('recommendations.ts'), /export function buildPromptImprovementNotes/);
  assert.match(readModule('recommendations.ts'), /export function buildCompareLinks/);
  assert.match(readModule('visual.ts'), /export function buildWatchPageVisualContext/);
  assert.match(readModule('content.ts'), /Recorded render cost/);
  assert.doesNotMatch(readModule('content.ts'), /label: 'Render cost'/);
});
