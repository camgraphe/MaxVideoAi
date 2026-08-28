import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

import { readImageDimensions, validateImageDecode } from '../scripts/register-github-asset.mjs';

const requireFromFrontend = createRequire(new URL('../frontend/package.json', import.meta.url));
const sharp = requireFromFrontend('sharp');

const manifest = JSON.parse(readFileSync('docs/marketing/github-asset-manifest.json', 'utf8')) as {
  assets: Array<{
    id: string;
    path: string;
    kind: string;
    state: string;
    sha256: string;
    claim: string;
    placements?: string[];
    sourceProofIds?: string[];
    editorialSourceId?: string;
  }>;
};

const outputDimensions = new Map([
  ['plugins/maxvideoai/assets/demos/readme-proof-hero.webp', [1600, 900]],
  ['plugins/maxvideoai/assets/demos/brief-to-video-workflow.webp', [1600, 900]],
  ['plugins/maxvideoai/assets/demos/model-choice-and-budget.webp', [480, 640]],
  ['plugins/maxvideoai/assets/demos/library-continuity.webp', [1600, 900]],
  ['plugins/maxvideoai/assets/social/github-social-preview.png', [1280, 640]],
  ['plugins/maxvideoai/assets/social/release-0.3.0.png', [1200, 630]],
  ['plugins/maxvideoai/assets/social/release-0.3.2.png', [1200, 630]],
  ['plugins/maxvideoai/assets/social/directory-thumbnail.png', [1200, 675]],
] as const);

const liveScreenshotDimensions = new Map([
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-assistant-workflow-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-engine-scoreboard-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-examples-gallery-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-model-directory-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-pricing-comparison-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-workspace-live.webp', [1268, 713]],
] as const);

const brandHeroPath = 'plugins/maxvideoai/assets/brand/maxvideoai-github-hero-v2.webp';

const allowedProofIds = new Set([
  'maxvideoai-workspace-production',
  'maxvideoai-library-continuity-production',
]);

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function meanAbsoluteDifference(left: Buffer, right: Buffer): number {
  assert.equal(left.length, right.length);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference += Math.abs(left[index] - right[index]);
  return difference / left.length;
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

test('ships six distinct current product captures for the proof-led README journey', async () => {
  const hashes = new Set<string>();
  for (const [path, [expectedWidth, expectedHeight]] of liveScreenshotDimensions) {
    const bytes = readFileSync(path);
    const { width, height } = readImageDimensions(bytes);
    await validateImageDecode(bytes);
    assert.deepEqual([width, height], [expectedWidth, expectedHeight], path);

    const digest = sha256(bytes);
    assert.ok(!hashes.has(digest), `${path} must not duplicate another live screenshot`);
    hashes.add(digest);

    const record = manifest.assets.find((asset) => asset.path === path);
    assert.ok(record, `${path} must be registered`);
    assert.equal(record.kind, 'product_proof');
    assert.equal(record.state, 'publishable_proof');
    assert.equal(record.sha256, digest);
    assert.ok(record.placements?.includes('root_readme'));
    assert.ok(record.placements?.includes('plugin_readme'));
  }

  const rootReadme = readFileSync('README.md', 'utf8');
  const pluginReadme = readFileSync('plugins/maxvideoai/README.md', 'utf8');
  for (const obsoleteComposite of [
    'assets/demos/readme-proof-hero.webp',
    'assets/demos/brief-to-video-workflow.webp',
    'assets/demos/model-choice-and-budget.webp',
    'assets/demos/library-continuity.webp',
  ]) {
    assert.doesNotMatch(rootReadme, new RegExp(obsoleteComposite.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(pluginReadme, new RegExp(obsoleteComposite.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('ships a dedicated editorial hero without presenting it as product or host proof', async () => {
  const bytes = readFileSync(brandHeroPath);
  await validateImageDecode(bytes);
  assert.deepEqual(readImageDimensions(bytes), { width: 1600, height: 587, format: 'webp' });

  const record = manifest.assets.find((asset) => asset.path === brandHeroPath);
  assert.ok(record);
  assert.equal(record.kind, 'editorial');
  assert.equal(record.state, 'publishable_proof');
  assert.equal(record.sha256, sha256(bytes));
  assert.deepEqual(record.placements, ['root_readme']);
  assert.match(record.claim, /not product UI or native host proof/i);

  const rootReadme = readFileSync('README.md', 'utf8');
  assert.match(rootReadme, /maxvideoai-github-hero-v2\.webp/);
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

test('the narrow model-choice proof keeps the real selector readable around a 390px GitHub viewport', async () => {
  const assetPath = 'plugins/maxvideoai/assets/demos/model-choice-and-budget.webp';
  const workspacePath = 'plugins/maxvideoai/assets/screenshots/maxvideoai-workspace-production.jpg';
  const asset = readFileSync(assetPath);
  const expectedSelector = await sharp(workspacePath)
    .extract({ left: 220, top: 86, width: 380, height: 75 })
    .removeAlpha()
    .raw()
    .toBuffer();
  const renderedSelector = await sharp(asset)
    .extract({ left: 50, top: 55, width: 380, height: 75 })
    .removeAlpha()
    .raw()
    .toBuffer();

  assert.ok(
    meanAbsoluteDifference(expectedSelector, renderedSelector) < 18,
    'the selector region must remain a real native-scale crop, not redrawn or materially resampled UI',
  );

  const githubContentWidthAt390 = 358;
  const renderedSelectorHeight = 75 * (githubContentWidthAt390 / 480);
  assert.ok(renderedSelectorHeight >= 55, 'the selector must stay at least 55px tall in the narrow README render');
});
