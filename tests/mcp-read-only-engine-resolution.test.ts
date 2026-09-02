import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import test from 'node:test';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import {
  createAgentModelCatalogDeps,
  listPublicAgentGenerationEngines,
} from '../frontend/src/server/agent-api/model-catalog';
import { calculateAgentProjectBudget } from '../frontend/src/server/agent-api/project-budget';

const ROOT = process.cwd();
const READ_ONLY_OWNER = 'frontend/src/server/agent-api/read-only-engine-catalog.ts';

function resolveLocalImport(owner: string, specifier: string): string | null {
  const candidate = specifier.startsWith('@/')
    ? join(ROOT, 'frontend/src', specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(join(ROOT, owner)), specifier)
      : null;
  if (!candidate) return null;
  for (const path of [candidate, `${candidate}.ts`, `${candidate}.tsx`, join(candidate, 'index.ts')]) {
    if (existsSync(path)) return normalize(path).slice(ROOT.length + 1);
  }
  return null;
}

function localImportClosure(entry: string): Set<string> {
  const visited = new Set<string>();
  const pending = [entry];
  while (pending.length) {
    const owner = pending.pop()!;
    if (visited.has(owner) || !existsSync(join(ROOT, owner))) continue;
    visited.add(owner);
    const source = readFileSync(join(ROOT, owner), 'utf8');
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gu)) {
      const target = resolveLocalImport(owner, match[1]);
      if (target && ['.ts', '.tsx'].includes(extname(target))) pending.push(target);
    }
  }
  return visited;
}

test('MCP hidden catalog resolution is owned by a transitively read-only module', () => {
  assert.equal(existsSync(READ_ONLY_OWNER), true, `${READ_ONLY_OWNER} must own MCP reads`);
  const catalog = readFileSync('frontend/src/server/agent-api/model-catalog.ts', 'utf8');
  assert.match(catalog, /from ['"]\.\/read-only-engine-catalog['"]/u);
  assert.doesNotMatch(catalog, /getConfiguredEngineIncludingHidden/u);

  const closure = localImportClosure(READ_ONLY_OWNER);
  assert.ok(closure.size > 1, 'the proof must inspect transitive local imports');
  for (const forbidden of [
    'frontend/src/lib/schema.ts',
    'frontend/src/server/engine-settings.ts',
    'frontend/src/server/engine-overrides.ts',
  ]) {
    assert.equal(closure.has(forbidden), false, `${READ_ONLY_OWNER} must not reach ${forbidden}`);
  }
  for (const path of closure) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /ensureBillingSchema|ensureEngineSettingsSeed/u, path);
    assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b\s+(?:INTO\s+)?engine_(?:settings|overrides)/iu, path);
  }
});

test('MCP exact hidden details read settings and overrides without touching bootstrap hooks', async () => {
  const module = await import('../frontend/src/server/agent-api/read-only-engine-catalog');
  let settingsReads = 0;
  let overrideReads = 0;
  let billingBootstraps = 0;
  let seedWrites = 0;
  const dependencies = {
    databaseConfigured: () => true,
    async fetchSettings() {
      settingsReads += 1;
      return new Map();
    },
    async fetchOverrides() {
      overrideReads += 1;
      return new Map();
    },
    async ensureBillingSchema() {
      billingBootstraps += 1;
      throw new Error('read-only MCP lookup must not bootstrap billing');
    },
    async ensureEngineSettingsSeed() {
      seedWrites += 1;
      throw new Error('read-only MCP lookup must not seed settings');
    },
  };

  const engine = await module.getReadOnlyConfiguredEngineIncludingHidden(
    'wan-3',
    false,
    dependencies,
  );
  assert.equal(engine?.id, 'wan-3');
  assert.equal(settingsReads, 1);
  assert.equal(overrideReads, 1);
  assert.equal(billingBootstraps, 0);
  assert.equal(seedWrites, 0);
});

test('get_model_details and project-budget published selection use the same non-mutating read seam', async () => {
  let settingsReads = 0;
  let overrideReads = 0;
  let billingBootstraps = 0;
  let seedWrites = 0;
  const readDependencies = {
    databaseConfigured: () => true,
    async fetchSettings() { settingsReads += 1; return new Map(); },
    async fetchOverrides() { overrideReads += 1; return new Map(); },
    async ensureBillingSchema() { billingBootstraps += 1; },
    async ensureEngineSettingsSeed() { seedWrites += 1; },
  };
  const catalogDeps = {
    ...createAgentModelCatalogDeps(undefined, readDependencies),
    isEngineExecutable: () => true,
    isModeExecutable: () => true,
  };
  const details = await getAgentModelDetails('wan-3', catalogDeps);
  assert.equal(details.id, 'wan-3');
  await assert.rejects(calculateAgentProjectBudget({ proposals: [{
    name: 'Read-only canary selection',
    lines: [{
      purpose: 'Resolve the published candidate',
      engineId: 'wan-3',
      mode: 't2v',
      settings: { durationSec: 5, resolution: '1080p', aspectRatio: '16:9' },
      clipCount: 1,
      attemptsPerClip: 1,
    }],
  }] }, {
    userId: 'read-only-user', clientId: 'read-only-client', emailVerified: true, authMethod: 'oauth',
  }, {
    listPublicEngines: () => listPublicAgentGenerationEngines(catalogDeps),
    getMembershipStatus: async () => ({ pricing: { tier: 'member' } }),
    async priceGeneration() { throw new Error('pricing sentinel after read-only selection'); },
    computeCatalogRevision: () => 'read-only-revision',
  }), /Current project pricing is unavailable/u);

  assert.equal(settingsReads, 2);
  assert.equal(overrideReads, 2);
  assert.equal(billingBootstraps, 0);
  assert.equal(seedWrites, 0);
});

test('transactional hidden catalog reload emits only lock and SELECT statements', async () => {
  const module = await import('../frontend/src/server/agent-api/read-only-engine-catalog');
  const sql: string[] = [];
  const executor = {
    async query(statement: string) {
      sql.push(statement.trim());
      return [];
    },
  } as TransactionQueryExecutor;

  const engine = await module.getReadOnlyConfiguredEngineIncludingHiddenInExecutor('wan-3', executor);
  assert.equal(engine?.id, 'wan-3');
  assert.equal(sql.length, 3);
  assert.ok(sql.every((statement) => /^(?:LOCK|SELECT)\b/iu.test(statement)), sql.join('\n'));
  assert.ok(sql.every((statement) => !/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/iu.test(statement)));
});
