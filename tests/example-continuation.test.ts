import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExampleRequest, buildAssistantRequestHref, exampleRequestSource, parseExampleEntryId } from '../frontend/lib/example-continuation';
import { detail } from './fixtures/example-continuation';

test('assistant requests preserve public source settings and full prompt without treating a comparison proposal as the original', () => {
  const text = buildExampleRequest(exampleRequestSource(detail), 'fr', 'assistant');
  for (const value of [detail.prompt, detail.videoUrl, '/video/mountain-observatory', 'Kling 3', '8 s', '1080p', '16:9', 'Image to video', '42', 'No flicker', 'https://api.maxvideoai.com/mcp']) assert.ok(text.includes(value), value);
  assert.match(text, /accord|confirme/);
  assert.match(text, /références/i);
  assert.doesNotMatch(text, /999|amountCents|historicalCost|quoteId/);
  const unknown = { ...detail, scenario: null, prompt: 'Unabridged '.repeat(2000) };
  const request = buildExampleRequest(exampleRequestSource(unknown), 'en', 'assistant');
  assert.ok(request.includes(unknown.prompt));
  assert.doesNotMatch(request, /1080p/);
  assert.match(request, /incomplete/i);
  const recorded = { ...unknown, context: { ...unknown.context, details: [...unknown.context.details, { key: 'resolution', label: 'Resolution', value: '720p' }] } };
  assert.ok(buildExampleRequest(exampleRequestSource(recorded), 'fr', 'assistant').includes('720p'), 'a known recorded resolution survives incomplete comparison settings');
});

test('external links encode the entire request and long requests use the clipboard fallback without silently truncating', () => {
  for (const assistant of ['chatgpt', 'claude'] as const) {
    const text = buildExampleRequest(exampleRequestSource(detail), 'es', 'assistant');
    const url = new URL(buildAssistantRequestHref(assistant, text));
    assert.equal(url.hostname, assistant === 'chatgpt' ? 'chatgpt.com' : 'claude.ai');
    assert.equal(url.searchParams.get('q'), text);
    assert.equal(new URL(buildAssistantRequestHref(assistant, text.repeat(100))).searchParams.has('q'), false);
  }
});

test('Studio uses the same source facts with a localized editable brief and no external connector setup instructions', () => {
  for (const locale of ['en', 'fr', 'es']) {
    const text = buildExampleRequest(exampleRequestSource(detail), locale, 'studio');
    assert.ok(text.includes(detail.prompt));
    assert.ok(text.includes('1080p'));
    assert.doesNotMatch(text, /api\.maxvideoai\.com\/mcp/);
  }
  assert.equal(parseExampleEntryId('public-example'), 'public-example');
  for (const invalid of [['public-example'], '../admin', 'https://other.test', '', 'a'.repeat(129)]) assert.equal(parseExampleEntryId(invalid), null);
});
