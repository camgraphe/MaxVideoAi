import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import {
  findReadmeImageReferences,
  findReadmeImageUsages,
  validateGithubAssetManifest,
  validateReleaseReadmeAssets,
} from '../scripts/check-github-assets.mjs';
import {
  describeGithubAsset,
  readImageDimensions,
  validateImageDecode,
} from '../scripts/register-github-asset.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repositoryRoot, 'docs/marketing/github-asset-manifest.json');
const checkCommandPath = path.join(repositoryRoot, 'scripts/check-github-assets.mjs');
const now = new Date('2026-08-28T23:00:00Z');
const verifiedVp8Path = path.join(repositoryRoot, 'frontend/public/assets/marketing/app-dashboard.webp');
const verifiedVp8 = readFileSync(verifiedVp8Path);
const verifiedVp8XPath = path.join(repositoryRoot, 'frontend/public/assets/marketing/comparison-scorecard-transparent.webp');
const verifiedVp8X = readFileSync(verifiedVp8XPath);
// Decoder-valid 16×16 lossless WebP sample: RIFF/WEBP VP8L, encoded by libwebp.
const verifiedVp8L = Buffer.from('UklGRqQAAABXRUJQVlA4TJgAAAAvD8ADEJ+gJmAaJv6NIgB+OkwQZNvMH/QHGMCMtm3T/v/oyjMcAkGI/q8wkQV60LyFNhFN+mjHIsLii69k4KEjAykcRpIUN8u/fAvG+UcLSAohov8TsKYezzX0cupDes+N3nPLACgRQNxEAKXglioBY56YSgCwFwVTCYRyiQymxaBbBkORHoigninHLqk6x9Pz8ea3xrPxBw==', 'base64');
// Decoder-valid 1×1 lossless WebP whose VP8L chunk is 15 bytes.
const tinyVp8L = Buffer.from('UklGRhwAAABXRUJQVlA4TA8AAAAvAAAAAAcQEf0PRET/AwAA', 'base64');

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 'ascii');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function png(width = 3, height = 2): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.alloc(height * (1 + (width * 3)));
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(rows)), pngChunk('IEND', Buffer.alloc(0))]);
}

function svg(width = 12.5, height = 9.25): Buffer {
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Safe test mark"><rect width="${width}" height="${height}" fill="#111827"/></svg>\n`,
  );
}

function jpeg(width = 7, height = 5): Buffer {
  const sof = Buffer.alloc(19);
  sof.set([0xff, 0xc0, 0, 17, 8]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof.set([3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0], 9);
  const sos = Buffer.from([0xff, 0xda, 0, 12, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, sos, Buffer.from([0x7f, 0xff, 0xd9])]);
}

function webpChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(8 + data.length + (data.length % 2));
  chunk.write(type, 0, 'ascii');
  chunk.writeUInt32LE(data.length, 4);
  data.copy(chunk, 8);
  return chunk;
}

function webpContainer(...chunks: Buffer[]): Buffer {
  const payload = Buffer.concat(chunks);
  const buffer = Buffer.alloc(12);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(payload.length + 4, 4);
  buffer.write('WEBP', 8, 'ascii');
  return Buffer.concat([buffer, payload]);
}

function webpVp8X(width = 16, height = 16, payload = verifiedVp8L.subarray(12)): Buffer {
  const header = Buffer.alloc(10);
  header.writeUIntLE(width - 1, 4, 3);
  header.writeUIntLE(height - 1, 7, 3);
  return webpContainer(webpChunk('VP8X', header), payload);
}

