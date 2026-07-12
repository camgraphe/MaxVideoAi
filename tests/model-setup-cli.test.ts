import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import test from 'node:test';

const script = 'scripts/model-setup.mjs';

function run(args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function runPnpm(args: string[]) {
  return spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['model:setup', '--', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

const requiredArgs = [
  '--from',
  'seedance-2-0',
  '--slug',
  'task-ten-test-model',
  '--name',
  'Task Ten Model',
  '--family',
  'seedance',
];

test('model setup documents and validates canonical model categories', () => {
  const help = run(['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--category <video\|image\|audio\|multimodal>/);

  const invalid = run([...requiredArgs, '--category', 'document', '--dry-run']);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /--category must be video, image, audio, or multimodal\./);
});

test('model setup dry run prints a complete canonical registry entry and commands', () => {
  const result = run([
    ...requiredArgs,
    '--engine',
    'task-ten-engine',
    '--category',
    'image',
    '--dry-run',
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"id": "task-ten-engine"/);
  assert.match(result.stdout, /"slug": "task-ten-test-model"/);
  assert.match(result.stdout, /"family": "seedance"/);
  assert.match(result.stdout, /"category": "image"/);
  assert.match(result.stdout, /"internal": \[\]/);
  assert.match(result.stdout, /"publicSlugs": \[\]/);
  assert.match(result.stdout, /"replacement": null/);
  assert.match(result.stdout, /pnpm model:registry:generate/);
  assert.match(result.stdout, /pnpm engine:catalog/);
  assert.match(result.stdout, /pnpm model:generate:write/);
  assert.match(result.stdout, /pnpm model:registry:check/);
  assert.match(result.stdout, /frontend\/config\/model-registry\.json/);
  assert.doesNotMatch(result.stdout, /new in the engine catalog, add its catalog\/config entries separately/);
});

test('documented pnpm model setup entrypoint accepts its argument separator', () => {
  const help = runPnpm(['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--category <video\|image\|audio\|multimodal>/);

  const sample = runPnpm([...requiredArgs, '--category', 'multimodal', '--dry-run']);
  assert.equal(sample.status, 0, sample.stderr);
  assert.match(sample.stdout, /"category": "multimodal"/);
  assert.match(sample.stdout, /\[dry-run\] write content\/models\/en\/task-ten-test-model\.json/);
  for (const path of [
    'content/models/en/task-ten-test-model.json',
    'content/models/fr/task-ten-test-model.json',
    'content/models/es/task-ten-test-model.json',
    'docs/model-launch/task-ten-test-model.engine.stub.ts',
    'docs/model-launch/task-ten-test-model.family.stub.ts',
    'docs/model-launch/task-ten-test-model.md',
  ]) {
    assert.equal(existsSync(path), false, `${path} was written during --dry-run`);
  }

  const invalid = runPnpm([...requiredArgs, '--category', 'document', '--dry-run']);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /--category must be video, image, audio, or multimodal\./);
});
