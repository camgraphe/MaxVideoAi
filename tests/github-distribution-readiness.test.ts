import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const matrixPath = 'docs/marketing/github-distribution-matrix.md';
const distributionPath = 'plugins/maxvideoai/docs/distribution.md';
const submissionsPath = 'docs/marketing/mcp-directory-submissions.md';

function readRequired(path: string) {
  assert.ok(existsSync(path), `${path} must exist`);
  return readFileSync(path, 'utf8');
}

test('does not make an external availability claim before that target is eligible and verified', () => {
  const matrix = readRequired(matrixPath);
  const sources = [matrix, readRequired(distributionPath), readRequired(submissionsPath)].join('\n');

  const ineligibleTargets = [
    {
      label: 'Official MCP Registry',
      matrixStatus: 'prepared_not_submitted',
      positiveClaim: /(?:MaxVideoAI|MaxVideoAI MCP server)[^.\n]{0,100}\b(?:is|was|has been)\s+(?:submitted|listed|available in)\b|\b(?:submitted|listed)\s+(?:MaxVideoAI|the MaxVideoAI MCP server)\b/i,
    },
    {
      label: 'ChatGPT/OpenAI directory',
      matrixStatus: 'do_not_submit',
      positiveClaim: /(?:MaxVideoAI|MaxVideoAI plugin)[^.\n]{0,100}\b(?:is|was|has been)\s+(?:submitted|listed|available in)\b|\b(?:submitted|listed)\s+(?:MaxVideoAI|the MaxVideoAI plugin)\b/i,
    },
    {
      label: 'Anthropic Connectors Directory',
      matrixStatus: 'do_not_submit',
      positiveClaim: /(?:MaxVideoAI|MaxVideoAI connector)[^.\n]{0,100}\b(?:is|was|has been)\s+(?:submitted|listed|available in)\b|\b(?:submitted|listed)\s+(?:MaxVideoAI|the MaxVideoAI connector)\b/i,
    },
  ];

  for (const target of ineligibleTargets) {
    assert.match(
      matrix,
      new RegExp(`\\| ${target.label.replace('/', '\\/')} \\|[^\\n]*\\| ${target.matrixStatus} \\|`),
      `${target.label} must publish its current gate in the distribution matrix`,
    );
    assert.doesNotMatch(
      sources,
      target.positiveClaim,
      `${target.label} cannot be described as submitted, listed, or available before eligibility and exact-host verification`,
    );
  }
});
