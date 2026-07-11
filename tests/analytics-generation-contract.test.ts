import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Google signup emits a start event before OAuth', () => {
  const source = readFileSync('frontend/app/(core)/login/_hooks/useLoginPageController.ts', 'utf8');
  assert.match(source, /shouldTrackGoogleSignupStart\(mode\)/);
  assert.match(source, /dispatchAnalyticsEvent\('sign_up_started'/);
  assert.match(source, /method: 'google'/);
});

test('generation analytics use classifications instead of free-form errors', () => {
  const runner = readFileSync('frontend/app/(core)/(workspace)/app/_hooks/workspace-generation-iteration-runner.ts', 'utf8');
  const bridge = readFileSync('frontend/components/analytics/GA4EventBridge.tsx', 'utf8');
  assert.doesNotMatch(runner, /error_message: error instanceof Error \? error\.message/);
  assert.doesNotMatch(bridge, /error_message: typeof detail\.message/);
  assert.match(runner, /failure_category: 'generation_request_failed'/);
  assert.match(bridge, /failure_category: 'job_failed'/);
  assert.match(bridge, /mergeRequestGenerationFailureContext/);
});