function runGit(root: string, argumentsList: string[]): string {
  const result = spawnSync('git', ['-C', root, ...argumentsList], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createFixtureRepository() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'github-assets-'));
  mkdirSync(path.join(root, 'assets'), { recursive: true });
  mkdirSync(path.join(root, 'plugins', 'maxvideoai', 'assets'), { recursive: true });
  const rootBytes = png();
  const pluginBytes = verifiedVp8;
  writeFileSync(path.join(root, 'assets', 'workflow.png'), rootBytes);
  writeFileSync(path.join(root, 'plugins', 'maxvideoai', 'assets', 'launch.webp'), pluginBytes);
  runGit(root, ['init', '--quiet']);
  runGit(root, ['config', 'user.email', 'tests@maxvideoai.local']);
  runGit(root, ['config', 'user.name', 'MaxVideoAI tests']);
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '--quiet', '-m', 'fixture assets']);
  const revision = runGit(root, ['rev-parse', 'HEAD']);

  const shared = {
    state: 'publishable_proof',
    capturedAt: '2026-08-20',
    sourceEnvironment: 'production',
    host: null,
    hostVersion: null,
    maxvideoaiRevision: revision,
    claim: 'MaxVideoAI shows a completed workflow with safe sample data.',
    alt: 'MaxVideoAI workflow showing a completed generation with safe sample data',
    reviewTrigger: 'Refresh after a meaningful workflow release.',
    approvedBy: 'MaxVideoAI owner',
    lastReviewedAt: '2026-08-25',
    lastReviewedRevision: revision,
    freshnessStatus: 'current',
  };
  const rootAsset = {
    id: 'maxvideoai-workflow-proof',
    path: 'assets/workflow.png',
    kind: 'product_proof',
    width: 3,
    height: 2,
    sha256: createHash('sha256').update(rootBytes).digest('hex'),
    placements: ['root_readme'],
    ...shared,
  };
  const pluginAsset = {
    id: 'maxvideoai-launch-editorial',
    path: 'plugins/maxvideoai/assets/launch.webp',
    kind: 'editorial',
    width: 1679,
    height: 1127,
    sha256: createHash('sha256').update(pluginBytes).digest('hex'),
    placements: ['plugin_readme'],
    ...shared,
  };
  return { root, rootAsset, pluginAsset, revision };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test('keeps structural parsing synchronous and rejects malformed image containers', () => {
  assert.deepEqual(readImageDimensions(png()), { width: 3, height: 2, format: 'png' });
  assert.deepEqual(readImageDimensions(jpeg()), { width: 7, height: 5, format: 'jpeg' });
  assert.deepEqual(readImageDimensions(verifiedVp8), { width: 1679, height: 1127, format: 'webp' });
  assert.deepEqual(readImageDimensions(verifiedVp8L), { width: 16, height: 16, format: 'webp' });
  assert.equal(tinyVp8L.readUInt32LE(16), 15);
  assert.deepEqual(readImageDimensions(tinyVp8L), { width: 1, height: 1, format: 'webp' });
  assert.deepEqual(readImageDimensions(verifiedVp8X), { width: 1280, height: 853, format: 'webp' });
  assert.deepEqual(readImageDimensions(webpVp8X()), { width: 16, height: 16, format: 'webp' });
  assert.throws(() => readImageDimensions(Buffer.from('not-an-image')), /unsupported|malformed/i);
  assert.throws(() => readImageDimensions(png().subarray(0, -12)), /missing|malformed/i);
  const corruptPng = png();
  corruptPng[corruptPng.length - 1] ^= 0xff;
  assert.throws(() => readImageDimensions(corruptPng), /malformed/i);
  assert.throws(() => readImageDimensions(jpeg().subarray(0, 21)), /malformed/i);
  assert.throws(() => readImageDimensions(verifiedVp8L.subarray(0, -1)), /malformed/i);
  assert.throws(() => readImageDimensions(verifiedVp8.subarray(0, -1)), /malformed/i);
  assert.throws(() => readImageDimensions(webpVp8X(15, 16)), /canvas|malformed/i);
});

test('accepts strict self-contained SVG assets and rejects active or external content', async () => {
  assert.deepEqual(readImageDimensions(svg()), { width: 12.5, height: 9.25, format: 'svg' });
  await assert.doesNotReject(validateImageDecode(svg()));

  const unsafe = [
    '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><svg:script>alert(1)</svg:script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><set attributeName="onload" to="alert(1)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path style="fill:&#x75;rl(https://example.com/a.png)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path fill="&#117;rl(https://example.com/a.png)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path fill="&#x75;rl(https://example.com/a.png)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image href="https://example.com/a.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" onload="alert(1)"></svg>',
  ];
  for (const source of unsafe) {
    assert.throws(() => readImageDimensions(Buffer.from(source)), /unsafe svg/i);
  }
  assert.throws(
    () => readImageDimensions(Buffer.from([0x3c, 0x73, 0x76, 0x67, 0xc3, 0x28, 0x3e])),
    /utf-8|svg/i,
  );
});

