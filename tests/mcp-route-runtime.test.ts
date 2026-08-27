import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = 'frontend/app/api/mcp/route.ts';

test('MCP route leaves enough runtime for slow provider acceptance', () => {
  const source = readFileSync(routePath, 'utf8');
  const match = source.match(/export const maxDuration = (\d+);/u);

  assert.ok(match, `${routePath} should own an explicit maximum duration`);
  assert.ok(Number(match[1]) >= 120, 'MCP provider submission needs at least 120 seconds');
});
