import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const studioRoute = readFileSync(join(root, 'frontend/app/api/tools/background-removal/route.ts'), 'utf8');
const realtimeRoute = readFileSync(
  join(root, 'frontend/app/api/tools/background-removal/realtime-session/route.ts'),
  'utf8'
);

test('background removal routes require auth, account health, and feature flag', () => {
  for (const source of [studioRoute, realtimeRoute]) {
    assert.match(source, /FEATURES\.workflows\.toolsSection/);
    assert.match(source, /getRouteAuthContext/);
    assert.match(source, /getActiveAccountRestriction/);
    assert.match(source, /RESTRICTED_ACCOUNT_MESSAGE/);
  }
});

test('realtime session route protects fal token creation', () => {
  assert.match(realtimeRoute, /https:\/\/rest\.fal\.ai\/tokens\/realtime/);
  assert.match(realtimeRoute, /allowed_apps/);
  assert.match(realtimeRoute, /bria\/video\/background-removal\/realtime/);
  assert.doesNotMatch(realtimeRoute, /return NextResponse\.json\(\{ ok: true, token: process\.env/);
});
