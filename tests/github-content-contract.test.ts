import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkerPath = path.join(repositoryRoot, 'scripts/check-github-content.mjs');
const fixturesDirectory = path.join(repositoryRoot, 'tests/fixtures/github-content');

function checkFixture(name: string) {
  return spawnSync(process.execPath, [checkerPath, path.join(fixturesDirectory, name)], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

test('accepts a README fixture with concrete proof and an editorial rhythm', () => {
  const result = checkFixture('compliant.md');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passes GitHub content checks/i);
});

test('rejects banned commercial language and unsupported superlatives', () => {
  const result = checkFixture('hype.md');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /banned commercial shortcut.*revolutionary/i);
  assert.match(result.stderr, /unsupported superlative.*best/i);
});

test('rejects non-descriptive image alt text', () => {
  const result = checkFixture('hype.md');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /descriptive alt text.*demo/i);
  assert.match(result.stderr, /descriptive alt text.*photo/i);
  assert.match(result.stderr, /descriptive alt text.*graphic/i);
  assert.match(result.stderr, /descriptive alt text.*\(empty\)/i);
});

test('does not treat fenced code identifiers as commercial superlatives', () => {
  const result = checkFixture('compliant.md');

  assert.equal(result.status, 0, result.stderr);
});

test('rejects a text wall that exceeds cadence limits', () => {
  const result = checkFixture('text-wall.md');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /first 60 README lines/i);
  assert.match(result.stderr, /220 consecutive prose words/i);
  assert.match(result.stderr, /two consecutive H2 sections are text-only/i);
});

test('treats a labeled concrete example as a cadence break', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'maxvideoai-content-'));
  const fixturePath = path.join(directory, 'concrete-example.md');
  const prose = Array.from({ length: 150 }, () => 'producer').join(' ');

  try {
    writeFileSync(fixturePath, `# MaxVideoAI\n\n![Finished video returned in a conversation](proof.png)\n\n${prose}\n\nExample: Compare current models for the hero shot before you request a quote.\n\n${prose}\n`, 'utf8');
    const result = spawnSync(process.execPath, [checkerPath, fixturePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('counts ordinary blockquoted prose toward the cadence limit', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'maxvideoai-content-'));
  const fixturePath = path.join(directory, 'quoted-text-wall.md');
  const prose = Array.from({ length: 221 }, () => 'producer').join(' ');

  try {
    writeFileSync(fixturePath, `# MaxVideoAI\n\n![Finished video returned in a conversation](proof.png)\n\n> ${prose}\n`, 'utf8');
    const result = spawnSync(process.execPath, [checkerPath, fixturePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /220 consecutive prose words/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
