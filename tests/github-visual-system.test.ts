import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

import { readImageDimensions, validateImageDecode } from '../scripts/register-github-asset.mjs';

const manifest = JSON.parse(readFileSync('docs/marketing/github-asset-manifest.json', 'utf8')) as {
  assets: Array<{
    id: string;
    path: string;
    kind: string;
    state: string;
    sha256: string;
    claim: string;
    alt: string;
    reviewTrigger: string;
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
  ['plugins/maxvideoai/assets/social/release-0.3.3.png', [1200, 630]],
  ['plugins/maxvideoai/assets/social/directory-thumbnail.png', [1200, 675]],
] as const);

const liveScreenshotDimensions = new Map([
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-assistant-workflow-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-engine-scoreboard-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-examples-gallery-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-model-directory-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-pricing-comparison-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-tools-workflow-live.webp', [1268, 713]],
  ['plugins/maxvideoai/assets/screenshots/maxvideoai-workspace-live.webp', [1268, 713]],
] as const);

const brandHeroPath = 'plugins/maxvideoai/assets/brand/maxvideoai-github-hero-v2.webp';

test('the cancelled 0.3.4 release card remains historical evidence outside active placements', () => {
  const record = manifest.assets.find((asset) => asset.id === 'release-0-3-4');
  assert.ok(record);
  assert.equal(record.state, 'reference_only');
  assert.deepEqual(record.placements, ['historical_release_candidate']);
  assert.match(record.claim, /cancelled before.*publication/i);
  assert.equal(sha256(readFileSync(record.path)), '9af267e52a6a77eff229912d2b4685ac504914f346c342558f32e138811acf8d');
});

const allowedProofIds = new Set([
  'maxvideoai-workspace-production',
  'maxvideoai-library-continuity-production',
]);

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('ships the registered visual-system outputs at their exact target dimensions', async () => {
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

test('ships seven distinct current public product captures for the proof-led README journey', async () => {
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

test('model-directory capture provenance describes only the visible public hero', () => {
  const record = manifest.assets.find((asset) => asset.id === 'maxvideoai-model-directory-live');
  assert.ok(record);
  for (const text of [record.claim, record.alt]) {
    assert.match(text, /public.*model.directory hero/i);
    assert.match(text, /Browse models.*Compare engines/i);
    assert.match(text, /pricing.*specification cues/i);
    assert.match(text, /colorful model artwork/i);
  }
  for (const text of [record.claim, record.alt, record.reviewTrigger]) {
    assert.doesNotMatch(text, /recommended starting points|capability summaries|editorial scores/i);
    assert.doesNotMatch(text, /recommendation|ranking|generation|assistant execution/i);
  }
  assert.match(record.reviewTrigger, /hero.*actions.*pricing.*specification cues.*artwork/i);
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

test('composition code uses only accepted public proof sources, stays light, and makes no native host-proof claim', () => {
  const source = readFileSync('scripts/compose-github-visual-system.mjs', 'utf8');
  assert.match(source, /maxvideoai-workspace-production\.jpg/);
  assert.match(source, /maxvideoai-library-continuity-production\.jpg/);
  assert.doesNotMatch(source, /frontend\/public\/media\/mcp|brand\/partners\/(?:openai|anthropic)|codex-plugin/i);
  assert.doesNotMatch(source, /AI video production inside\s+ChatGPT/i);
  assert.match(source, /AI production\\nfor assistants & automations/);
  assert.match(source, /Claude · ChatGPT · Codex · OpenClaw · n8n/);
  assert.match(source, /Plan\. Compare\. Price\. Approve\. Create\./);
  assert.doesNotMatch(source, /base\(width, height, 'dark'/, 'all refreshed GitHub artwork must use the light visual system');
  assert.doesNotMatch(source, /alpha: 0\.76/, 'release artwork must not place copy on a black panel');
  assert.match(source, /withoutEnlargement: true/);
  assert.match(source, /fontfile:/, 'text composition must pin a repository-resolved font file');
  assert.doesNotMatch(source, /font_family="Helvetica"/, 'system Helvetica would make recomposition platform-dependent');
  assert.match(source, /readFileSync\([^\n]*VERSION/);
  assert.match(source, /`RELEASE \$\{pluginVersion\}`/);
  assert.match(source, /`release-\$\{pluginVersion\}\.png`/);
  assert.doesNotMatch(source, /RELEASE 0\.3\.2/);

  const socialRecords = manifest.assets.filter((asset) => asset.path.startsWith('plugins/maxvideoai/assets/social/'));
  for (const record of socialRecords) {
    assert.match(record.claim, /no native ChatGPT, Claude, or Codex host proof/i);
  }

  const modelRecord = manifest.assets.find((asset) => asset.id === 'model-choice-and-budget');
  assert.match(modelRecord?.claim ?? '', /does not show or prove a budget, quote, price, approval, or native host execution/i);
});

test('the narrow proof uses the complete current public page instead of stale workspace-coordinate crops', () => {
  const source = readFileSync('scripts/compose-github-visual-system.mjs', 'utf8');
  const functionBody = source.match(/async function modelChoiceAndBudget\(\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.match(functionBody, /fittedImage\(paths\.workspace/);
  assert.doesNotMatch(functionBody, /croppedImage\(paths\.workspace/);
  assert.doesNotMatch(functionBody, /left: 220, top: 86/);
});
