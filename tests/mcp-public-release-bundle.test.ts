import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  rmdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const builder = resolve(root, 'scripts/build-maxvideoai-plugin-release.mjs');
const source = resolve(root, 'plugins/maxvideoai');
const defaultAssetManifest = resolve(root, 'docs/marketing/github-asset-manifest.json');
const safeTemporaryRoot = realpathSync(tmpdir());
const outputMarker = '.maxvideoai-plugin-release-output.json';

const baseExpectedPublicFiles = [
  '.claude-plugin/marketplace.json',
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.github/ISSUE_TEMPLATE/bug-report.yml',
  '.github/ISSUE_TEMPLATE/compatibility-report.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/feature-request.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.mcp.json',
  'CHANGELOG.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'README.md',
  'SECURITY.md',
  'SUPPORT.md',
  'VERSION',
  'assets/demos/brief-to-video-workflow.webp',
  'assets/demos/library-continuity.webp',
  'assets/demos/model-choice-and-budget.webp',
  'assets/demos/readme-proof-hero.webp',
  'assets/logo-mark.svg',
  'assets/screenshots/maxvideoai-library-continuity-production.jpg',
  'assets/screenshots/maxvideoai-workspace-production.jpg',
  'assets/social/directory-thumbnail.png',
  'assets/social/github-social-preview.png',
  'docs/chatgpt.md',
  'docs/claude.md',
  'docs/codex.md',
  'docs/generic-mcp.md',
  'docs/how-it-works.md',
  'docs/privacy-and-permissions.md',
  'docs/troubleshooting.md',
  'examples/README.md',
  'examples/creator-budget-comparison.md',
  'examples/product-launch-plan.md',
  'examples/recover-a-generation.md',
  'examples/reference-to-video.md',
  'skills/generate/SKILL.md',
  'skills/generate/agents/openai.yaml',
  'skills/generate/references/generation-safety.md',
  'skills/generate/references/reference-inputs.md',
  'skills/plan/SKILL.md',
  'skills/plan/agents/openai.yaml',
  'skills/plan/references/budget-planning.md',
];
const version03ExpectedPublicFiles = [
  'assets/social/release-0.3.0.png',
  'docs/discovery.md',
  'server.json',
];

type AssetManifest = {
  assets: Array<{
    id: string;
    path: string;
    state: string;
    sha256: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function filesAt(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name);
    return entry.isDirectory() ? filesAt(entryPath) : [entryPath];
  });
}

function expectedPublicFilesForVersion(version: string): string[] {
  const [major, minor] = version.split('.').map(Number);
  return [
    ...baseExpectedPublicFiles,
    ...(major > 0 || minor >= 3 ? version03ExpectedPublicFiles : []),
  ].sort();
}

