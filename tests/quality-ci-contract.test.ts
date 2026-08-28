import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import YAML from 'yaml';

type WorkflowStep = {
  name?: string;
  uses?: string;
  with?: Record<string, unknown>;
};

type QualityWorkflow = {
  jobs: {
    quality: {
      steps: WorkflowStep[];
    };
  };
};

const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'quality.yml');

test('quality CI checks out complete history for revision provenance tests', () => {
  const workflow = YAML.parse(readFileSync(workflowPath, 'utf8')) as QualityWorkflow;
  const checkout = workflow.jobs.quality.steps.find((step) => step.name === 'Checkout');

  assert.equal(checkout?.with?.['fetch-depth'], 0);
});
