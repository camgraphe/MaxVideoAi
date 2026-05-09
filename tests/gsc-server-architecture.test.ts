import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const facadePath = 'frontend/server/seo/gsc.ts';
const modulePaths = {
  auth: 'frontend/server/seo/gsc/auth.ts',
  client: 'frontend/server/seo/gsc/client.ts',
  config: 'frontend/server/seo/gsc/config.ts',
  constants: 'frontend/server/seo/gsc/constants.ts',
  dashboardBuilders: 'frontend/server/seo/gsc/dashboard-builders.ts',
  dashboardCache: 'frontend/server/seo/gsc/dashboard-cache.ts',
  types: 'frontend/server/seo/gsc/types.ts',
};

const facadeSource = readFileSync(facadePath, 'utf8');

test('GSC public module stays a thin facade', () => {
  const lineCount = facadeSource.split('\n').length;

  assert.ok(lineCount <= 140, `frontend/server/seo/gsc.ts should stay below 140 lines, got ${lineCount}`);
  assert.match(facadeSource, /export async function fetchGscDashboardData/);
  assert.match(facadeSource, /export async function inspectGscUrl/);
  assert.match(facadeSource, /from '\.\/gsc\/dashboard-builders'/);
  assert.match(facadeSource, /from '\.\/gsc\/dashboard-cache'/);
  assert.match(facadeSource, /from '\.\/gsc\/client'/);
  assert.match(facadeSource, /from '\.\/gsc\/config'/);
  assert.match(facadeSource, /from '\.\/gsc\/types'/);
  assert.doesNotMatch(facadeSource, /createSign/);
  assert.doesNotMatch(facadeSource, /fs\.readFile/);
  assert.doesNotMatch(facadeSource, /app_settings/);
  assert.doesNotMatch(facadeSource, /classifyGscModelFamily/);
});

test('GSC server responsibilities live in focused modules', () => {
  for (const path of Object.values(modulePaths)) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }

  const authSource = readFileSync(modulePaths.auth, 'utf8');
  const clientSource = readFileSync(modulePaths.client, 'utf8');
  const configSource = readFileSync(modulePaths.config, 'utf8');
  const dashboardBuildersSource = readFileSync(modulePaths.dashboardBuilders, 'utf8');
  const dashboardCacheSource = readFileSync(modulePaths.dashboardCache, 'utf8');
  const typesSource = readFileSync(modulePaths.types, 'utf8');

  assert.match(authSource, /export async function getAccessToken/);
  assert.match(authSource, /requestOAuthRefreshAccessToken/);
  assert.match(authSource, /requestServiceAccountAccessToken/);
  assert.match(clientSource, /export async function querySearchAnalytics/);
  assert.match(clientSource, /export async function inspectGscUrlWithConfig/);
  assert.match(configSource, /export function resolveGscConfig/);
  assert.match(dashboardBuildersSource, /export function buildGscDashboardData/);
  assert.match(dashboardBuildersSource, /export function buildEmptyDashboard/);
  assert.match(dashboardCacheSource, /export async function readDashboardCache/);
  assert.match(dashboardCacheSource, /export async function writeDashboardCache/);
  assert.match(dashboardCacheSource, /export function withCacheAge/);
  assert.match(typesSource, /export type GscDashboardData/);
  assert.match(typesSource, /export type GscUrlInspectionApiResult/);
});
