import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const providerDirectory = join(root, 'frontend/src/server/video-providers/alibaba-model-studio');
const submissionPath = join(root, 'frontend/app/api/generate/_lib/alibaba-model-studio-submission.ts');
const pollPath = join(root, 'frontend/server/alibaba-model-studio-poll.ts');
const providerAttemptsPath = join(root, 'frontend/src/server/video-providers/provider-attempts.ts');
const frontendDirectory = join(root, 'frontend');

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

function frontendTypescriptFiles(): string[] {
  return readdirSync(frontendDirectory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

test('Alibaba direct video integration has one adapter, submission owner, and poll owner', () => {
  assert.ok(existsSync(providerDirectory));
  assert.deepEqual(readdirSync(providerDirectory).sort(), [
    'client.ts', 'cost.ts', 'errors.ts', 'index.ts', 'model-map.ts', 'payload.ts', 'response.ts', 'types.ts',
  ]);
  assert.ok(existsSync(submissionPath));
  assert.ok(existsSync(pollPath));

  const sources = frontendTypescriptFiles().map((path) => ({ path, contents: source(path) }));
  assert.deepEqual(
    sources.filter(({ contents }) => /export async function submitAlibabaModelStudioGenerateTask/u.test(contents))
      .map(({ path }) => relative(root, path)),
    ['frontend/app/api/generate/_lib/alibaba-model-studio-submission.ts'],
  );
  assert.deepEqual(
    sources.filter(({ contents }) => /export async function runAlibabaModelStudioPoll/u.test(contents))
      .map(({ path }) => relative(root, path)),
    ['frontend/server/alibaba-model-studio-poll.ts'],
  );
});

test('Alibaba submission and polling reuse shared attempts and durable media ownership', () => {
  const submission = source(submissionPath);
  const poll = source(pollPath);
  assert.match(submission, /video-providers\/provider-attempts/);
  assert.match(poll, /video-providers\/provider-attempts/);
  assert.match(poll, /provider-output-policy/);
  assert.match(poll, /ensureFastStartVideo/);
  assert.match(poll, /upsertLegacyJobOutputs/);
  assert.match(source(providerAttemptsPath), /sanitizeSnapshotValue/);
});

test('client components never import Alibaba provider server modules', () => {
  const clientImports = frontendTypescriptFiles()
    .filter((path) => path.endsWith('.client.tsx') || /^['"]use client['"];?/u.test(source(path).trimStart()))
    .filter((path) => /server\/video-providers\/alibaba-model-studio|server\/alibaba-model-studio-poll/u.test(source(path)))
    .map((path) => relative(root, path));
  assert.deepEqual(clientImports, []);
});