test('validates a publishable SVG manifest record with fractional viewBox dimensions', async () => {
  const fixture = createFixtureRepository();
  try {
    const bytes = svg();
    const assetPath = 'plugins/maxvideoai/assets/logo-mark.svg';
    writeFileSync(path.join(fixture.root, assetPath), bytes);
    const record = {
      ...fixture.pluginAsset,
      id: 'maxvideoai-logo-mark',
      path: assetPath,
      width: 12.5,
      height: 9.25,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      claim: 'Official MaxVideoAI brand mark for public plugin identity; it is not product or host proof.',
      alt: 'MaxVideoAI white monogram on a dark square',
      placements: ['plugin_manifest'],
    };
    assert.deepEqual(
      await validateGithubAssetManifest({ version: 1, assets: [record] }, { repositoryRoot: fixture.root, now }),
      [],
    );
    assert.deepEqual(await describeGithubAsset(assetPath, { rootDirectory: fixture.root }), {
      path: assetPath,
      width: 12.5,
      height: 9.25,
      format: 'svg',
      sha256: record.sha256,
    });
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('decodes tiny and repository WebP assets while rejecting corrupt VP8L and VP8 entropy', async () => {
  await assert.doesNotReject(validateImageDecode(tinyVp8L));
  await assert.doesNotReject(validateImageDecode(verifiedVp8L));
  await assert.doesNotReject(validateImageDecode(verifiedVp8));
  await assert.doesNotReject(validateImageDecode(verifiedVp8X));

  const corruptVp8L = Buffer.from(verifiedVp8L);
  corruptVp8L.fill(1, 25);
  assert.deepEqual(readImageDimensions(corruptVp8L), { width: 16, height: 16, format: 'webp' });
  await assert.rejects(validateImageDecode(corruptVp8L), /decode-integrity/i);

  const corruptVp8 = Buffer.from(verifiedVp8);
  corruptVp8.fill(1, 30);
  assert.deepEqual(readImageDimensions(corruptVp8), { width: 1679, height: 1127, format: 'webp' });
  await assert.rejects(validateImageDecode(corruptVp8), /decode-integrity/i);
});

test('registration and normal/release manifest validation fail closed on decode corruption', async () => {
  const fixture = createFixtureRepository();
  try {
    const corruptVp8L = Buffer.from(verifiedVp8L);
    corruptVp8L.fill(1, 25);
    writeFileSync(path.join(fixture.root, 'assets', 'corrupt.webp'), corruptVp8L);
    await assert.rejects(describeGithubAsset('assets/corrupt.webp', {
      rootDirectory: fixture.root,
    }), /decode-integrity/i);

    const corruptVp8 = Buffer.from(verifiedVp8);
    corruptVp8.fill(1, 30);
    writeFileSync(path.join(fixture.root, fixture.pluginAsset.path), corruptVp8);
    fixture.pluginAsset.sha256 = createHash('sha256').update(corruptVp8).digest('hex');
    assert.match((await validateGithubAssetManifest({ version: 1, assets: [fixture.pluginAsset] }, {
      repositoryRoot: fixture.root,
      now,
    })).join('\n'), /decode-integrity/i);

    const pluginReadme = path.join(fixture.root, 'plugins', 'maxvideoai', 'README.md');
    writeFileSync(pluginReadme, '![Plugin launch proof](assets/launch.webp)\n');
    assert.match((await validateReleaseReadmeAssets({ version: 1, assets: [fixture.pluginAsset] }, {
      repositoryRoot: fixture.root,
      now,
      readmePaths: [pluginReadme],
    })).join('\n'), /decode-integrity/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('requires current, review-signed proof provenance from real ancestor revisions', async () => {
  const fixture = createFixtureRepository();
  try {
    assert.deepEqual(await validateGithubAssetManifest({ version: 1, assets: [fixture.rootAsset] }, {
      repositoryRoot: fixture.root,
      now,
    }), []);

    const invalid = clone(fixture.rootAsset);
    invalid.id = 'asset 1';
    invalid.path = '../outside.png';
    invalid.sha256 = 'invalid';
    invalid.width = 0;
    invalid.claim = '';
    invalid.alt = 'screenshot';
    invalid.state = 'unapproved';
    assert.match((await validateGithubAssetManifest({ version: 1, assets: [invalid] }, {
      repositoryRoot: fixture.root,
      now,
    })).join('\n'), /semantic|relative|sha256|dimensions|claim|alt|state/i);

    const stale = clone(fixture.rootAsset);
    stale.capturedAt = '2000-01-01';
    stale.maxvideoaiRevision = '0'.repeat(40);
    stale.lastReviewedAt = '2000-01-01';
    stale.lastReviewedRevision = 'f'.repeat(40);
    stale.freshnessStatus = 'stale';
    assert.match((await validateGithubAssetManifest({ version: 1, assets: [stale] }, {
      repositoryRoot: fixture.root,
      now,
    })).join('\n'), /90 days|revision|30 days|freshnessStatus/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('requires complete host and editorial provenance while preserving archival null provenance', async () => {
  const fixture = createFixtureRepository();
  try {
    const hostProof = clone(fixture.rootAsset);
    hostProof.id = 'claude-inline-video-proof';
    hostProof.kind = 'host_proof';
    hostProof.host = 'Claude Desktop';
    hostProof.hostVersion = null;
    const hostErrors = (await validateGithubAssetManifest({ version: 1, assets: [hostProof] }, {
      repositoryRoot: fixture.root,
      now,
    })).join('\n');
    assert.match(hostErrors, /hostVersion/i);

    const editorial = clone(fixture.pluginAsset);
    editorial.state = 'draft_editorial';
    editorial.sourceEnvironment = 'generated_editorial';
    editorial.claim = 'Editorial-only decorative visual; it is not product or host proof.';
    assert.deepEqual(await validateGithubAssetManifest({ version: 1, assets: [editorial] }, {
      repositoryRoot: fixture.root,
      now,
    }), []);
    editorial.capturedAt = null;
    editorial.maxvideoaiRevision = null;
    editorial.approvedBy = null;
    assert.match((await validateGithubAssetManifest({ version: 1, assets: [editorial] }, {
      repositoryRoot: fixture.root,
      now,
    })).join('\n'), /draft_editorial requires capturedAt|maxvideoaiRevision|approvedBy/i);

    hostProof.state = 'reference_only';
    hostProof.capturedAt = null;
    hostProof.maxvideoaiRevision = null;
    hostProof.approvedBy = null;
    hostProof.lastReviewedAt = null;
    hostProof.lastReviewedRevision = null;
    hostProof.freshnessStatus = null;
    assert.deepEqual(await validateGithubAssetManifest({ version: 1, assets: [hostProof] }, {
      repositoryRoot: fixture.root,
      now,
    }), []);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('scans both production README paths, reference Markdown, HTML, and every srcset candidate', async () => {
  const fixture = createFixtureRepository();
  try {
    const rootReadme = path.join(fixture.root, 'README.md');
    const pluginReadme = path.join(fixture.root, 'plugins', 'maxvideoai', 'README.md');
    writeFileSync(rootReadme, '![Workflow proof][workflow]\n\n[workflow]: assets/workflow.png "proof"\n');
    writeFileSync(pluginReadme, `<picture>\n  <source\n    srcset="assets/launch.webp 1x, ../../assets/workflow.png 2x"\n  >\n  <img src="assets/launch.webp" srcset="assets/launch.webp 1x, ../../assets/workflow.png 2x" alt="Plugin release visual">\n</picture>\n`);
    const manifest = { version: 1, assets: [fixture.rootAsset, fixture.pluginAsset] };
    const usages = findReadmeImageUsages(readFileSync(pluginReadme, 'utf8'), pluginReadme, fixture.root);
    assert.deepEqual(findReadmeImageReferences(readFileSync(rootReadme, 'utf8'), rootReadme, fixture.root), ['assets/workflow.png']);
    assert.deepEqual(
      findReadmeImageReferences('Ordinary [documentation label] and ! emphatic text.\n', rootReadme, fixture.root),
      [],
    );
    assert.equal(usages.length, 2);
    assert.equal(usages.find((usage) => usage.path === 'assets/workflow.png')?.usages.length, 2);
    assert.match((await validateReleaseReadmeAssets(manifest, { repositoryRoot: fixture.root, now })).join('\n'), /plugin_readme is not an approved placement/);

    fixture.rootAsset.placements.push('plugin_readme');
    assert.deepEqual(await validateReleaseReadmeAssets(manifest, { repositoryRoot: fixture.root, now }), []);

    writeFileSync(pluginReadme, '<img alt="Draft > visual" src="../../assets/workflow.png">\n');
    assert.deepEqual(
      findReadmeImageReferences(readFileSync(pluginReadme, 'utf8'), pluginReadme, fixture.root),
      ['assets/workflow.png'],
    );
    assert.deepEqual(await validateReleaseReadmeAssets(manifest, { repositoryRoot: fixture.root, now }), []);

    writeFileSync(rootReadme, '![Unresolved workflow][missing]\n');
    assert.match(
      (await validateReleaseReadmeAssets(manifest, { repositoryRoot: fixture.root, now })).join('\n'),
      /unresolved markdown image reference/i,
    );

    writeFileSync(rootReadme, '![Hero]\n\n[hero]: assets/unregistered.png\n');
    assert.match((await validateReleaseReadmeAssets(manifest, { repositoryRoot: fixture.root, now })).join('\n'), /README.md.*unregistered/i);
    writeFileSync(rootReadme, '![Missing root visual](assets/unregistered.png)\n');
    assert.match((await validateReleaseReadmeAssets(manifest, { repositoryRoot: fixture.root, now })).join('\n'), /README.md.*unregistered/i);
    writeFileSync(rootReadme, '![Workflow proof][workflow]\n\n[workflow]: assets/workflow.png\n');
    writeFileSync(pluginReadme, '![Missing plugin visual](assets/unregistered.webp)\n');
    assert.match((await validateReleaseReadmeAssets(manifest, { repositoryRoot: fixture.root, now })).join('\n'), /plugins\/maxvideoai\/README.md.*unregistered/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('keeps consecutive reference definitions line-bound and preserves the first normalized label', () => {
  const fixture = createFixtureRepository();
  try {
    const readmePath = path.join(fixture.root, 'README.md');
    const markdown = [
      '![First][ FIRST   LABEL ]',
      '![Second][second]',
      '![Third][third]',
      '',
      '[First Label]: assets/first.png "First title"',
      '[second]: assets/second.png',
      "[third]: assets/third.png 'Third title'",
      '[first   label]: assets/ignored-duplicate.png',
      '',
    ].join('\n');

    assert.deepEqual(findReadmeImageReferences(markdown, readmePath, fixture.root), [
      'assets/first.png',
      'assets/second.png',
      'assets/third.png',
    ]);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('masks fenced, inline, and escaped image examples while retaining adjacent live syntax', () => {
  const fixture = createFixtureRepository();
  try {
    const readmePath = path.join(fixture.root, 'README.md');
    const markdown = [
      '\\![Escaped](https://example.com/escaped.png)![Live inline](assets/live-inline.png)',
      '`![Inline code](https://example.com/inline.png)`![Live reference][live-reference]',
      '```md',
      '![Backtick fence](https://example.com/backtick.png)',
      '<img src="https://example.com/fenced-html.png" alt="Fenced HTML">',
      '```',
      '~~~markdown',
      '![Tilde fence][missing-definition]',
      '~~~',
      '<img src="assets/live-html.png" alt="Live > HTML">',
      '',
      '[live-reference]: assets/live-reference.png',
      '',
    ].join('\n');

    assert.deepEqual(findReadmeImageReferences(markdown, readmePath, fixture.root), [
      'assets/live-inline.png',
      'assets/live-reference.png',
      'assets/live-html.png',
    ]);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('honors backtick info and exact closing-marker rules for fenced code', () => {
  const fixture = createFixtureRepository();
  try {
    const readmePath = path.join(fixture.root, 'README.md');
    assert.deepEqual(
      findReadmeImageReferences(
        '```invalid`info\n![Live after invalid opener](assets/live-invalid-opener.png)\n',
        readmePath,
        fixture.root,
      ),
      ['assets/live-invalid-opener.png'],
    );
    assert.deepEqual(
      findReadmeImageReferences(
        [
          '~~~',
          '![Hidden](https://example.com/hidden.png)',
          '~`~',
          '![Still hidden](https://example.com/still-hidden.png)',
          '~~~',
          '![Live after fence](assets/live-after-fence.png)',
          '',
        ].join('\n'),
        readmePath,
        fixture.root,
      ),
      ['assets/live-after-fence.png'],
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('rejects duplicate HTML attributes and image tags without a usable destination', async () => {
  const fixture = createFixtureRepository();
  try {
    const readmePath = path.join(fixture.root, 'README.md');
    const manifest = { version: 1, assets: [fixture.rootAsset] };
    const cases = [
      {
        markdown: '<img src="https://example.com/remote.png" src="assets/workflow.png" alt="Workflow proof">\n',
        expected: /duplicate html image attribute.*src/i,
      },
      {
        markdown: '<img src="assets/workflow.png" ALT="Workflow proof" alt="Harmless duplicate">\n',
        expected: /duplicate html image attribute.*alt/i,
      },
      {
        markdown: '<img alt="Missing destination">\n',
        expected: /html img.*usable destination/i,
      },
      {
        markdown: '<source src="assets/workflow.png">\n',
        expected: /html source.*usable destination/i,
      },
      {
        markdown: '![Missing destination](   )\n',
        expected: /markdown image.*empty destination/i,
      },
    ];

    for (const fixtureCase of cases) {
      writeFileSync(readmePath, fixtureCase.markdown);
      assert.match(
        (await validateReleaseReadmeAssets(manifest, {
          repositoryRoot: fixture.root,
          now,
          readmePaths: [readmePath],
        })).join('\n'),
        fixtureCase.expected,
      );
    }
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('permits draft editorial assets only as labeled HTML editorial illustrations', async () => {
  const fixture = createFixtureRepository();
  try {
    const readmePath = path.join(fixture.root, 'README.md');
    const editorial = clone(fixture.pluginAsset);
    editorial.state = 'draft_editorial';
    editorial.sourceEnvironment = 'generated_editorial';
    editorial.claim = 'Editorial-only decorative visual; it is not product or host proof.';
    editorial.placements = ['root_readme'];
    editorial.path = 'assets/workflow.png';
    editorial.sha256 = fixture.rootAsset.sha256;
    editorial.width = fixture.rootAsset.width;
    editorial.height = fixture.rootAsset.height;
    writeFileSync(readmePath, '![Editorial illustration: launch ambience](assets/workflow.png)\n');
    assert.match((await validateReleaseReadmeAssets({ version: 1, assets: [editorial] }, {
      repositoryRoot: fixture.root,
      now,
      readmePaths: [readmePath],
    })).join('\n'), /HTML.*editorial/i);

    writeFileSync(readmePath, '<img src="assets/workflow.png" data-asset-role="editorial" alt="Editorial illustration: launch ambience">\n');
    assert.deepEqual(await validateReleaseReadmeAssets({ version: 1, assets: [editorial] }, {
      repositoryRoot: fixture.root,
      now,
      readmePaths: [readmePath],
    }), []);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('ships archival MCP captures with real hashes and dimensions while production release mode scans both READMEs', async () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const mcpAssets = manifest.assets.filter((asset: { path: string }) => asset.path.startsWith('frontend/public/media/mcp/'));
  assert.equal(mcpAssets.length, 6);
  assert.ok(mcpAssets.every((asset: { state: string }) => asset.state === 'reference_only'));
  assert.deepEqual(await validateGithubAssetManifest(manifest, { repositoryRoot, now }), []);

  const release = spawnSync(process.execPath, [checkCommandPath, '--release'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(release.status, 0, release.stderr);
});
