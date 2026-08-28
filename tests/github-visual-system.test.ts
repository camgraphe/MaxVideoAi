import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

import { readImageDimensions, validateImageDecode } from '../scripts/register-github-asset.mjs';

const manifest = JSON.parse(readFileSync('docs/marketing/github-asset-manifest.json', 'utf8')) as {
  assets: Array<{
    id: string;
    path: string;
    state: string;
    sha256: string;
    claim: string;
    sourceProofIds?: string[];
    editorialSourceId?: string;
  }>;
};

const outputDimensions = new Map([
  ['plugins/maxvideoai/assets/demos/readme-proof-hero.webp', [1600, 900]],
  ['plugins/maxvideoai/assets/demos/brief-to-video-workflow.webp', [1600, 900]],
  ['plugins/maxvideoai/assets/demos/model-choice-and-budget.webp', [800, 450]],
  ['plugins/maxvideoai/assets/demos/library-continuity.webp', [1600, 900]],
  ['plugins/maxvideoai/assets/social/github-social-preview.png', [1280, 640]],
  ['plugins/maxvideoai/assets/social/release-0.3.0.png', [1200, 630]],
  ['plugins/maxvideoai/assets/social/release-0.3.2.png', [1200, 630]],
  ['plugins/maxvideoai/assets/social/directory-thumbnail.png', [1200, 675]],
] as const);

const allowedProofIds = new Set([
  'maxvideoai-workspace-production',
  'maxvideoai-library-continuity-production',
]);

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('ships the eight visual-system outputs at their exact target dimensions', async () => {
  for (const [path, [expectedWidth, expectedHeight]] of outputDimensions) {
    const bytes = readFileSync(path);
    const { width, height } = readImageDimensions(bytes);
    await validateImageDecode(bytes);
    assert.deepEqual([width, height], [expectedWidth, expectedHeight], path);
    const record = manifest.assets.find((asset) => asset.path === path);
    assert.ok(record, `${path} must be registered`);
    assert.equal(record.state, 'publishable_proof');
    assert.equal(record.sha256, sha256(bytes));
    assert.equal(record.editorialSourceId, 'maxvideoai-editorial-branch-converge-source');
    assert.ok(record.sourceProofIds?.length, `${path} must name its source proof`);
    assert.ok(record.sourceProofIds?.every((id) => allowedProofIds.has(id)), `${path} must use only Task 4 proof IDs`);
  }

  assert.ok(
    statSync('plugins/maxvideoai/assets/social/github-social-preview.png').size < 1_000_000,
    'GitHub social preview must remain under 1 MB'
  );
});

test('pins the built-in ImageGen source as draft editorial, never product proof', async () => {
  const path = 'plugins/maxvideoai/assets/sources/maxvideoai-editorial-branch-converge-source.png';
  const bytes = readFileSync(path);
  const record = manifest.assets.find((asset) => asset.path === path);
  assert.ok(record);
  assert.equal(record.state, 'draft_editorial');
  assert.equal(sha256(bytes), 'ba358a9dfeb78552b6fbcfd50104a7fbbdbe8f07b0bbe5b4c04d5f9201210430');
  assert.deepEqual(readImageDimensions(bytes), { width: 1774, height: 887, format: 'png' });
  await validateImageDecode(bytes);
});

test('composition code uses only the accepted proof sources and makes no native host-proof claim', () => {
  const source = readFileSync('scripts/compose-github-visual-system.mjs', 'utf8');
  assert.match(source, /maxvideoai-workspace-production\.jpg/);
  assert.match(source, /maxvideoai-library-continuity-production\.jpg/);
  assert.doesNotMatch(source, /frontend\/public\/media\/mcp|brand\/partners\/(?:openai|anthropic)|codex-plugin/i);
  assert.doesNotMatch(source, /AI video production inside\s+ChatGPT/i);
  assert.match(source, /AI video production\\nfor agent workflows/);
  assert.match(source, /withoutEnlargement: true/);
  assert.match(source, /fontfile:/, 'text composition must pin a repository-resolved font file');
  assert.doesNotMatch(source, /font_family="Helvetica"/, 'system Helvetica would make recomposition platform-dependent');

  const socialRecords = manifest.assets.filter((asset) => asset.path.startsWith('plugins/maxvideoai/assets/social/'));
  for (const record of socialRecords) {
    assert.match(record.claim, /no native ChatGPT, Claude, or Codex host proof/i);
  }

  const modelRecord = manifest.assets.find((asset) => asset.id === 'model-choice-and-budget');
  assert.match(modelRecord?.claim ?? '', /does not show or prove a budget, quote, price, approval, or native host execution/i);
});
