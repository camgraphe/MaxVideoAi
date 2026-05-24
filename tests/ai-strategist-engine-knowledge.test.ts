import assert from 'node:assert/strict';
import test from 'node:test';

test('engine knowledge resolves Kling 3 Pro pricing from engine catalog', async () => {
  const { answerEnginePricingQuestion } = await import('../frontend/lib/ai-strategist/knowledge/engine-catalog-knowledge.ts');

  const result = answerEnginePricingQuestion({
    rawUserMessage: 'How much is Kling 3 Pro for 10 seconds with audio?',
  });

  assert.match(result.answer, /Kling 3 Pro/i);
  assert.match(result.answer, /10 seconds/i);
  assert.match(result.answer, /engine catalog/i);
  assert.ok(result.sources.some((source: { id: string }) => source.id === 'engine_catalog'));
  assert.equal(result.limitations.includes('The generator quote shown before rendering is authoritative.'), true);
});

test('engine knowledge answers available durations and resolution settings', async () => {
  const { answerEngineSettingsQuestion } = await import('../frontend/lib/ai-strategist/knowledge/engine-catalog-knowledge.ts');

  const result = answerEngineSettingsQuestion({
    rawUserMessage: 'What settings does Kling 3 4K support?',
  });

  assert.match(result.answer, /Kling 3 4K/i);
  assert.match(result.answer, /4k|4K/i);
  assert.match(result.answer, /duration/i);
  assert.match(result.answer, /aspect ratios/i);
  assert.ok(result.sources.some((source: { path?: string }) => source.path === 'frontend/config/engine-catalog.json'));
});

test('engine knowledge clamps Veo price estimates to catalog duration cap', async () => {
  const { answerEnginePricingQuestion } = await import('../frontend/lib/ai-strategist/knowledge/engine-catalog-knowledge.ts');

  const result = answerEnginePricingQuestion({
    rawUserMessage: 'How much is Veo 3.1 for 15 seconds at 4K?',
  });

  assert.ok(result);
  assert.match(result.answer, /Veo 3\.1/i);
  assert.match(result.answer, /8 seconds/i);
  assert.match(result.answer, /4k/i);
  assert.doesNotMatch(result.answer, /15 seconds/);
  assert.ok(result.warnings.some((warning: string) => /capped at 8 seconds/i.test(warning)));
});
