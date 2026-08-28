import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
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

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function filesAt(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name);
    return entry.isDirectory() ? filesAt(entryPath) : [entryPath];
  });
}

function runBuilder(sourcePath: string, outPath: string) {
  return spawnSync(process.execPath, [builder, '--source', sourcePath, '--out', outPath], {
    cwd: root,
    encoding: 'utf8',
  });
}

test('release builder exports a deterministic public plugin archive with checksums', (t) => {
  const temporary = mkdtempSync(join(tmpdir(), 'maxvideoai-plugin-release-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const firstOut = join(temporary, 'first');
  const secondOut = join(temporary, 'second');

  const first = runBuilder(source, firstOut);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const second = runBuilder(source, secondOut);
  assert.equal(second.status, 0, second.stderr || second.stdout);

  const bundleRoot = join(firstOut, 'maxvideoai-plugin');
  const relativeFiles = filesAt(bundleRoot).map((path) => relative(bundleRoot, path)).sort();
  assert.deepEqual(relativeFiles, [
    '.claude-plugin/marketplace.json',
    '.claude-plugin/plugin.json',
    '.codex-plugin/plugin.json',
    '.mcp.json',
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    'SECURITY.md',
    'VERSION',
    'assets/logo-mark.svg',
    'checksums.json',
    'scripts/import-reference-files.mjs',
    'skills/generate/SKILL.md',
    'skills/generate/agents/openai.yaml',
    'skills/generate/references/generation-safety.md',
    'skills/generate/references/reference-inputs.md',
    'skills/plan/SKILL.md',
    'skills/plan/agents/openai.yaml',
    'skills/plan/references/budget-planning.md',
  ]);

  const version = readFileSync(join(bundleRoot, 'VERSION'), 'utf8').trim();
  const codex = JSON.parse(readFileSync(join(bundleRoot, '.codex-plugin/plugin.json'), 'utf8'));
  const claude = JSON.parse(readFileSync(join(bundleRoot, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(version, '0.3.0');
  assert.equal(codex.version, version);
  assert.equal(claude.version, version);
  assert.equal(codex.skills, './skills/');
  assert.equal(codex.mcpServers, './.mcp.json');

  const checksums = JSON.parse(readFileSync(join(bundleRoot, 'checksums.json'), 'utf8')) as {
    algorithm: string;
    files: Record<string, string>;
  };
  assert.equal(checksums.algorithm, 'sha256');
  assert.deepEqual(Object.keys(checksums.files), relativeFiles.filter((path) => path !== 'checksums.json'));
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
});

test('release builder fails closed for secret files, symlinks, and staging origins', (t) => {
  const temporary = mkdtempSync(join(tmpdir(), 'maxvideoai-plugin-reject-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));

  for (const mutation of ['secret', 'symlink', 'staging'] as const) {
    const fixture = join(temporary, mutation);
    cpSync(source, fixture, { recursive: true });
    if (mutation === 'secret') {
      writeFileSync(join(fixture, '.env'), 'MCP_SECRET=do-not-package\n');
    } else if (mutation === 'symlink') {
      symlinkSync('README.md', join(fixture, 'README-LINK.md'));
    } else {
      writeFileSync(
        join(fixture, 'README.md'),
        `${readFileSync(join(fixture, 'README.md'), 'utf8')}\nhttps://maxvideoai-mcp-staging.vercel.app\n`,
      );
    }
    const result = runBuilder(fixture, join(temporary, `out-${mutation}`));
    assert.notEqual(result.status, 0, `${mutation} fixture unexpectedly passed`);
    assert.match(`${result.stderr}\n${result.stdout}`, /forbidden|staging|symlink/i);
  }

  assert.equal(basename(builder), 'build-maxvideoai-plugin-release.mjs');
});
