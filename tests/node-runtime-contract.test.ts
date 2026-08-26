import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('root and frontend packages require the supported Node 22 runtime', () => {
  for (const packagePath of ['package.json', 'frontend/package.json']) {
    const manifest = JSON.parse(readFileSync(join(root, packagePath), 'utf8')) as {
      engines?: { node?: string };
    };
    assert.equal(manifest.engines?.node, '22.x', `${packagePath} must pin Node 22.x`);
  }
});

test('every JavaScript GitHub workflow pins Node 22', () => {
  const workflowDirectory = join(root, '.github/workflows');
  const pins: Array<{ file: string; version: string }> = [];

  for (const file of readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/.test(name))) {
    const source = readFileSync(join(workflowDirectory, file), 'utf8');
    for (const match of source.matchAll(/node-version:\s*['"]?([^'"\s]+)['"]?/g)) {
      pins.push({ file, version: match[1] });
    }
  }

  assert.ok(pins.length > 0, 'at least one workflow must declare its Node runtime');
  assert.deepEqual(
    pins.filter(({ version }) => version !== '22'),
    [],
    `workflow Node drift: ${pins.map(({ file, version }) => `${file}=${version}`).join(', ')}`,
  );
});