function runBuilder(
  sourcePath: string,
  outPath: string,
  assetManifestPath?: string,
  environment: Record<string, string> = {},
  workingDirectory = root,
) {
  const args = [builder, '--source', sourcePath, '--out', outPath];
  if (assetManifestPath) args.push('--asset-manifest', assetManifestPath);
  return spawnSync(process.execPath, args, {
    cwd: workingDirectory,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
}

function appendText(path: string, text: string): void {
  writeFileSync(path, `${readFileSync(path, 'utf8')}\n${text}\n`);
}

function writeManifestFixture(path: string, mutate: (manifest: AssetManifest) => void): void {
  const manifest = JSON.parse(readFileSync(defaultAssetManifest, 'utf8')) as AssetManifest;
  mutate(manifest);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

function setPackageVersion(sourcePath: string, version: string): void {
  writeFileSync(join(sourcePath, 'VERSION'), `${version}\n`);
  for (const path of ['.codex-plugin/plugin.json', '.claude-plugin/plugin.json']) {
    const manifestPath = join(sourcePath, path);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.version = version;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

function setMarketplacePluginVersion(sourcePath: string, version: string): void {
  const manifestPath = join(sourcePath, '.claude-plugin', 'marketplace.json');
  const marketplace = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    plugins: Array<Record<string, unknown>>;
  };
  marketplace.plugins[0].version = version;
  writeFileSync(manifestPath, `${JSON.stringify(marketplace, null, 2)}\n`);
}

function addVersion03Metadata(sourcePath: string): void {
  setPackageVersion(sourcePath, '0.3.0');
  setMarketplacePluginVersion(sourcePath, '0.3.0');
  mkdirSync(join(sourcePath, 'docs'), { recursive: true });
  writeFileSync(join(sourcePath, 'docs', 'discovery.md'), '# MaxVideoAI discovery metadata\n');
  writeFileSync(
    join(sourcePath, 'server.json'),
    `${JSON.stringify({ name: 'com.maxvideoai/maxvideoai', version: '0.3.0' }, null, 2)}\n`,
  );
}

function readZipDirectory(path: string): Array<{ name: string; time: number; date: number }> {
  const archive = readFileSync(path);
  const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endOffset = archive.lastIndexOf(endSignature);
  assert.notEqual(endOffset, -1, 'ZIP end-of-central-directory record is missing');
  const entryCount = archive.readUInt16LE(endOffset + 10);
  let offset = archive.readUInt32LE(endOffset + 16);
  const entries = [];

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(archive.readUInt32LE(offset), 0x02014b50, `invalid central record ${index}`);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    entries.push({
      name: archive.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'),
      time: archive.readUInt16LE(offset + 12),
      date: archive.readUInt16LE(offset + 14),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

test('release builder exports the exact deterministic public surface with checksums', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-release-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const firstOut = join(temporary, 'first');
  const secondOut = join(temporary, 'second');
  const currentVersion = readFileSync(join(source, 'VERSION'), 'utf8').trim();
  const expectedPublicFiles = expectedPublicFilesForVersion(currentVersion);

  const first = runBuilder(source, firstOut);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const second = runBuilder(source, secondOut);
  assert.equal(second.status, 0, second.stderr || second.stdout);

  const bundleRoot = join(firstOut, 'maxvideoai-plugin');
  const relativeFiles = filesAt(bundleRoot).map((path) => relative(bundleRoot, path)).sort();
  assert.deepEqual(relativeFiles, [...expectedPublicFiles, 'checksums.json'].sort());

  const version = readFileSync(join(bundleRoot, 'VERSION'), 'utf8').trim();
  const codex = JSON.parse(readFileSync(join(bundleRoot, '.codex-plugin/plugin.json'), 'utf8'));
  const claude = JSON.parse(readFileSync(join(bundleRoot, '.claude-plugin/plugin.json'), 'utf8'));
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(codex.version, version);
  assert.equal(claude.version, version);
  assert.equal(codex.skills, './skills/');
  assert.equal(codex.mcpServers, './.mcp.json');
  assert.equal(codex.license, 'BUSL-1.1');
  assert.equal(claude.license, 'BUSL-1.1');

  const checksums = JSON.parse(readFileSync(join(bundleRoot, 'checksums.json'), 'utf8')) as {
    algorithm: string;
    files: Record<string, string>;
  };
  assert.equal(checksums.algorithm, 'sha256');
  assert.deepEqual(Object.keys(checksums.files), expectedPublicFiles);
  for (const [path, digest] of Object.entries(checksums.files)) {
    assert.equal(digest, sha256(join(bundleRoot, path)), path);
  }

  const archiveName = `maxvideoai-plugin-${version}.zip`;
  const firstArchive = join(firstOut, archiveName);
  const secondArchive = join(secondOut, archiveName);
  assert.ok(statSync(firstArchive).size > 1_000);
  assert.equal(sha256(firstArchive), sha256(secondArchive));
  assert.equal(
    readFileSync(join(firstOut, `${archiveName}.sha256`), 'utf8').trim(),
    `${sha256(firstArchive)}  ${archiveName}`,
  );

  const archiveEntries = readZipDirectory(firstArchive);
  assert.deepEqual(
    archiveEntries.map((entry) => entry.name),
    [...expectedPublicFiles, 'checksums.json'].sort().map((path) => `maxvideoai/${path}`),
  );
  assert.ok(archiveEntries.every((entry) => entry.time === 0 && entry.date === 0x5021));
});

test('asset-manifest validation remains portable for a copied source fixture', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-portable-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const fixture = join(temporary, 'source-copy');
  const manifest = join(temporary, 'asset-manifest.json');
  cpSync(source, fixture, { recursive: true });
  cpSync(defaultAssetManifest, manifest);

  const result = runBuilder(fixture, join(temporary, 'out'), manifest);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('release builder preserves non-empty output directories it does not own', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-unowned-output-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const out = join(temporary, 'unowned');
  const sentinel = join(out, 'keep-me.txt');
  mkdirSync(out);
  writeFileSync(sentinel, 'unrelated data\n');

  const result = runBuilder(source, out, defaultAssetManifest);
  assert.notEqual(result.status, 0, 'unowned non-empty output unexpectedly passed');
  assert.match(`${result.stderr}\n${result.stdout}`, /not owned|non-empty/i);
  assert.equal(readFileSync(sentinel, 'utf8'), 'unrelated data\n');
});

test('release builder can rebuild its marked output but preserves unexpected sentinels', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-owned-output-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const out = join(temporary, 'owned');

  const first = runBuilder(source, out, defaultAssetManifest);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.ok(existsSync(join(out, outputMarker)), 'builder ownership marker is missing');
  const archiveName = `maxvideoai-plugin-${readFileSync(join(source, 'VERSION'), 'utf8').trim()}.zip`;
  const firstDigest = sha256(join(out, archiveName));

  const second = runBuilder(source, out, defaultAssetManifest);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(sha256(join(out, archiveName)), firstDigest);

  const nestedSentinel = join(out, 'maxvideoai-plugin', 'unexpected', 'keep-me.txt');
  mkdirSync(join(out, 'maxvideoai-plugin', 'unexpected'));
  writeFileSync(nestedSentinel, 'unrelated nested data\n');
  const nestedRefused = runBuilder(source, out, defaultAssetManifest);
  assert.notEqual(nestedRefused.status, 0, 'owned output with an unexpected nested sentinel passed');
  assert.match(`${nestedRefused.stderr}\n${nestedRefused.stdout}`, /unexpected (?:owned )?output entry/i);
  assert.equal(readFileSync(nestedSentinel, 'utf8'), 'unrelated nested data\n');
  rmSync(nestedSentinel);
  rmdirSync(join(out, 'maxvideoai-plugin', 'unexpected'));

  const sentinel = join(out, 'keep-me.txt');
  writeFileSync(sentinel, 'unrelated data\n');
  const refused = runBuilder(source, out, defaultAssetManifest);
  assert.notEqual(refused.status, 0, 'owned output with an unexpected sentinel passed');
  assert.match(`${refused.stderr}\n${refused.stdout}`, /unexpected output entry/i);
  assert.equal(readFileSync(sentinel, 'utf8'), 'unrelated data\n');
});

test('release builder preserves tampered owned bundle and archive files', async (t) => {
  const cases = [
    {
      name: 'bundle checksum mismatch',
      expected: /owned output checksum mismatch/i,
      target: (out: string, version: string) => join(out, 'maxvideoai-plugin', 'README.md'),
      mutate: (path: string) => writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('\ntampered\n')])),
    },
    {
      name: 'archive checksum mismatch',
      expected: /owned output archive checksum mismatch/i,
      target: (out: string, version: string) => join(out, `maxvideoai-plugin-${version}.zip`),
      mutate: (path: string) => writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('tampered')])),
    },
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, (subtest) => {
      const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-tampered-output-'));
      subtest.after(() => rmSync(temporary, { recursive: true, force: true }));
      const out = join(temporary, 'owned');
      const version = readFileSync(join(source, 'VERSION'), 'utf8').trim();
      const built = runBuilder(source, out, defaultAssetManifest);
      assert.equal(built.status, 0, built.stderr || built.stdout);
      const target = fixtureCase.target(out, version);
      fixtureCase.mutate(target);
      const tamperedDigest = sha256(target);

      const refused = runBuilder(source, out, defaultAssetManifest);
      assert.notEqual(refused.status, 0, `${fixtureCase.name} unexpectedly passed`);
      assert.match(`${refused.stderr}\n${refused.stdout}`, fixtureCase.expected);
      assert.equal(sha256(target), tamperedDigest, `${fixtureCase.name} was modified or deleted`);
    });
  }
});

