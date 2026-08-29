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
const nextTaskQueuePath = path.join(repositoryRoot, 'docs/marketing/github-next-task-queue.md');

const expectedAfterScores = {
  conversion: 89,
  voice: 90,
  visual: 95,
  seo: 92,
  human_geo: 91,
  agent_discovery: 84,
  trust: 94,
  distribution: 62,
  measurement: 62,
} as const;

const requiredQueueGroups = [
  'Immediate blockers',
  'First 14 days',
  'Days 15–30',
  'Days 31–60',
  'Days 61–90',
] as const;

const allowedQueueStatuses = new Set(['planned', 'blocked', 'ready', 'in_progress', 'complete']);

const expectedQueueTaskNames = [
  'Add a privacy-reviewed opaque GitHub landing-to-MCP association and cover every real funnel emitter, including Library opens.',
  'Reconcile this branch with the approved public copy wave without overwriting its host wording or the distinction between public listing and developer MCP.',
  'Build and verify the focused repository README and tagged release from the exact reviewed public bundle.',
  'Recheck every distribution policy and legal gate against its primary source.',
  'Open the clean acquisition cohort and preserve raw exclusions.',
  'Fix the highest verified full-funnel drop-off.',
  'Triage public issues and discussions with proof-first answers.',
  'Review first-screen copy only against observed narrow-render and click behavior.',
  'Submit only authoritative channels that are newly eligible and verified.',
  'Publish four proof or decision pieces from the reviewed eight-week calendar.',
  'Earn the first three contextual referring domains through useful documentation and examples.',
  'Record real Claude and Codex discovery evaluations separately from curated policy.',
  'Publish the first data-backed model decision report and project-budget breakdown.',
  'Expand the best-converting example into a deeper workflow.',
  'Review license and installation friction from real support evidence.',
  'Improve the weakest verified score dimension.',
  'Compare host and source cohorts without merging unknown identities.',
  'Retain high-value listings and remove low-value directory work from the plan.',
  'Refresh visual assets only when a registered trigger fires.',
  'Set the next commercial-presence target from observed conversion data.',
] as const;

type Scorecard = {
  version: number;
  assessedAt: string;
  verifiedAfterAt?: string;
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
    afterRationale?: string;
    remainingGap?: string;
  }>;
};

function loadScorecard(): Scorecard {
  return JSON.parse(readFileSync(scorecardPath, 'utf8')) as Scorecard;
}

function cloneScorecard(scorecard: Scorecard): Scorecard {
  return JSON.parse(JSON.stringify(scorecard)) as Scorecard;
}

function weightedAfter(scorecard: Scorecard): number | null {
  if (scorecard.dimensions.some((dimension) => dimension.after === null)) return null;
  return Math.round(scorecard.dimensions.reduce(
    (total, dimension) => total + dimension.weight * (dimension.after ?? 0),
    0,
  ) / 100);
}

function validateCloseoutContract(scorecard: Scorecard): string[] {
  const errors = validateScorecard(scorecard, { repositoryRoot });

  if (scorecard.verifiedAfterAt !== '2026-08-29') {
    errors.push('Scorecard verifiedAfterAt must identify the 2026-08-29 evidence review');
  }

  for (const dimension of scorecard.dimensions) {
    if (dimension.after === null) {
      errors.push(`${dimension.id}: verified after score is required`);
      continue;
    }
    if (dimension.after === dimension.target) {
      errors.push(`${dimension.id}: after must not be auto-filled from target`);
    }
    if (dimension.after > 90 && new Set(dimension.afterEvidence).size < 2) {
      errors.push(`${dimension.id}: after scores above 90 require at least two distinct evidence items`);
    }
    if (dimension.after - dimension.before > 20 && !dimension.afterRationale?.trim()) {
      errors.push(`${dimension.id}: a delta above 20 requires an evidence-backed rationale`);
    }
    if (dimension.after < dimension.target && !dimension.remainingGap?.trim()) {
      errors.push(`${dimension.id}: a below-target score requires an explicit remaining gap`);
    }
  }

  const computedAfter = weightedAfter(scorecard);
  if (computedAfter !== scorecard.rubric.weightedTotals.after) {
    errors.push(`Weighted after total must be ${computedAfter}`);
  }

  return errors;
}

function splitMarkdownRow(row: string): string[] {
  return row.slice(1, -1).split('|').map((cell) => cell.trim());
}

function queueTaskRows(markdown: string): string[][] {
  return markdown.split('\n')
    .filter((line) => /^\|.*\|$/.test(line.trim()))
    .map((line) => splitMarkdownRow(line.trim()))
    .filter((cells) => cells[0] !== 'Task' && !cells.every((cell) => /^:?-+:?$/.test(cell)));
}

