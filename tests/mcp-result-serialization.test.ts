import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { runAgentTool, successfulToolResult } from '../frontend/src/server/mcp/tool-result';

// Synthetic protocol samples, not production traffic or token/latency estimates.
const samples = {
  catalog: { models: Array.from({ length: 10 }, (_, index) => ({
    id: `fixture-model-${index}`, label: `Fixture model ${index}`, surface: 'video',
    modes: ['t2v', 'i2v'], aspectRatios: ['16:9', '9:16'], resolutions: ['720p', '1080p'],
    generationEnabled: true, audio: false, maxDurationSec: 10, successor: null,
  })) },
  quote: {
    quoteId: 'fixture-quote', amountCents: 125, currency: 'USD',
    expiresAt: '2026-09-21T22:45:00.000Z',
    settings: { durationSec: 8, audio: false, seed: 0 },
    prompt: '  Caméra fixe.\nLa personne dit : "Bonjour 👋".  ',
    references: [{ assetId: 'fixture-reference', role: 'source' }],
    nextAction: { type: 'confirm_quote', confirmed: false },
  },
  recovery: {
    jobId: 'fixture-job', status: 'running', progress: 0, result: null,
    retry: { tool: 'get_generation_status', arguments: { jobId: 'fixture-job' }, afterSeconds: 30 },
  },
};

test('compact JSON preserves every value and the text fallback alongside structured content', (t) => {
  const links = [{
    uri: 'https://example.invalid/original.mp4?signature=a%2Fb&value=+',
    name: 'Original', description: 'Fixture original', mimeType: 'video/mp4',
  }];
  for (const [name, value] of Object.entries(samples)) {
    const result = successfulToolResult(value, links);
    const text = result.content[0];
    assert.equal(text.type, 'text');
    if (text.type !== 'text') throw new Error('Missing text fallback');
    assert.deepEqual(JSON.parse(text.text), value, name);
    assert.deepEqual(result.structuredContent, value, name);
    assert.deepEqual(result.content.slice(1), links.map(link => ({ type: 'resource_link', ...link })));
    assert.equal(text.text.includes('\n'), false, 'formatting must not add line breaks; string values retain escaped newlines');
    const before = {
      ...result,
      content: [{ type: 'text', text: JSON.stringify(value, null, 2) }, ...result.content.slice(1)],
    };
    const beforeBytes = Buffer.byteLength(JSON.stringify(before));
    const afterBytes = Buffer.byteLength(JSON.stringify(result));
    assert.ok(afterBytes < beforeBytes, name);
    t.diagnostic(JSON.stringify({ sample: name, beforeBytes, afterBytes, savedBytes: beforeBytes - afterBytes }));
  }
});

test('compact error fallback preserves actionable data and the protocol error flag', async () => {
  const result = await runAgentTool(async () => {
    throw new AgentApiError('RATE_LIMITED', 'Attendre\nla reprise.', true, { retryAfterSeconds: 30 });
  });
  assert.equal(result.isError, true);
  const text = result.content[0];
  assert.equal(text.type, 'text');
  if (text.type !== 'text') throw new Error('Missing error text fallback');
  assert.deepEqual(JSON.parse(text.text), result.structuredContent);
  assert.deepEqual(result.structuredContent, {
    ok: false,
    error: { code: 'RATE_LIMITED', message: 'Attendre\nla reprise.', retryable: true, nextAction: { retryAfterSeconds: 30 } },
  });
  assert.equal(text.text.includes('\n'), false);
});