test('release builder refuses home, temp, and broad parent outputs inside safe fixtures', async (t) => {
  const cases = [
    {
      name: 'home',
      prepare: (temporary: string) => {
        const candidate = join(temporary, 'home', 'alice');
        mkdirSync(candidate, { recursive: true });
        return { candidate, environment: { HOME: candidate } };
      },
    },
    {
      name: 'temp',
      prepare: (temporary: string) => {
        const candidate = join(temporary, 'tmp');
        mkdirSync(candidate, { recursive: true });
        return { candidate, environment: { TMPDIR: candidate } };
      },
    },
    {
      name: 'broad home parent',
      prepare: (temporary: string) => {
        const candidate = join(temporary, 'Users');
        const home = join(candidate, 'alice');
        mkdirSync(home, { recursive: true });
        return { candidate, environment: { HOME: home } };
      },
    },
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, (subtest) => {
      const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-protected-output-'));
      subtest.after(() => rmSync(temporary, { recursive: true, force: true }));
      const { candidate, environment } = fixtureCase.prepare(temporary);
      const sentinel = join(candidate, 'keep-me.txt');
      writeFileSync(sentinel, 'unrelated data\n');

      const result = runBuilder(source, candidate, defaultAssetManifest, environment);
      assert.notEqual(result.status, 0, `${fixtureCase.name} output unexpectedly passed`);
      assert.match(`${result.stderr}\n${result.stdout}`, /protected|too broad/i);
      assert.equal(readFileSync(sentinel, 'utf8'), 'unrelated data\n');
    });
  }
});

