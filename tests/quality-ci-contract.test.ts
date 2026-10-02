import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

import adminPlaywrightConfig from '../playwright.admin.config';

type WorkflowStep = {
  name?: string;
  uses?: string;
  with?: Record<string, unknown>;
};

type QualityWorkflow = {
  on: Record<string, unknown>;
  concurrency: { group: string; 'cancel-in-progress': string };
  jobs: Record<string, {
    name?: string;
    needs?: string | string[];
    if?: string;
    steps: WorkflowStep[];
    'timeout-minutes'?: number;
  }>;
};

const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'quality.yml');

test('quality CI checks out complete history for revision provenance tests', () => {
  const workflow = YAML.parse(readFileSync(workflowPath, 'utf8')) as QualityWorkflow;
  for (const name of ['plan', 'fast', 'integration', 'tariffs', 'browser']) {
    const checkout = workflow.jobs[name]?.steps.find(step => step.name === 'Checkout');
    assert.equal(checkout?.with?.['fetch-depth'], 0, name);
  }
});

test('the permanent Quality CI gate waits for all lanes and runs after failures or intentional skips', () => {
  const workflow = YAML.parse(readFileSync(workflowPath, 'utf8')) as QualityWorkflow;
  assert.equal(workflow.jobs.quality.name, 'Quality CI');
  assert.equal(workflow.jobs.quality.if, '${{ always() }}');
  assert.deepEqual(workflow.jobs.quality.needs, ['plan', 'fast', 'integration', 'tariffs', 'browser']);
  for (const name of ['integration', 'tariffs', 'browser']) {
    assert.match(workflow.jobs[name].if ?? '', new RegExp(`needs.plan.outputs.${name} == 'true'`));
  }
  assert.ok(workflow.on.schedule);
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.equal(Object.hasOwn(workflow.on.pull_request as object, 'paths'), false);
  assert.equal(Object.hasOwn(workflow.on.pull_request as object, 'paths-ignore'), false);
  assert.equal(workflow.jobs.tariffs['timeout-minutes'], 60);
});

test('superseded PR validation is canceled independently from nightly and main validation', () => {
  const workflow = YAML.parse(readFileSync(workflowPath, 'utf8')) as QualityWorkflow;
  assert.match(workflow.concurrency.group, /github.workflow/);
  assert.match(workflow.concurrency.group, /github.event.pull_request.number/);
  assert.match(workflow.concurrency.group, /github.event_name/);
  assert.equal(workflow.concurrency['cancel-in-progress'], "${{ github.event_name == 'pull_request' }}");
});

test('production Lighthouse measurements run daily or manually instead of racing every main push', () => {
  const workflow = YAML.parse(readFileSync('.github/workflows/lighthouse.yml', 'utf8')) as QualityWorkflow;
  assert.equal(Object.hasOwn(workflow.on, 'push'), false);
  assert.ok(workflow.on.schedule);
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
});

test('admin smoke configuration selects only admin end-to-end specs', () => {
  assert.deepEqual(adminPlaywrightConfig.testMatch, ['**/admin-*.spec.ts']);
});