function removeQueueTask(markdown: string, taskName: string): string {
  return markdown.split('\n').filter((line) => !line.startsWith(`| ${taskName} |`)).join('\n');
}

function queueTaskRow(markdown: string, taskName: string): string[] {
  return queueTaskRows(markdown).find((row) => row[0] === taskName) ?? [];
}

function validateNextTaskQueue(markdown: string): string[] {
  const errors: string[] = [];
  const groupMatches = [...markdown.matchAll(/^## (.+)$/gm)];
  const actualGroups = groupMatches.map((match) => match[1]);
  if (actualGroups.join('\n') !== requiredQueueGroups.join('\n')) {
    errors.push('Queue must contain the five required dependency groups in order');
  }
  if (!/This queue is an operational document only; it does not create recurring automation\./.test(markdown)) {
    errors.push('Queue must state that it does not create recurring automation');
  }

  const allTaskRows = queueTaskRows(markdown);
  const taskNames = allTaskRows.map((row) => row[0]);
  if (taskNames.length !== expectedQueueTaskNames.length
    || new Set(taskNames).size !== expectedQueueTaskNames.length
    || taskNames.join('\n') !== expectedQueueTaskNames.join('\n')) {
    errors.push(`Queue must contain exactly ${expectedQueueTaskNames.length} unique required tasks in dependency order`);
  }

  groupMatches.forEach((match, groupIndex) => {
    if (!requiredQueueGroups.includes(match[1] as typeof requiredQueueGroups[number])) return;
    const sectionStart = (match.index ?? 0) + match[0].length;
    const sectionEnd = groupMatches[groupIndex + 1]?.index ?? markdown.length;
    const section = markdown.slice(sectionStart, sectionEnd);
    const rows = queueTaskRows(section);

    if (rows.length === 0) {
      errors.push(`${match[1]}: at least one task is required`);
      return;
    }

    for (const row of rows) {
      if (row.length !== 8 || row.some((cell) => cell.length === 0)) {
        errors.push(`${match[1]}: every task requires all eight queue fields`);
        continue;
      }
      if (!allowedQueueStatuses.has(row[7])) {
        errors.push(`${match[1]}: unsupported status ${row[7]}`);
      }
      if (/\b(?:cron|rrule|heartbeat|automation_update|automatically scheduled|scheduled codex task)\b/i.test(row.join(' '))) {
        errors.push(`${match[1]}: task rows must not prescribe automation`);
      }
    }
  });

  return errors;
}

test('preserves the approved baseline and records the independently judged verified after score', () => {
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
  assert.equal(scorecard.verifiedAfterAt, '2026-08-29');
  assert.equal(scorecard.rubric.weightedTotals.after, 86);
  assert.deepEqual(
    scorecard.dimensions.map(({ id, weight, before, target }) => ({ id, weight, before, target })),
    Object.entries(expected).map(([id, values]) => ({ id, ...values })),
  );
  assert.equal(scorecard.dimensions.reduce((total, dimension) => total + dimension.weight, 0), 100);

  for (const dimension of scorecard.dimensions) {
    assert.ok(dimension.before >= 0 && dimension.before <= 100);
    assert.ok(dimension.target >= 0 && dimension.target <= 100);
    assert.equal(dimension.after, expectedAfterScores[dimension.id as keyof typeof expectedAfterScores]);
    assert.ok(dimension.afterEvidence.length >= 1);
  }

  assert.deepEqual(validateCloseoutContract(scorecard), []);
});

test('fails closed for unsupported after scores and external benchmark labeling', () => {
  const scorecard = loadScorecard();

  const afterWithoutEvidence = cloneScorecard(scorecard);
  afterWithoutEvidence.dimensions[0].after = 55;
  afterWithoutEvidence.dimensions[0].afterEvidence = [];
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

  const nonTargetWithoutIndependentEvidence = cloneScorecard(scorecard);
  nonTargetWithoutIndependentEvidence.dimensions[0].after = 55;
  nonTargetWithoutIndependentEvidence.dimensions[0].afterEvidence = [
    ...nonTargetWithoutIndependentEvidence.dimensions[0].beforeEvidence,
  ];
  assert.match(
    validateScorecard(nonTargetWithoutIndependentEvidence, { repositoryRoot }).join('\n'),
    /independent after evidence/i,
  );

  const externalBenchmark = cloneScorecard(scorecard);
  externalBenchmark.rubric.benchmark = 'External benchmark';
  assert.match(
    validateScorecard(externalBenchmark, { repositoryRoot }).join('\n'),
    /internal.*not an external benchmark/i,
  );
});

test('reports the verified after score in markdown and JSON and satisfies the require-after gate', () => {
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
  assert.match(markdown.stdout, /86/);

  const json = spawnSync(process.execPath, [scoreCommandPath, '--format', 'json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(json.status, 0, json.stderr);
  const report = JSON.parse(json.stdout) as { weightedTotals: { before: number; target: number; after: number } };
  assert.deepEqual(report.weightedTotals, { before: 46, target: 85, after: 86 });

  const requireAfter = spawnSync(process.execPath, [scoreCommandPath, '--require-after'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(requireAfter.status, 0, requireAfter.stderr);
  assert.match(requireAfter.stdout, /86/);
});

test('rejects unsupported closeout evidence, unexplained jumps, missing gaps, and target auto-fill', () => {
  const scorecard = loadScorecard();

  const oneEvidenceAboveNinety = cloneScorecard(scorecard);
  oneEvidenceAboveNinety.dimensions[1].after = 91;
  oneEvidenceAboveNinety.dimensions[1].afterEvidence = ['README.md'];
  assert.match(validateCloseoutContract(oneEvidenceAboveNinety).join('\n'), /above 90.*two distinct evidence/i);

  const duplicateEvidenceAboveNinety = cloneScorecard(scorecard);
  duplicateEvidenceAboveNinety.dimensions[1].after = 91;
  duplicateEvidenceAboveNinety.dimensions[1].afterEvidence = ['README.md', 'README.md'];
  assert.match(validateCloseoutContract(duplicateEvidenceAboveNinety).join('\n'), /above 90.*two distinct evidence/i);

  const missingLargeDeltaRationale = cloneScorecard(scorecard);
  missingLargeDeltaRationale.dimensions[0].afterRationale = '';
  assert.match(validateCloseoutContract(missingLargeDeltaRationale).join('\n'), /delta above 20.*rationale/i);

  const missingBelowTargetGap = cloneScorecard(scorecard);
  missingBelowTargetGap.dimensions[5].remainingGap = '';
  assert.match(validateCloseoutContract(missingBelowTargetGap).join('\n'), /below-target.*remaining gap/i);

  const targetAutoFill = cloneScorecard(scorecard);
  targetAutoFill.dimensions[0].after = targetAutoFill.dimensions[0].target;
  targetAutoFill.dimensions[0].afterEvidence = ['README.md', 'https://github.com/camgraphe/maxvideoai-plugin'];
  assert.match(validateCloseoutContract(targetAutoFill).join('\n'), /auto-filled from target/i);
});

test('requires a dependency-ordered operational queue with complete non-automated tasks', () => {
  const markdown = readFileSync(nextTaskQueuePath, 'utf8');
  assert.deepEqual(validateNextTaskQueue(markdown), []);

  const reconciliation = queueTaskRow(markdown, expectedQueueTaskNames[1]);
  const publicRelease = queueTaskRow(markdown, expectedQueueTaskNames[2]);
  assert.equal(reconciliation[7], 'complete');
  assert.equal(publicRelease[7], 'complete');
  assert.match(publicRelease.join(' '), /v0\.3\.3[\s\S]*workflow run 33223071787/i);
  assert.match(publicRelease.join(' '), /Node 22\.23\.2[\s\S]*23\.9\.0[\s\S]*24\.19\.0/i);

  assert.match(validateNextTaskQueue(markdown.replace('| planned |', '| queued |')).join('\n'), /unsupported status/i);
  assert.match(
    validateNextTaskQueue(markdown.replace('| Product Analytics + MCP Engineering |', '|  |')).join('\n'),
    /eight queue fields/i,
  );
  assert.match(validateNextTaskQueue(markdown.replace('## Days 31–60', '## Later')).join('\n'), /five required dependency groups/i);
  assert.match(
    validateNextTaskQueue(removeQueueTask(markdown, expectedQueueTaskNames[1])).join('\n'),
    /exactly 20 unique required tasks/i,
  );
  assert.match(
    validateNextTaskQueue(removeQueueTask(markdown, expectedQueueTaskNames[5])).join('\n'),
    /exactly 20 unique required tasks/i,
  );
  assert.match(
    validateNextTaskQueue(markdown.replace('| planned |', '| cron automation |')).join('\n'),
    /must not prescribe automation/i,
  );
});

test("accepts pnpm's argument separator for the package score command", () => {
  const command = spawnSync('pnpm', ['github:score', '--', '--format', 'markdown'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  assert.equal(command.status, 0, command.stderr);
  assert.match(command.stdout, /Weighted total/i);
});