test('release builder refuses its working directory without touching it', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-cwd-output-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const sentinel = join(temporary, 'keep-me.txt');
  writeFileSync(sentinel, 'unrelated data\n');

  const result = runBuilder(source, temporary, defaultAssetManifest, {}, temporary);
  assert.notEqual(result.status, 0, 'working-directory output unexpectedly passed');
  assert.match(`${result.stderr}\n${result.stdout}`, /protected|too broad/i);
  assert.equal(readFileSync(sentinel, 'utf8'), 'unrelated data\n');
});

test('release builder rejects a symlinked output ancestor without touching its target', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-symlink-output-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const realParent = join(temporary, 'real-parent');
  const linkedParent = join(temporary, 'linked-parent');
  const realOut = join(realParent, 'out');
  mkdirSync(realOut, { recursive: true });
  symlinkSync(realParent, linkedParent, 'dir');
  const sentinel = join(realOut, 'keep-me.txt');
  writeFileSync(sentinel, 'unrelated data\n');

  const result = runBuilder(source, join(linkedParent, 'out'), defaultAssetManifest);
  assert.notEqual(result.status, 0, 'symlinked output ancestor unexpectedly passed');
  assert.match(`${result.stderr}\n${result.stdout}`, /symlinked output ancestor/i);
  assert.equal(readFileSync(sentinel, 'utf8'), 'unrelated data\n');
});

