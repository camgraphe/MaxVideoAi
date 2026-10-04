import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { formatCurrentExamplePrice } from '../frontend/lib/current-example-price-display';

const root = process.cwd();
const signalSource = readFileSync(join(root, 'frontend/server/watch-page-signals/content.ts'), 'utf8');
const contentSource = readFileSync(join(root, 'frontend/components/examples/ExampleReaderContent.tsx'), 'utf8');

test('public watch surfaces use current quotes and omit historical charges', () => {
  assert.doesNotMatch(signalSource, /Recorded render cost|finalPriceCents/);
  assert.match(contentSource, /price\(quote\.amountCents, quote\.currency\)/);
  assert.match(contentSource, /copy\.current/);
  assert.doesNotMatch(contentSource, /Recorded render cost|finalPriceCents|detail\.historicalCost/);
});

test('unavailable current quotes omit a numeric price even when the historical render had a charge', () => {
  assert.equal(formatCurrentExamplePrice({ kind: 'unavailable', reason: 'unsupported_scenario' }, 'en'), null);
  assert.match(contentSource, /detail\.quotes\.length \? <div/);
});

test('localized public cost labels describe the current model price', () => {
  const expected = { en: 'Current model price', fr: 'Tarif actuel du modèle', es: 'Precio actual del modelo' };
  for (const locale of ['en', 'fr', 'es'] as const) {
    const messages = JSON.parse(readFileSync(join(root, `frontend/messages/${locale}.json`), 'utf8'));
    assert.equal(messages.videoPage.details.priceTotalLabel, expected[locale]);
  }
});

test('archived public examples retain their identity and prompt while offering only executable alternatives', async () => {
  const { projectExampleWatchDetail } = await import('../frontend/server/example-watch-detail');
  const { getBaseEngines } = await import('../frontend/src/lib/engines');
  const { isArchivedGenerationModel } = await import('../frontend/lib/model-generation-policy');
  const engines = getBaseEngines();
  for (const engineId of ['sora-2', 'openai-sora-2-pro', 'sora-pro', 'seedance-1-5-pro', 'seedance-v1.5-pro']) {
    const quotedEngines: string[] = [];
    const detail = await projectExampleWatchDetail({
      id: 'historical-example', engineId, engineLabel: 'Original archived model',
      prompt: 'Keep this historical prompt', durationSec: 5, aspectRatio: '16:9',
      outputWidth: 1280, outputHeight: 720, hasAudio: true, createdAt: '',
      visibility: 'public', indexable: true, canUpscale: false,
      videoUrl: 'https://media.maxvideoai.com/historical-example.mp4',
      thumbUrl: 'https://media.maxvideoai.com/historical-example.webp',
      finalPriceCents: 401, currency: 'USD',
    }, null, async context => {
      quotedEngines.push(context.engine.id);
      return { totalCents: 200, currency: 'USD' };
    }, engines);
    assert.ok(detail, engineId);
    assert.equal(detail.prompt, 'Keep this historical prompt');
    assert.match(detail.engineLabel, /Sora|Seedance 1\.5/, 'keep the canonical historical model label');
    assert.equal(detail.videoUrl, 'https://media.maxvideoai.com/historical-example.mp4');
    assert.equal(detail.recreateHref, null, 'an archived source must never offer same-model recreation');
    assert.ok(detail.modelHref, 'the historical model page remains available');
    assert.equal(detail.historicalCost?.amountCents, 401, 'the recorded charge remains unchanged');
    assert.equal(detail.quotes.length, 3);
    assert.ok(quotedEngines.every(id => !isArchivedGenerationModel(id)));
    for (const quote of detail.quotes) {
      assert.equal(quote.original, false);
      assert.equal(isArchivedGenerationModel(quote.engineId), false);
      assert.ok(engines.some(engine => engine.id === quote.engineId));
      const href = new URL(quote.href, 'https://maxvideoai.com');
      assert.equal(href.searchParams.get('from'), 'historical-example');
      assert.equal(href.searchParams.get('engine'), quote.engineId);
      assert.equal(href.searchParams.get('remix'), '1');
    }
  }
});
