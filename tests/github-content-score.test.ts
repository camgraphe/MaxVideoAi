import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateScorecard } from '../scripts/github-content-score.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scorecardPath = path.join(repositoryRoot, 'docs/marketing/github-content-scorecard.json');
const scoreCommandPath = path.join(repositoryRoot, 'scripts/github-content-score.mjs');

type Scorecard = {
  version: number;
  assessedAt: string;
  rubric: {
    benchmark: string;
    weightedTotals: {
      before: number;
      target: number;
      after: number | null;
    };
  };
  dimensions: Array<{
    id: string;
    label: string;
    weight: number;
    before: number;
    target: number;
    after: number | null;
    beforeEvidence: string[];
    afterEvidence: string[];
  }>;
};

function loadScorecard(): Scorecard {
  return JSON.parse(readFileSync(scorecardPath, 'utf8')) as Scorecard;
}

function cloneScorecard(scorecard: Scorecard): Scorecard {
  return JSON.parse(JSON.stringify(scorecard)) as Scorecard;
}

test('establishes the approved internal GitHub transformation baseline', () => {
  const scorecard = loadScorecard();
  const expected = {
    conversion: { weight: 15, before: 30, target: 80 },
    voice: { weight: 10, before: 42, target: 85 },
    visual: { weight: 15, before: 28, target: 85 },
    seo: { weight: 10, before: 62, target: 85 },
    human_geo: { weight: 10, before: 58, target: 88 },
    agent_discovery: { weight: 15, before: 68, target: 90 },
    trust: { weight: 10, before: 64, target: 90 },
    distribution: { weight: 10, before: 18, target: 75 },
    measurement: { weight: 5, before: 45, target: 85 },
  };

  assert.equal(scorecard.version, 1);
  assert.equal(scorecard.assessedAt, '2026-08-27');
  assert.equal(scorecard.rubric.weightedTotals.before, 46);
  assert.equal(scorecard.rubric.weightedTotals.target, 85);
  assert.equal(scorecard.rubric.weightedTotals.after, null);
  assert.deepEqual(
    scorecard.dimensions.map(({ id, weight, before, target }) => ({ id, weight, before, target })),
    Object.entries(expected).map(([id, values]) => ({ id, ...values })),
  );
  assert.equal(scorecard.dimensions.reduce((total, dimension) => total + dimension.weight, 0), 100);

  for (const dimension of scorecard.dimensions) {
    assert.ok(dimension.before >= 0 && dimension.before <= 100);
    assert.ok(dimension.target >= 0 && dimension.target <= 100);
    assert.equal(dimension.after, null);
    assert.deepEqual(dimension.afterEvidence, []);
  }

  assert.deepEqual(validateScorecard(scorecard, { repositoryRoot }), []);
});

test('fails closed for unsupported after scores and external benchmark labeling', () => {
  const scorecard = loadScorecard();

  const afterWithoutEvidence = cloneScorecard(scorecard);
  afterWithoutEvidence.dimensions[0].after = 55;
  assert.match(
    validateScorecard(afterWithoutEvidence, { repositoryRoot }).join('\n'),
    /after evidence/i,
  );

  const missingEvidenceFile = cloneScorecard(scorecard);
  missingEvidenceFile.dimensions[0].after = 55;
  missingEvidenceFile.dimensions[0].afterEvidence = ['docs/marketing/not-a-real-evidence-file.md'];
  assert.match(
    validateScorecard(missingEvidenceFile, { repositoryRoot }).join('\n'),
    /does not exist/i,
  );

  const targetWithoutIndependentEvidence = cloneScorecard(scorecard);
  targetWithoutIndependentEvidence.dimensions[0].after = targetWithoutIndependentEvidence.dimensions[0].target;
  targetWithoutIndependentEvidence.dimensions[0].afterEvidence = [
    ...targetWithoutIndependentEvidence.dimensions[0].beforeEvidence,
  ];
  assert.match(
    validateScorecard(targetWithoutIndependentEvidence, { repositoryRoot }).join('\n'),
    /independent after evidence/i,
  );

  const externalBenchmark = cloneScorecard(scorecard);
  externalBenchmark.rubric.benchmark = 'External benchmark';
  assert.match(
    validateScorecard(externalBenchmark, { repositoryRoot }).join('\n'),
    /internal.*not an external benchmark/i,
  );
});

test('reports the baseline in markdown and JSON without fabricating an after score', () => {
  const markdown = spawnSync(process.execPath, [scoreCommandPath, '--format', 'markdown'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(markdown.status, 0, markdown.stderr);
  assert.match(markdown.stdout, /Before/i);
  assert.match(markdown.stdout, /Target/i);
  assert.match(markdown.stdout, /Current after/i);
  assert.match(markdown.stdout, /46/);
  assert.match(markdown.stdout, /85/);
  assert.match(markdown.stdout, /Unmeasured/i);

  const json = spawnSync(process.execPath, [scoreCommandPath, '--format', 'json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(json.status, 0, json.stderr);
  const report = JSON.parse(json.stdout) as { weightedTotals: { before: number; target: number; after: null } };
  assert.deepEqual(report.weightedTotals, { before: 46, target: 85, after: null });

  const requireAfter = spawnSync(process.execPath, [scoreCommandPath, '--require-after'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.notEqual(requireAfter.status, 0);
  assert.match(requireAfter.stderr, /after.*unsupported|unsupported.*after/i);
});

test("accepts pnpm's argument separator for the package score command", () => {
  const command = spawnSync('pnpm', ['github:score', '--', '--format', 'markdown'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  assert.equal(command.status, 0, command.stderr);
  assert.match(command.stdout, /Weighted total/i);
});