test('release builder canonicalizes the ordinary macOS temp alias through existing ancestors', (t) => {
  const requestedTemporaryRoot = resolve(tmpdir());
  if (realpathSync(requestedTemporaryRoot) === requestedTemporaryRoot) {
    t.skip('temporary root has no non-canonical alias on this platform');
    return;
  }
  const temporary = mkdtempSync(join(requestedTemporaryRoot, 'maxvideoai-plugin-aliased-output-'));
  t.after(() => rmSync(realpathSync(temporary), { recursive: true, force: true }));

  const result = runBuilder(source, join(temporary, 'out'), defaultAssetManifest);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('non-exported evaluation notes may retain internal diagnostic identifiers', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-internal-notes-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const fixture = join(temporary, 'source-copy');
  cpSync(source, fixture, { recursive: true });
  appendText(
    join(fixture, 'evals', 'README.md'),
    'Diagnostic fixture only: /home/tester/run 123e4567-e89b-42d3-a456-426614174000 job_01JABCDEF1234567890',
  );

  const result = runBuilder(fixture, join(temporary, 'out'), defaultAssetManifest);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('release builder ignores image-like syntax in escaped and code examples', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-markdown-code-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const fixture = join(temporary, 'source-copy');
  cpSync(source, fixture, { recursive: true });
  appendText(
    join(fixture, 'README.md'),
    [
      '\\![Escaped example](https://example.com/escaped.png)',
      '`![Inline example](https://example.com/inline.png)`![Live proof](assets/demos/readme-proof-hero.webp)',
      '```md',
      '![Fenced example][missing-definition]',
      '```',
      '~~~html',
      '<img src="https://example.com/fenced-html.png" alt="Fenced example">',
      '~~~',
    ].join('\n'),
  );

  const result = runBuilder(fixture, join(temporary, 'out'), defaultAssetManifest);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('release builder fails closed for unsafe source content and assets', async (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-reject-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));

  const cases: Array<{
    name: string;
    expected: RegExp;
    mutate: (fixture: string, manifestPath: string) => void;
  }> = [
    {
      name: 'secret file',
      expected: /forbidden file/i,
      mutate: (fixture) => writeFileSync(join(fixture, '.env'), 'MCP_SECRET=do-not-package\n'),
    },
    {
      name: 'source map',
      expected: /forbidden file/i,
      mutate: (fixture) => writeFileSync(join(fixture, 'assets', 'bundle.js.map'), '{}\n'),
    },
    {
      name: 'symlink',
      expected: /symlink/i,
      mutate: (fixture) => symlinkSync('README.md', join(fixture, 'README-LINK.md')),
    },
    {
      name: 'macOS absolute path',
      expected: /local absolute path/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '/Users/alice/private/proof.png'),
    },
    {
      name: 'Linux absolute path',
      expected: /local absolute path/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '/home/alice/private/proof.png'),
    },
    {
      name: 'Windows absolute path',
      expected: /local absolute path/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), 'C:\\Users\\Alice\\private\\proof.png'),
    },
    {
      name: 'staging origin',
      expected: /staging or preview origin/i,
      mutate: (fixture) =>
        appendText(join(fixture, 'README.md'), 'https://maxvideoai-mcp-staging.vercel.app'),
    },
    {
      name: 'preview origin',
      expected: /staging or preview origin/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), 'https://preview.maxvideoai.com'),
    },
    {
      name: 'known token',
      expected: /github token/i,
      mutate: (fixture) =>
        appendText(join(fixture, 'evals', 'README.md'), 'ghp_1234567890abcdefghijklmnopqrstuv'),
    },
    {
      name: 'staging origin in non-exported source',
      expected: /staging or preview origin/i,
      mutate: (fixture) =>
        appendText(join(fixture, 'evals', 'README.md'), 'https://preview.maxvideoai.com/internal'),
    },
    {
      name: 'internal UUID',
      expected: /internal uuid/i,
      mutate: (fixture) =>
        appendText(join(fixture, 'README.md'), '123e4567-e89b-42d3-a456-426614174000'),
    },
    {
      name: 'internal job identifier',
      expected: /internal job or evidence identifier/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), 'job_01JABCDEF1234567890'),
    },
    {
      name: 'unsupported binary',
      expected: /unsupported (?:binary type|asset extension)/i,
      mutate: (fixture) =>
        writeFileSync(join(fixture, 'assets', 'private-capture.mov'), Buffer.from([0, 1, 2, 3])),
    },
    {
      name: 'unsupported binary without null bytes',
      expected: /unsupported (?:binary type|asset extension)/i,
      mutate: (fixture) =>
        writeFileSync(join(fixture, 'assets', 'private-capture.gif'), Buffer.from('GIF89a')),
    },
    {
      name: 'unregistered raster',
      expected: /unregistered (?:raster )?asset/i,
      mutate: (fixture) =>
        cpSync(
          join(fixture, 'assets', 'screenshots', 'maxvideoai-workspace-production.jpg'),
          join(fixture, 'assets', 'screenshots', 'unregistered.jpg'),
        ),
    },
    {
      name: 'unregistered SVG',
      expected: /unregistered asset/i,
      mutate: (fixture) =>
        writeFileSync(
          join(fixture, 'assets', 'unregistered.svg'),
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>\n',
        ),
    },
    {
      name: 'invalid UTF-8 text',
      expected: /invalid utf-8/i,
      mutate: (fixture) => writeFileSync(join(fixture, 'notes.unknown'), Buffer.from([0xc3, 0x28])),
    },
    {
      name: 'unallowlisted image reference',
      expected: /image reference is not allowlisted/i,
      mutate: (fixture) =>
        appendText(
          join(fixture, 'README.md'),
          '![Draft visual](assets/sources/maxvideoai-editorial-branch-converge-source.png)',
        ),
    },
    {
      name: 'remote image reference',
      expected: /remote markdown image reference/i,
      mutate: (fixture) =>
        appendText(join(fixture, 'README.md'), '![Mutable remote proof](https://example.com/proof.png)'),
    },
    {
      name: 'remote HTML image hidden after quoted greater-than text',
      expected: /remote markdown image reference/i,
      mutate: (fixture) =>
        appendText(
          join(fixture, 'README.md'),
          '<img alt="Draft > visual" src="https://example.com/proof.png">',
        ),
    },
    {
      name: 'duplicate src with remote first and local second',
      expected: /duplicate html image attribute.*src/i,
      mutate: (fixture) =>
        appendText(
          join(fixture, 'README.md'),
          '<img src="https://example.com/proof.png" src="assets/demos/readme-proof-hero.webp" alt="Proof">',
        ),
    },
    {
      name: 'duplicate src with local first and remote second',
      expected: /duplicate html image attribute.*src/i,
      mutate: (fixture) =>
        appendText(
          join(fixture, 'README.md'),
          '<img src="assets/demos/readme-proof-hero.webp" src="https://example.com/proof.png" alt="Proof">',
        ),
    },
    {
      name: 'duplicate srcset',
      expected: /duplicate html image attribute.*srcset/i,
      mutate: (fixture) =>
        appendText(
          join(fixture, 'README.md'),
          '<source srcset="https://example.com/proof.png 1x" srcset="assets/demos/readme-proof-hero.webp 1x">',
        ),
    },
    {
      name: 'case-insensitive duplicate alt',
      expected: /duplicate html image attribute.*alt/i,
      mutate: (fixture) =>
        appendText(
          join(fixture, 'README.md'),
          '<img src="assets/demos/readme-proof-hero.webp" alt="Proof visual" ALT="Harmless duplicate">',
        ),
    },
    {
      name: 'empty inline Markdown image destination',
      expected: /markdown image.*empty destination/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '![Broken image]()'),
    },
    {
      name: 'whitespace inline Markdown image destination',
      expected: /markdown image.*empty destination/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '![Broken image](   )'),
    },
    {
      name: 'HTML img without a destination',
      expected: /html img.*usable destination/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '<img alt="Broken image">'),
    },
    {
      name: 'HTML source without a destination',
      expected: /html source.*usable destination/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '<source>'),
    },
    {
      name: 'HTML img with empty src',
      expected: /html img.*usable destination/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '<img src="" alt="Broken image">'),
    },
    {
      name: 'HTML img with whitespace src',
      expected: /html img.*usable destination/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '<img src="   " alt="Broken image">'),
    },
    {
      name: 'HTML source with empty srcset',
      expected: /html source.*usable destination/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '<source srcset="">'),
    },
    {
      name: 'HTML source with separator-only srcset',
      expected: /html source.*usable destination/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '<source srcset=" , ">'),
    },
    {
      name: 'HTML source with src but no srcset',
      expected: /html source.*usable destination/i,
      mutate: (fixture) =>
        appendText(join(fixture, 'README.md'), '<source src="assets/demos/readme-proof-hero.webp">'),
    },
    {
      name: 'unresolved explicit image reference',
      expected: /unresolved markdown image reference/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '![Draft visual][missing]'),
    },
    {
      name: 'unresolved collapsed image reference',
      expected: /unresolved markdown image reference/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '![Draft visual][]'),
    },
    {
      name: 'unresolved shortcut image reference',
      expected: /unresolved markdown image reference/i,
      mutate: (fixture) => appendText(join(fixture, 'README.md'), '![Draft visual]'),
    },
    {
      name: 'unallowlisted reference-style image',
      expected: /image reference is not allowlisted/i,
      mutate: (fixture) =>
        appendText(
          join(fixture, 'README.md'),
          '![Draft visual][draft]\n\n[draft]: assets/sources/maxvideoai-editorial-branch-converge-source.png',
        ),
    },
    {
      name: 'unallowlisted HTML image',
      expected: /image reference is not allowlisted/i,
      mutate: (fixture) =>
        appendText(
          join(fixture, 'README.md'),
          '<img src="assets/sources/maxvideoai-editorial-branch-converge-source.png" alt="Draft visual">',
        ),
    },
    {
      name: 'reference-only exported raster',
      expected: /must be publishable_proof/i,
      mutate: (_fixture, manifestPath) =>
        writeManifestFixture(manifestPath, (manifest) => {
          const asset = manifest.assets.find((entry) => entry.id === 'readme-proof-hero');
          assert.ok(asset);
          asset.state = 'reference_only';
        }),
    },
    {
      name: 'missing raster registration',
      expected: /unregistered (?:raster )?asset/i,
      mutate: (_fixture, manifestPath) =>
        writeManifestFixture(manifestPath, (manifest) => {
          manifest.assets = manifest.assets.filter((entry) => entry.id !== 'readme-proof-hero');
        }),
    },
    {
      name: 'stale raster hash',
      expected: /hash mismatch/i,
      mutate: (fixture) =>
        writeFileSync(
          join(fixture, 'assets', 'demos', 'readme-proof-hero.webp'),
          Buffer.concat([
            readFileSync(join(fixture, 'assets', 'demos', 'readme-proof-hero.webp')),
            Buffer.from('stale'),
          ]),
        ),
    },
  ];

  for (const [index, fixtureCase] of cases.entries()) {
    await t.test(fixtureCase.name, () => {
      const fixture = join(temporary, `fixture-${index}`);
      const manifestPath = join(temporary, `asset-manifest-${index}.json`);
      cpSync(source, fixture, { recursive: true });
      cpSync(defaultAssetManifest, manifestPath);
      fixtureCase.mutate(fixture, manifestPath);
      const result = runBuilder(fixture, join(temporary, `out-${index}`), manifestPath);
      assert.notEqual(result.status, 0, `${fixtureCase.name} fixture unexpectedly passed`);
      assert.match(`${result.stderr}\n${result.stdout}`, fixtureCase.expected);
    });
  }

  assert.equal(basename(builder), 'build-maxvideoai-plugin-release.mjs');
});

