import assert from 'node:assert/strict';
import test from 'node:test';
import * as studioRuntime from './helpers/studio-integration-runtime';

test('readiness diagnostics retain the root cause and tail while bounding repeated error bodies', () => {
  const summarize = (studioRuntime as typeof studioRuntime & {
    summarizeStudioReadinessFailure?: (logs: string, maxChars: number) => string;
  }).summarizeStudioReadinessFailure;

  assert.equal(typeof summarize, 'function');

  const diagnostic = summarize!(
    `ROOT_CAUSE: missing fixture configuration\n${'x'.repeat(12_000)}\nWEBPACK_STACK_TAIL`,
    1_000,
  );

  assert.match(diagnostic, /^ROOT_CAUSE: missing fixture configuration/u);
  assert.match(diagnostic, /WEBPACK_STACK_TAIL$/u);
  assert.ok(diagnostic.length <= 1_000);
});
