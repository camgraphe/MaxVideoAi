import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  findReadmeImageReferences,
  validateGithubAssetManifest,
  validateReleaseReadmeAssets,
} from '../scripts/check-github-assets.mjs';
import { readImageDimensions } from '../scripts/register-github-asset.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repositoryRoot, 'docs/marketing/github-asset-manifest.json');
const checkCommandPath = path.join(repositoryRoot, 'scripts/check-github-assets.mjs');

function png(width = 3, height = 2): Buffer {
  const buffer = Buffer.alloc(45);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer.write('IEND', 37, 'ascii');
  return buffer;
}

function jpeg(width = 7, height = 5): Buffer {
  const data = Buffer.alloc(23);
  data.set([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8]);
  data.writeUInt16BE(height, 7);
  data.writeUInt16BE(width, 9);
  data.set([3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0], 11);
  data.set([0xff, 0xd9], 21);
  return data;
}

function webp(width = 9, height = 4): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(22, 4);
  buffer.write('WEBPVP8X', 8, 'ascii');
  buffer.writeUInt32LE(10, 16);
  buffer[20] = 0;
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

function createFixtureRepository() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'github-assets-'));
  mkdirSync(path.join(root, 'assets'), { recursive: true });
  const imagePath = path.join(root, 'assets', 'workflow.png');
  const bytes = png();
  writeFileSync(imagePath, bytes);

  const asset = {
    id: 'maxvideoai-workflow-proof',
    path: 'assets/workflow.png',
    kind: 'product_proof',
    state: 'publishable_proof',
    capturedAt: '2026-08-27',
    sourceEnvironment: 'production',
    host: null,
    hostVersion: null,
    maxvideoaiRevision: 'a'.repeat(40),
    width: 3,
    height: 2,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    claim: 'MaxVideoAI shows a completed workflow with safe sample data.',
    placements: ['root_readme'],
    alt: 'MaxVideoAI workflow showing a completed generation with safe sample data',
    reviewTrigger: 'Refresh after a meaningful workflow release.',
    approvedBy: 'MaxVideoAI owner',
  };

  return { root, asset };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('reads deterministic PNG, JPEG, and WebP dimensions and rejects malformed bytes', () => {
  assert.deepEqual(readImageDimensions(png()), { width: 3, height: 2, format: 'png' });
  assert.deepEqual(readImageDimensions(jpeg()), { width: 7, height: 5, format: 'jpeg' });
  assert.deepEqual(readImageDimensions(webp()), { width: 9, height: 4, format: 'webp' });
  assert.throws(() => readImageDimensions(Buffer.from('not-an-image')), /unsupported|malformed/i);
  assert.throws(() => readImageDimensions(png().subarray(0, 24)), /malformed/i);
  assert.throws(() => readImageDimensions(jpeg().subarray(0, -2)), /malformed/i);
});

test('validates publishable proof provenance against the current committed image bytes', () => {
  const fixture = createFixtureRepository();
  try {
    assert.deepEqual(validateGithubAssetManifest({ version: 1, assets: [fixture.asset] }, {
      repositoryRoot: fixture.root,
    }), []);

    const invalid = clone(fixture.asset);
    invalid.id = 'asset 1';
    invalid.path = '../outside.png';
    invalid.sha256 = 'invalid';
    invalid.width = 0;
    invalid.claim = '';
    invalid.alt = 'screenshot';
    invalid.state = 'unapproved';
    assert.match(validateGithubAssetManifest({ version: 1, assets: [invalid] }, {
      repositoryRoot: fixture.root,
    }).join('\n'), /semantic|relative|sha256|dimensions|claim|alt|state/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('requires complete approved provenance and host version for publishable host proof', () => {
  const fixture = createFixtureRepository();
  try {
    const hostProof = clone(fixture.asset);
    hostProof.id = 'claude-inline-video-proof';
    hostProof.kind = 'host_proof';
    hostProof.host = 'Claude Desktop';
    hostProof.hostVersion = null;
    hostProof.capturedAt = null;
    hostProof.maxvideoaiRevision = null;
    hostProof.approvedBy = null;
    const errors = validateGithubAssetManifest({ version: 1, assets: [hostProof] }, {
      repositoryRoot: fixture.root,
    }).join('\n');
    assert.match(errors, /capturedAt|hostVersion|maxvideoaiRevision|approvedBy/i);

    hostProof.state = 'reference_only';
    assert.deepEqual(validateGithubAssetManifest({ version: 1, assets: [hostProof] }, {
      repositoryRoot: fixture.root,
    }), []);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('release mode accepts approved proof and explicitly labeled decorative editorial assets only', () => {
  const fixture = createFixtureRepository();
  try {
    const readmePath = path.join(fixture.root, 'README.md');
    writeFileSync(readmePath, '![Workflow proof](assets/workflow.png)\n');
    assert.deepEqual(findReadmeImageReferences(readFileSync(readmePath, 'utf8'), readmePath, fixture.root), ['assets/workflow.png']);
    assert.deepEqual(validateReleaseReadmeAssets({ version: 1, assets: [fixture.asset] }, {
      repositoryRoot: fixture.root,
      readmePaths: [readmePath],
    }), []);

    const referenceOnly = clone(fixture.asset);
    referenceOnly.state = 'reference_only';
    assert.match(validateReleaseReadmeAssets({ version: 1, assets: [referenceOnly] }, {
      repositoryRoot: fixture.root,
      readmePaths: [readmePath],
    }).join('\n'), /publishable_proof|draft_editorial/i);

    const editorial = clone(fixture.asset);
    editorial.id = 'launch-editorial-card';
    editorial.kind = 'editorial';
    editorial.state = 'draft_editorial';
    editorial.sourceEnvironment = 'generated_editorial';
    editorial.capturedAt = '2026-08-27';
    editorial.maxvideoaiRevision = 'b'.repeat(40);
    editorial.claim = 'Editorial-only decorative visual; it is not product or host proof.';
    editorial.placements = ['root_readme'];
    editorial.approvedBy = 'MaxVideoAI owner';
    assert.deepEqual(validateReleaseReadmeAssets({ version: 1, assets: [editorial] }, {
      repositoryRoot: fixture.root,
      readmePaths: [readmePath],
    }), []);

    editorial.claim = 'Workflow proof';
    assert.match(validateReleaseReadmeAssets({ version: 1, assets: [editorial] }, {
      repositoryRoot: fixture.root,
      readmePaths: [readmePath],
    }).join('\n'), /editorial-only/i);

    writeFileSync(readmePath, '![Unverified remote proof](https://example.com/workflow.png)\n');
    assert.match(validateReleaseReadmeAssets({ version: 1, assets: [fixture.asset] }, {
      repositoryRoot: fixture.root,
      readmePaths: [readmePath],
    }).join('\n'), /remote image path/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('ships archival MCP captures with real hashes and dimensions while release mode scans both production READMEs', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const mcpAssets = manifest.assets.filter((asset: { path: string }) => asset.path.startsWith('frontend/public/media/mcp/'));
  assert.equal(mcpAssets.length, 6);
  assert.ok(mcpAssets.every((asset: { state: string }) => asset.state === 'reference_only'));
  assert.deepEqual(validateGithubAssetManifest(manifest, { repositoryRoot }), []);

  const release = spawnSync(process.execPath, [checkCommandPath, '--release'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(release.status, 0, release.stderr);
});
