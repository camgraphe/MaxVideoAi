import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const scorecardPath = path.join(repositoryRoot, 'docs/marketing/github-content-scorecard.json');

const expectedDimensions = [
  { id: 'conversion', weight: 15, before: 30, target: 80 },
  { id: 'voice', weight: 10, before: 42, target: 85 },
  { id: 'visual', weight: 15, before: 28, target: 85 },
  { id: 'seo', weight: 10, before: 62, target: 85 },
  { id: 'human_geo', weight: 10, before: 58, target: 88 },
  { id: 'agent_discovery', weight: 15, before: 68, target: 90 },
  { id: 'trust', weight: 10, before: 64, target: 90 },
  { id: 'distribution', weight: 10, before: 18, target: 75 },
  { id: 'measurement', weight: 5, before: 45, target: 85 },
];

function isScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function isPublicUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validateEvidence(value, dimensionId, evidenceType, rootDirectory) {
  if (typeof value !== 'string' || value.length === 0) {
    return `${dimensionId}: ${evidenceType} evidence entries must be non-empty strings`;
  }

  if (isPublicUrl(value)) {
    return null;
  }

  if (path.isAbsolute(value) || value.split('/').includes('..') || value.includes('\\')) {
    return `${dimensionId}: ${evidenceType} evidence must be a repository-relative path or public HTTP(S) URL: ${value}`;
  }

  const resolvedPath = path.resolve(rootDirectory, value);
  if (!resolvedPath.startsWith(`${rootDirectory}${path.sep}`) || !existsSync(resolvedPath)) {
    return `${dimensionId}: ${evidenceType} evidence does not exist: ${value}`;
  }

  if (!statSync(resolvedPath).isFile()) {
    return `${dimensionId}: ${evidenceType} evidence must reference a file: ${value}`;
  }

  return null;
}

function roundWeightedTotal(dimensions, field) {
  if (dimensions.some((dimension) => dimension[field] === null)) {
    return null;
  }

  return Math.round(dimensions.reduce((total, dimension) => total + (dimension.weight * dimension[field]), 0) / 100);
}

export function validateScorecard(scorecard, { repositoryRoot: rootDirectory = repositoryRoot } = {}) {
  const errors = [];

  if (!scorecard || typeof scorecard !== 'object') {
    return ['Scorecard must be an object'];
  }

  if (scorecard.version !== 1) {
    errors.push('Scorecard version must be 1');
  }
  if (scorecard.assessedAt !== '2026-08-27') {
    errors.push('Scorecard assessedAt must be 2026-08-27');
  }
  if (!scorecard.rubric || typeof scorecard.rubric !== 'object') {
    errors.push('Scorecard rubric is required');
  } else {
    if (typeof scorecard.rubric.benchmark !== 'string' || !/internal/i.test(scorecard.rubric.benchmark) || !/not an external benchmark/i.test(scorecard.rubric.benchmark)) {
      errors.push('Scorecard rubric must identify this as an internal assessment, not an external benchmark');
    }
    if (!scorecard.rubric.weightedTotals || typeof scorecard.rubric.weightedTotals !== 'object') {
      errors.push('Scorecard rubric weightedTotals are required');
    }
  }

  if (!Array.isArray(scorecard.dimensions) || scorecard.dimensions.length !== expectedDimensions.length) {
    errors.push(`Scorecard must define exactly ${expectedDimensions.length} dimensions`);
    return errors;
  }

  let totalWeight = 0;
  for (let index = 0; index < expectedDimensions.length; index += 1) {
    const expected = expectedDimensions[index];
    const dimension = scorecard.dimensions[index];
    if (!dimension || typeof dimension !== 'object') {
      errors.push(`Dimension ${index + 1} must be an object`);
      continue;
    }

    if (dimension.id !== expected.id) {
      errors.push(`Dimension ${index + 1} must be ${expected.id}`);
    }
    if (typeof dimension.label !== 'string' || dimension.label.trim().length === 0) {
      errors.push(`${expected.id}: label is required`);
    }
    for (const field of ['weight', 'before', 'target']) {
      if (!isScore(dimension[field])) {
        errors.push(`${expected.id}: ${field} must be between 0 and 100`);
      }
    }
    if (dimension.weight !== expected.weight || dimension.before !== expected.before || dimension.target !== expected.target) {
      errors.push(`${expected.id}: weight, before, and target must match the approved baseline`);
    }
    totalWeight += dimension.weight;

    if (dimension.after !== null && !isScore(dimension.after)) {
      errors.push(`${expected.id}: after must be null or between 0 and 100`);
    }
    for (const evidenceType of ['before', 'after']) {
      const evidenceField = `${evidenceType}Evidence`;
      if (!Array.isArray(dimension[evidenceField])) {
        errors.push(`${expected.id}: ${evidenceField} must be an array`);
        continue;
      }
      for (const evidence of dimension[evidenceField]) {
        const error = validateEvidence(evidence, expected.id, evidenceType, rootDirectory);
        if (error) errors.push(error);
      }
    }
    if (dimension.beforeEvidence.length === 0) {
      errors.push(`${expected.id}: before evidence is required`);
    }
    if (dimension.after === null && dimension.afterEvidence.length > 0) {
      errors.push(`${expected.id}: after evidence is unsupported while after is null`);
    }
    if (dimension.after !== null && dimension.afterEvidence.length === 0) {
      errors.push(`${expected.id}: after evidence is required for an after score`);
    }
    if (dimension.after === dimension.target && !dimension.afterEvidence.some((evidence) => !dimension.beforeEvidence.includes(evidence))) {
      errors.push(`${expected.id}: a target after score requires independent after evidence`);
    }
  }

  if (totalWeight !== 100) {
    errors.push(`Dimension weights must total 100; received ${totalWeight}`);
  }

  const computedTotals = {
    before: roundWeightedTotal(scorecard.dimensions, 'before'),
    target: roundWeightedTotal(scorecard.dimensions, 'target'),
    after: roundWeightedTotal(scorecard.dimensions, 'after'),
  };
  if (scorecard.rubric?.weightedTotals) {
    for (const [field, total] of Object.entries(computedTotals)) {
      if (scorecard.rubric.weightedTotals[field] !== total) {
        errors.push(`Weighted ${field} total must be ${total}`);
      }
    }
  }

  return errors;
}