test('release builder rejects an output directory inside its source tree', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-output-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const fixture = join(temporary, 'source-copy');
  cpSync(source, fixture, { recursive: true });

  const result = runBuilder(fixture, join(fixture, 'dist'), defaultAssetManifest);
  assert.notEqual(result.status, 0, 'output inside source unexpectedly passed');
  assert.match(`${result.stderr}\n${result.stdout}`, /output path.*inside.*source/i);
});

test('version 0.3.0 requires discovery metadata and its release asset', async (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-version-gate-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const requiredFiles = version03ExpectedPublicFiles;

  for (const [index, missingFile] of requiredFiles.entries()) {
    await t.test(missingFile, () => {
      const fixture = join(temporary, `source-copy-${index}`);
      cpSync(source, fixture, { recursive: true });
      addVersion03Metadata(fixture);
      rmSync(join(fixture, missingFile), { force: true });

      const result = runBuilder(fixture, join(temporary, `out-${index}`), defaultAssetManifest);
      assert.notEqual(result.status, 0, `0.3.0 package without ${missingFile} unexpectedly passed`);
      assert.match(
        `${result.stderr}\n${result.stdout}`,
        new RegExp(`required public file is missing: ${missingFile.replaceAll('.', '\\.')}`, 'i'),
      );
    });
  }
});

