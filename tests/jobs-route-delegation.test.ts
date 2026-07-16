import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const listRoutePath = join(root, 'frontend/app/api/jobs/route.ts');
const detailRoutePath = join(root, 'frontend/app/api/jobs/[jobId]/route.ts');
const statusServicePath = join(root, 'frontend/src/server/generations/generation-status.ts');
const recentServicePath = join(root, 'frontend/src/server/generations/recent-generations.ts');
const agentPolicyPath = join(root, 'frontend/src/server/generations/agent-generation-policy.ts');
const recentWebMapperPath = join(root, 'frontend/src/server/generations/recent-generation-web-mapper.ts');

test('jobs routes delegate owned reads and explicit web mapping to transport-neutral services', () => {
  assert.ok(existsSync(statusServicePath));
  assert.ok(existsSync(recentServicePath));

  const listRoute = readFileSync(listRoutePath, 'utf8');
  const detailRoute = readFileSync(detailRoutePath, 'utf8');

  assert.match(listRoute, /from '@\/server\/generations\/recent-generations'/);
  assert.match(listRoute, /readRecentGenerationRecordsForWeb/);
  assert.match(listRoute, /mapRecentGenerationRecordToWeb/);
  assert.doesNotMatch(listRoute, /SELECT\s+\$\{APP_JOBS_SELECT\}/);

  assert.match(detailRoute, /from '@\/server\/generations\/generation-status'/);
  assert.match(detailRoute, /readOwnedGenerationRecord/);
  assert.match(detailRoute, /mapGenerationStatusRecordToWeb/);
  assert.doesNotMatch(detailRoute, /const JOB_DETAIL_SELECT/);
});

test('generation read services stay server-only and agent DTOs exclude private route fields', () => {
  const statusService = readFileSync(statusServicePath, 'utf8');
  const recentService = readFileSync(recentServicePath, 'utf8');
  const combined = `${statusService}\n${recentService}`;

  assert.doesNotMatch(combined, /from ['"]next(?:\/server)?['"]/);
  assert.doesNotMatch(combined, /NextRequest|NextResponse/);

  const agentTypeStart = statusService.indexOf('export type AgentGenerationStatus');
  const agentTypeEnd = statusService.indexOf('\n};', agentTypeStart);
  const agentType = statusService.slice(agentTypeStart, agentTypeEnd);
  assert.doesNotMatch(
    agentType,
    /prompt|provider|settingsSnapshot|vendorAccount|stripe|localKey|paymentIntent|token/i
  );
  assert.match(agentType, /retryAfterSeconds:\s*number\s*\|\s*null/);
});

test('generation read owners delegate agent policy and legacy web mapping to focused modules', () => {
  assert.ok(existsSync(agentPolicyPath), 'agent generation policy module should exist');
  assert.ok(existsSync(recentWebMapperPath), 'recent web mapper module should exist');

  const statusService = readFileSync(statusServicePath, 'utf8');
  const recentService = readFileSync(recentServicePath, 'utf8');
  const agentPolicy = readFileSync(agentPolicyPath, 'utf8');
  const recentWebMapper = readFileSync(recentWebMapperPath, 'utf8');

  assert.match(statusService, /from '\.\/agent-generation-policy'/);
  assert.match(statusService, /export \{ mapGenerationStatusRecordToAgent \}/);
  assert.match(recentService, /from '\.\/recent-generation-web-mapper'/);
  assert.match(recentService, /export \{ mapRecentGenerationRecordToWeb \}/);
  assert.match(agentPolicy, /export function mapGenerationStatusRecordToAgent/);
  assert.match(recentWebMapper, /export function mapRecentGenerationRecordToWeb/);
  assert.doesNotMatch(`${agentPolicy}\n${recentWebMapper}`, /NextRequest|NextResponse/);
  assert.ok(statusService.split('\n').length <= 320, 'generation status read owner should stay at or below 320 lines');
  assert.ok(recentService.split('\n').length <= 450, 'recent generation read owner should stay at or below 450 lines');
});

test('route owners shrink while retaining visitor, cache, and mutation responsibilities', () => {
  const listRoute = readFileSync(listRoutePath, 'utf8');
  const detailRoute = readFileSync(detailRoutePath, 'utf8');

  assert.match(listRoute, /VISITOR_WORKSPACE_ENABLED/);
  assert.match(detailRoute, /VISITOR_WORKSPACE_ENABLED/);
  assert.match(listRoute, /private, no-store/);
  assert.match(detailRoute, /private, no-store/);
  assert.match(detailRoute, /export async function PATCH/);
  assert.match(listRoute, /Number\.isFinite\(requestedLimit\)/);
  assert.match(listRoute, /:\s*24;/, 'invalid web limits should use the historical default page size');

  assert.ok(listRoute.split('\n').length <= 300, 'jobs list route should stay at or below 300 lines');
  assert.ok(detailRoute.split('\n').length <= 570, 'job detail route should stay at or below 570 lines');
});
