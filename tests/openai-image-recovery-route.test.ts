import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from '../frontend/app/api/cron/openai-image-recovery/route';

test('OpenAI recovery requires the shared cron secret before database work, including locally', async () => {
  const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new NextRequest('http://localhost/api/cron/openai-image-recovery'))).status, 401);
    process.env.CRON_SECRET = 'offline-cron-only';
    assert.equal((await GET(new NextRequest('http://localhost/api/cron/openai-image-recovery', { headers: { authorization: 'Bearer wrong' } }))).status, 401);
  } finally { if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous; }
});

test('the recovery worker cannot submit a provider request or initialize a database from polling', () => {
  const source = readFileSync('frontend/src/server/images/openai-image-output-recovery.ts', 'utf8');
  assert.doesNotMatch(source, /OpenAIImageClient|openai-image-client|OPENAI_API_KEY|fetch\(|reserveOpenAI|ensure.*Schema|quoteCanonical|computeCanonical/);
  const route = readFileSync('frontend/app/api/cron/openai-image-recovery/route.ts', 'utf8');
  assert.doesNotMatch(route, /ensure.*Schema|req\.json\(/);
  const config = JSON.parse(readFileSync('frontend/vercel.json', 'utf8'));
  assert.ok(config.crons.some((entry: { path: string }) => entry.path === '/api/cron/openai-image-recovery'));
});