test('a complete 0.3.0 fixture exports its version-aware metadata and release asset', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-version-success-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const fixture = join(temporary, 'source-copy');
  const out = join(temporary, 'out');
  cpSync(source, fixture, { recursive: true });
  addVersion03Metadata(fixture);

  const result = runBuilder(fixture, out, defaultAssetManifest);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const expectedPublicFiles = expectedPublicFilesForVersion('0.3.0');
  const bundleRoot = join(out, 'maxvideoai-plugin');
  assert.deepEqual(
    filesAt(bundleRoot).map((path) => relative(bundleRoot, path)).sort(),
    [...expectedPublicFiles, 'checksums.json'].sort(),
  );
  const checksums = JSON.parse(readFileSync(join(bundleRoot, 'checksums.json'), 'utf8')) as {
    files: Record<string, string>;
  };
  assert.deepEqual(Object.keys(checksums.files), expectedPublicFiles);
  assert.deepEqual(
    readZipDirectory(join(out, 'maxvideoai-plugin-0.3.0.zip')).map((entry) => entry.name),
    [...expectedPublicFiles, 'checksums.json'].sort().map((path) => `maxvideoai/${path}`),
  );
});

test('version 0.3.0 requires an explicit marketplace plugin version', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-marketplace-required-version-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const fixture = join(temporary, 'source-copy');
  cpSync(source, fixture, { recursive: true });
  addVersion03Metadata(fixture);
  const marketplacePath = join(fixture, '.claude-plugin', 'marketplace.json');
  const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8')) as {
    plugins: Array<Record<string, unknown>>;
  };
  delete marketplace.plugins[0].version;
  writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);

  const result = runBuilder(fixture, join(temporary, 'out'), defaultAssetManifest);
  assert.notEqual(result.status, 0, '0.3.0 package without a marketplace plugin version unexpectedly passed');
  assert.match(`${result.stderr}\n${result.stdout}`, /marketplace.*explicit version.*0\.3\.0/i);
});

test('marketplace version must match when the schema carries one', (t) => {
  const temporary = mkdtempSync(join(safeTemporaryRoot, 'maxvideoai-plugin-marketplace-version-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const fixture = join(temporary, 'source-copy');
  cpSync(source, fixture, { recursive: true });
  addVersion03Metadata(fixture);
  setMarketplacePluginVersion(fixture, '9.9.9');

  const result = runBuilder(fixture, join(temporary, 'out'), defaultAssetManifest);
  assert.notEqual(result.status, 0, 'mismatched marketplace version unexpectedly passed');
  assert.match(`${result.stderr}\n${result.stdout}`, /marketplace.*version.*0\.3\.0/i);
});
