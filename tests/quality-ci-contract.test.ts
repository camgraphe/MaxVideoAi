import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

import adminPlaywrightConfig from '../playwright.admin.config';

type WorkflowStep = {
  name?: string;
  if?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
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
    'runs-on'?: string;
    strategy?: { 'fail-fast'?: boolean; matrix?: { shard?: number[] } };
    'continue-on-error'?: boolean;
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

test('database and tariff validation retain their full suites on the stable validation image', () => {
  const workflow = YAML.parse(readFileSync(workflowPath, 'utf8')) as QualityWorkflow;
  for (const [name, suites] of [['tariffs', ['tariffs']], ['integration', ['integration', 'studio']]] as const) {
    const job = workflow.jobs[name];
    assert.equal(job['runs-on'], 'ubuntu-24.04');
    assert.ok(job.steps.some(step => step.uses === './.github/actions/setup-validation-tools'));
    for (const suite of suites) {
      assert.ok(job.steps.some(step => step.run === `pnpm run test:validate -- --suite ${suite}`));
    }
  }
});

test('media and browser validation retain their full coverage on the stable toolchain image', () => {
  const workflow = YAML.parse(readFileSync(workflowPath, 'utf8')) as QualityWorkflow;
  for (const name of ['integration', 'browser']) {
    assert.equal(workflow.jobs[name]['runs-on'], 'ubuntu-24.04');
    assert.ok(workflow.jobs[name].steps.some(step => step.uses === './.github/actions/setup-validation-tools'));
  }
  assert.ok(workflow.jobs.integration.steps.some(step => step.run === 'pnpm run test:validate -- --suite integration'));
  assert.ok(workflow.jobs.integration.steps.some(step => step.run === 'pnpm run test:validate -- --suite studio'));
  assert.ok(workflow.jobs.browser.steps.some(step => step.run === 'pnpm run test:validate -- --suite browser --shard ${{ matrix.shard }}/2'));
  assert.ok(workflow.jobs.browser.steps.some(step => step.run === 'pnpm run test:admin-smoke'));
  assert.equal(workflow.jobs.browser['timeout-minutes'], 40);
});

test('Browser runs both independent partitions without canceling a sibling failure', () => {
  const workflow = YAML.parse(readFileSync(workflowPath, 'utf8')) as QualityWorkflow;
  const browser = workflow.jobs.browser;
  assert.deepEqual(browser.strategy, { 'fail-fast': false, matrix: { shard: [1, 2] } });
  assert.notEqual(browser['continue-on-error'], true);
  assert.equal(browser.steps.find(step => step.name === 'Install Playwright browser')?.run,
    'pnpm exec playwright install --with-deps chromium webkit');
  const validation = browser.steps.find(step => step.run?.includes('--suite browser'));
  assert.equal(validation?.if, undefined, 'every selected matrix partition must run its tests');
  assert.ok(workflow.jobs.quality.needs?.includes('browser'), 'gate must await the entire matrix job');
});

test('admin smoke and its existing report run only on Browser partition 2', () => {
  const workflow = YAML.parse(readFileSync(workflowPath, 'utf8')) as QualityWorkflow;
  const steps = workflow.jobs.browser.steps;
  const validationIndex = steps.findIndex(step => step.run?.includes('--suite browser'));
  const adminIndex = steps.findIndex(step => step.run === 'pnpm run test:admin-smoke');
  assert.ok(adminIndex > validationIndex);
  assert.equal(steps.filter(step => step.run === 'pnpm run test:admin-smoke').length, 1);
  assert.equal(steps[adminIndex].if, '${{ matrix.shard == 2 }}');
  assert.deepEqual(steps[adminIndex].env, {
    DATABASE_URL: '${{ secrets.RUNTIME_AUDIT_DATABASE_URL }}',
    NEXT_PUBLIC_SUPABASE_URL: '${{ vars.NEXT_PUBLIC_SUPABASE_URL }}',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '${{ vars.NEXT_PUBLIC_SUPABASE_ANON_KEY }}',
  });
  const uploads = steps.filter(step => step.uses === 'actions/upload-artifact@v6');
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].if, '${{ failure() && matrix.shard == 2 }}');
  assert.deepEqual(uploads[0].with, { name: 'playwright-admin-report', path: 'output/playwright/**' });
});

test('Quality CI rejects a failed or canceled aggregate Browser matrix result', () => {
  for (const browserResult of ['success', 'failure', 'cancelled', 'skipped', undefined]) {
    const needs = {
      plan: { result: 'success', outputs: { integration: 'true', tariffs: 'true', browser: 'true' } },
      fast: { result: 'success' }, integration: { result: 'success' }, tariffs: { result: 'success' },
      ...(browserResult ? { browser: { result: browserResult } } : {}),
    };
    const result = spawnSync(process.execPath, ['scripts/check-ci-validation.mjs'], {
      encoding: 'utf8', env: { ...process.env, CI_JOB_RESULTS: JSON.stringify(needs) },
    });
    assert.equal(result.status, browserResult === 'success' ? 0 : 1, `${browserResult}: ${result.stderr}`);
  }
});

test('production Lighthouse measurements run daily or manually instead of racing every main push', () => {
  const workflow = YAML.parse(readFileSync('.github/workflows/lighthouse.yml', 'utf8')) as QualityWorkflow;
  assert.equal(Object.hasOwn(workflow.on, 'push'), false);
  assert.ok(workflow.on.schedule);
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
});

test('optional presentation diagnostics cannot prevent the six ordinary Lighthouse audits', () => {
  const workflow = YAML.parse(readFileSync('.github/workflows/lighthouse.yml', 'utf8')) as QualityWorkflow;
  const steps = workflow.jobs.lighthouse.steps;
  const probeIndex = steps.findIndex(step => step.name === 'Diagnose examples Chrome presentation');
  assert.ok(probeIndex >= 0);
  assert.match(steps[probeIndex].if ?? '', /inputs.examples_diagnostics/);
  for (const route of ['home', 'examples', 'models-veo', 'pricing', 'blog', 'contact']) {
    const auditIndex = steps.findIndex(step => step.run === `pnpm --dir frontend run lighthouse:${route}`);
    assert.ok(auditIndex >= 0 && auditIndex < probeIndex, `${route} must finish before optional traces can fail`);
  }
  const uploadIndex = steps.findIndex(step => step.name === 'Upload Lighthouse reports');
  assert.ok(uploadIndex > probeIndex);
  assert.equal(steps[uploadIndex].if, 'always()');
});

test('admin smoke configuration selects only admin end-to-end specs', () => {
  assert.deepEqual(adminPlaywrightConfig.testMatch, ['**/admin-*.spec.ts']);
});
