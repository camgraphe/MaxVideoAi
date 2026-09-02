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
  assert.match(evidence, /Kling direct publication gate:\s+(proven|blocked)/);
  assert.match(evidence, /H3 Max 480P rate:\s+\$\d+(?:\.\d+)?\/s/);
  assert.match(evidence, /Google staging probe: HTTP 400 pre-acceptance rejection/);
  assert.match(evidence, /store=true is required for background interactions/);
  assert.match(evidence, /Kling staging probe: HTTP 429 pre-acceptance rejection/);
  assert.match(evidence, /Account balance not enough/);
  assert.match(evidence, /Actual provider debit: \$0\.000 USD for each rejected probe/);
  assert.match(evidence, /\b(proven|blocked|not-applicable)\b/);
});
