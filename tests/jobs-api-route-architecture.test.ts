import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/jobs/route.ts');
const typesPath = join(root, 'frontend/app/api/jobs/_lib/jobs-route-types.ts');
const cursorPath = join(root, 'frontend/app/api/jobs/_lib/jobs-route-cursor.ts');
const surfaceFilterPath = join(root, 'frontend/app/api/jobs/_lib/jobs-surface-filter.ts');
const staleAudioPath = join(root, 'frontend/app/api/jobs/_lib/jobs-stale-audio.ts');
const falRefreshPath = join(root, 'frontend/app/api/jobs/_lib/jobs-fal-refresh.ts');

const routeSource = readFileSync(routePath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');
const cursorSource = readFileSync(cursorPath, 'utf8');
const surfaceFilterSource = readFileSync(surfaceFilterPath, 'utf8');
const staleAudioSource = readFileSync(staleAudioPath, 'utf8');
const falRefreshSource = readFileSync(falRefreshPath, 'utf8');

test('jobs API route delegates server helper responsibilities', () => {
  assert.ok(existsSync(typesPath), 'jobs API row types should live in a route-local lib module');
  assert.ok(existsSync(cursorPath), 'jobs API cursor parsing should live in a route-local lib module');
  assert.ok(existsSync(surfaceFilterPath), 'jobs API surface SQL filters should live in a route-local lib module');
  assert.ok(existsSync(staleAudioPath), 'jobs API stale audio handling should live in a route-local lib module');
  assert.ok(existsSync(falRefreshPath), 'jobs API Fal refresh handling should live in a route-local lib module');

  assert.match(routeSource, /from '\.\/_lib\/jobs-route-types'/);
  assert.match(routeSource, /from '\.\/_lib\/jobs-route-cursor'/);
  assert.match(routeSource, /from '\.\/_lib\/jobs-surface-filter'/);
  assert.match(routeSource, /from '\.\/_lib\/jobs-stale-audio'/);
  assert.match(routeSource, /from '\.\/_lib\/jobs-fal-refresh'/);

  assert.doesNotMatch(routeSource, /getFalClient/, 'Fal client refresh belongs in jobs-fal-refresh.ts');
  assert.doesNotMatch(routeSource, /resolveFalModelId/, 'Fal model lookup belongs in jobs-fal-refresh.ts');
  assert.doesNotMatch(routeSource, /updateJobFromFalWebhook/, 'Fal webhook projection belongs in jobs-fal-refresh.ts');
  assert.doesNotMatch(routeSource, /type PricingSnapshot/, 'pricing snapshot typing belongs in route helper modules');
  assert.doesNotMatch(routeSource, /const STALE_AUDIO_JOB_TIMEOUT_MS/, 'stale audio timeout policy belongs in jobs-stale-audio.ts');
  assert.doesNotMatch(routeSource, /listFalEngines/, 'image engine alias lookup belongs in jobs-surface-filter.ts');
  assert.doesNotMatch(routeSource, /type JobRow =/, 'SQL row typing belongs in jobs-route-types.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 400, `jobs API route should stay below 400 lines after helper extraction, got ${lineCount}`);
});

test('jobs API route helper modules expose expected contracts', () => {
  assert.match(typesSource, /export const APP_JOBS_SELECT/);
  assert.match(typesSource, /export type JobRow/);
  assert.match(typesSource, /export type JobsRouteParam/);
  assert.match(cursorSource, /export function parseCursorParam/);
  assert.match(cursorSource, /export function formatCursorValue/);
  assert.match(surfaceFilterSource, /export const IMAGE_ENGINE_ALIASES/);
  assert.match(surfaceFilterSource, /export function buildSurfaceFilterClause/);
  assert.match(staleAudioSource, /export function isStaleAudioJob/);
  assert.match(staleAudioSource, /export async function expireStaleAudioJob/);
  assert.match(falRefreshSource, /export async function refreshStaleFalJobs/);
  assert.match(falRefreshSource, /getFalClient/);
  assert.match(falRefreshSource, /updateJobFromFalWebhook/);
});

test('jobs API keeps storyboard renders out of generic video and image feeds', () => {
  assert.match(
    routeSource,
    /surface IN \('image', 'storyboard', 'character', 'angle', 'audio', 'upscale', 'background-removal'\)/,
    'type=video should explicitly exclude storyboard jobs by surface'
  );
  assert.match(
    routeSource,
    /settings_snapshot->>'surface' IN \('image', 'storyboard', 'character-builder', 'angle', 'audio', 'upscale', 'background-removal'\)/,
    'type=video should explicitly exclude storyboard jobs by snapshot surface'
  );
  assert.match(routeSource, /job_id LIKE 'storyboard_%'/, 'type=video should exclude legacy storyboard job ids');
  assert.match(
    routeSource,
    /COALESCE\(surface, ''\) NOT IN \('storyboard'\)/,
    'type=image should not absorb storyboard jobs through image heuristics'
  );
  assert.match(
    surfaceFilterSource,
    /COALESCE\(surface, ''\) IN \('image', 'storyboard', 'character', 'angle', 'audio', 'upscale', 'background-removal'\)/,
    'surface=video should explicitly reject storyboard jobs'
  );
});
