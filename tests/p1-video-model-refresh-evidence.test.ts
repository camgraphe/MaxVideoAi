import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const evidencePath = 'docs/model-launch/p1-video-model-refresh-evidence.md';

function readEvidence() {
  assert.ok(existsSync(evidencePath), `${evidencePath} should exist`);
  return readFileSync(evidencePath, 'utf8');
}

function parseEvidenceModelIds(evidence: string): string[] {
  const scope = evidence.match(/^## Scope\n([\s\S]*?)(?=^## )/m)?.[1] ?? '';
  return Array.from(scope.matchAll(/^\| `([^`]+)` \|/gm), ([, id]) => id);
}

function parseReleaseGates(evidence: string): Array<{ gate: string; state: string }> {
  const section = evidence.match(/^## Release Gates\n([\s\S]*)$/m)?.[1] ?? '';
  return section
    .split('\n')
    .filter((line) => /^\| .+ \| .+ \| .+ \|$/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells[1] !== 'Gate' && cells[1] !== '---')
    .map((cells) => ({ gate: cells[1], state: cells[2] }));
}

test('P1 evidence freezes the approved scope and release constraints', () => {
  const evidence = readEvidence();

  const scopeIds = parseEvidenceModelIds(evidence);
  assert.deepEqual(scopeIds, [
    'gemini-omni-flash',
    'kling-3-turbo-standard',
    'kling-3-turbo-pro',
    'minimax-h3-max',
  ]);

  for (const heading of [
    'Scope',
    'Google',
    'Kling Direct',
    'Kling Fal Fallback',
    'MiniMax H3 Max',
    'Pricing Inputs',
    'Search Console',
    'Release Gates',
  ]) {
    assert.match(evidence, new RegExp(`^## ${heading}$`, 'm'), `missing ${heading} heading`);
  }

  for (const endpoint of [
    'fal-ai/kling-video/v3/turbo/standard/text-to-video',
    'fal-ai/kling-video/v3/turbo/standard/image-to-video',
    'fal-ai/kling-video/v3/turbo/pro/text-to-video',
    'fal-ai/kling-video/v3/turbo/pro/image-to-video',
    'minimax/h3-max/text-to-video',
    'minimax/h3-max/image-to-video',
    'minimax/h3-max/reference-to-video',
  ]) {
    assert.match(evidence, new RegExp(endpoint.replaceAll('/', '\\/')), `missing Fal endpoint ${endpoint}`);
  }

  for (const slug of [
    'gemini-omni-flash-vs-veo-3-1',
    'gemini-omni-flash-vs-veo-3-1-fast',
    'gemini-omni-flash-vs-sora-2',
    'gemini-omni-flash-vs-seedance-2-0',
  ]) {
    assert.match(evidence, new RegExp(slug), `missing preserved Gemini comparison ${slug}`);
  }

  for (const alias of ['gemini-omni-flash-1-1', 'gemini-omni-1-1-flash']) {
    assert.match(evidence, new RegExp(alias), `missing Gemini alias ${alias}`);
  }

  assert.doesNotMatch(evidence, /runway/i, 'P1 evidence must not add a Runway product');
  assert.match(evidence, /Kling direct publication gate:\s+proven for P1/);
  assert.match(evidence, /H3 Max 480P rate:\s+\$\d+(?:\.\d+)?\/s/);
  assert.match(evidence, /Google staging probe: HTTP 400 pre-acceptance rejection/);
  assert.match(evidence, /store=true is required for background interactions/);
  assert.match(evidence, /Kling staging probe: HTTP 429 pre-acceptance rejection/);
  assert.match(evidence, /Account balance not enough/);
  assert.match(evidence, /Actual provider debit: \$0\.000 USD for each rejected probe/);
});

test('P1 evidence freezes the excluded identities and H3 search ownership policy', () => {
  const evidence = readEvidence().replace(/\s+/g, ' ');

  assert.match(evidence, /No Gemini Omni Flash 1\.0 product, page, alias, comparison row, or lifecycle entry/i);
  assert.match(evidence, /No MiniMax H3 Max Turbo variant is in scope or may be published/i);
  assert.match(evidence, /Google direct policy: no Fal fallback/i);
  assert.match(evidence, /Generic `minimax h3` intent remains owned by `\/models\/minimax-h3`/i);
  assert.match(evidence, /Exact `minimax h3 max` intent is owned by `\/models\/minimax-h3-max`/i);
  assert.match(evidence, /Public publisher: MiniMax; public family: Hailuo/i);
});

test('P1 evidence assigns a permitted state to every release gate', () => {
  const gates = parseReleaseGates(readEvidence());
  assert.ok(gates.length >= 8, `expected release gates, got ${gates.length}`);

  for (const gate of gates) {
    assert.ok(
      ['proven', 'blocked', 'not-applicable'].includes(gate.state),
      `${gate.gate} has invalid release state ${gate.state}`,
    );
  }

  assert.equal(
    gates.find((gate) => gate.gate === 'Kling direct provider contract')?.state,
    'proven',
    'the active direct mapping must fail over once on the observed depleted-balance response',
  );
});
