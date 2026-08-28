import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const matrixPath = 'docs/marketing/github-distribution-matrix.md';
const distributionPath = 'plugins/maxvideoai/docs/distribution.md';
const submissionsPath = 'docs/marketing/mcp-directory-submissions.md';

const knownTargets = [
  'MaxVideoAI owned website documentation',
  'Direct ChatGPT configuration',
  'Direct Codex configuration',
  'Direct Claude custom connector',
  'Generic compatible MCP client',
  'GitHub release and repository',
  'Official MCP Registry',
  'ChatGPT/OpenAI directory',
  'Anthropic Connectors Directory',
  'Maintained MCP catalogs and curated lists',
] as const;

const targetAliases: Record<(typeof knownTargets)[number], readonly string[]> = {
  'MaxVideoAI owned website documentation': ['MaxVideoAI owned website', 'MaxVideoAI website'],
  'Direct ChatGPT configuration': ['Direct ChatGPT configuration', 'ChatGPT direct configuration'],
  'Direct Codex configuration': ['Direct Codex configuration', 'Codex configuration'],
  'Direct Claude custom connector': ['Direct Claude custom connector', 'Claude custom connector'],
  'Generic compatible MCP client': ['Generic compatible MCP client', 'compatible MCP client'],
  'GitHub release and repository': ['GitHub release', 'GitHub repository'],
  'Official MCP Registry': ['Official MCP Registry', 'MCP Registry'],
  'ChatGPT/OpenAI directory': ['ChatGPT/OpenAI directory', 'OpenAI directory', 'ChatGPT directory'],
  'Anthropic Connectors Directory': ['Anthropic Connectors Directory', 'Anthropic directory'],
  'Maintained MCP catalogs and curated lists': ['Maintained MCP catalogs', 'curated lists'],
};

type MatrixTarget = {
  label: (typeof knownTargets)[number];
  status: string;
};

function readRequired(path: string) {
  assert.ok(existsSync(path), `${path} must exist`);
  return readFileSync(path, 'utf8');
}

function parseMatrixTargets(matrix: string): MatrixTarget[] {
  const rows = matrix
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| ---'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  const [header, ...records] = rows;

  assert.deepEqual(
    header,
    ['Target', 'Authority level', 'Audience', 'Status', 'Blocker', 'Required evidence', 'Canonical backlink', 'Next check', 'Submission owner'],
    'distribution matrix must retain its complete readiness columns',
  );

  return records.map((record) => {
    assert.equal(record.length, header.length, `matrix row must have ${header.length} columns: ${record[0]}`);
    return { label: record[0] as MatrixTarget['label'], status: record[3] };
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function positiveClaimPatterns(alias: string) {
  const target = escapeRegExp(alias);
  const product = '(?:MaxVideoAI(?: (?:MCP server|plugin|connector))?|the MaxVideoAI (?:MCP server|plugin|connector))';
  const availability = '(?:submitted|listed|available in)';
  const passive = '(?:(?:is|was|has been|will be)\\s+)?';
  const active = '(?:submits?|submitted|lists?|listed|makes?|made)';

  return [
    new RegExp(`${product}[^.\\n]{0,160}\\b${passive}${availability}\\b[^.\\n]{0,160}\\b${target}\\b`, 'i'),
    new RegExp(`\\b${target}\\b[^.\\n]{0,160}\\b${active}\\b[^.\\n]{0,160}${product}`, 'i'),
  ];
}

test('parses the complete closed distribution target set and rejects unrecognized rows', () => {
  const targets = parseMatrixTargets(readRequired(matrixPath));
  const labels = targets.map((target) => target.label);

  assert.equal(new Set(labels).size, labels.length, 'distribution matrix cannot repeat a target');
  assert.deepEqual([...labels].sort(), [...knownTargets].sort(), 'distribution matrix must use the complete recognized target set');
  assert.ok(targets.every((target) => target.status.length > 0), 'every target must declare a readiness status');
});

test('recognizes active and passive submitted, listed, and available-in claims for every target alias', () => {
  for (const [target, aliases] of Object.entries(targetAliases)) {
    for (const alias of aliases) {
      const patterns = positiveClaimPatterns(alias);
      assert.ok(
        patterns.some((pattern) => pattern.test(`MaxVideoAI is listed in ${alias}.`)),
        `${target} must reject a passive listing claim for ${alias}`,
      );
      assert.ok(
        patterns.some((pattern) => pattern.test(`${alias} lists MaxVideoAI.`)),
        `${target} must reject an active listing claim for ${alias}`,
      );
      assert.ok(
        patterns.some((pattern) => pattern.test(`MaxVideoAI was submitted to ${alias}.`)),
        `${target} must reject a passive submission claim for ${alias}`,
      );
      assert.ok(
        patterns.some((pattern) => pattern.test(`${alias} submits MaxVideoAI.`)),
        `${target} must reject an active submission claim for ${alias}`,
      );
      assert.ok(
        patterns.some((pattern) => pattern.test(`MaxVideoAI is available in ${alias}.`)),
        `${target} must reject a passive availability claim for ${alias}`,
      );
      assert.ok(
        patterns.some((pattern) => pattern.test(`${alias} makes MaxVideoAI available in the client.`)),
        `${target} must reject an active availability claim for ${alias}`,
      );
    }
  }
});

test('does not make a positive availability claim for any target that is not eligible and verified', () => {
  const matrix = readRequired(matrixPath);
  const sources = [matrix, readRequired(distributionPath), readRequired(submissionsPath)].join('\n');
  const targets = parseMatrixTargets(matrix);

  for (const target of targets) {
    if (target.status === 'eligible_and_verified') continue;

    for (const alias of targetAliases[target.label]) {
      for (const pattern of positiveClaimPatterns(alias)) {
        assert.doesNotMatch(
          sources,
          pattern,
          `${target.label} cannot be described as submitted, listed, or available before eligibility and exact-target verification`,
        );
      }
    }
  }
});