export function createScoreReport(scorecard) {
  return {
    assessedAt: scorecard.assessedAt,
    rubric: scorecard.rubric.benchmark,
    dimensions: scorecard.dimensions.map((dimension) => ({
      id: dimension.id,
      label: dimension.label,
      weight: dimension.weight,
      before: dimension.before,
      target: dimension.target,
      after: dimension.after,
    })),
    weightedTotals: scorecard.rubric.weightedTotals,
  };
}

function formatMarkdown(report) {
  const rows = report.dimensions.map((dimension) => (
    `| ${dimension.label} | ${dimension.weight}% | ${dimension.before} | ${dimension.target} | ${dimension.after ?? 'Unmeasured'} |`
  ));
  rows.push(`| **Weighted total** | **100%** | **${report.weightedTotals.before}** | **${report.weightedTotals.target}** | **${report.weightedTotals.after ?? 'Unmeasured'}** |`);

  return [
    '# GitHub commercial-presence score',
    '',
    report.rubric,
    '',
    '| Dimension | Weight | Before | Target | Current after |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows,
  ].join('\n');
}

function parseArguments(argumentsList) {
  const options = { format: 'markdown', requireAfter: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--') {
      continue;
    }
    if (argument === '--format') {
      options.format = argumentsList[index + 1];
      index += 1;
    } else if (argument === '--require-after') {
      options.requireAfter = true;
    } else {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }
  if (!['markdown', 'json'].includes(options.format)) {
    throw new Error(`Unsupported format: ${options.format}`);
  }
  return options;
}

export function runScoreCommand(argumentsList = process.argv.slice(2)) {
  const options = parseArguments(argumentsList);
  const scorecard = JSON.parse(readFileSync(scorecardPath, 'utf8'));
  const validationErrors = validateScorecard(scorecard);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid GitHub content scorecard:\n- ${validationErrors.join('\n- ')}`);
  }

  if (options.requireAfter && scorecard.dimensions.some((dimension) => dimension.after === null)) {
    throw new Error('After scores are unsupported until every dimension has independent after evidence.');
  }

  const report = createScoreReport(scorecard);
  process.stdout.write(`${options.format === 'json' ? JSON.stringify(report, null, 2) : formatMarkdown(report)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runScoreCommand();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
