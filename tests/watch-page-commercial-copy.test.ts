import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const signalSource = readFileSync(join(root, 'frontend/server/watch-page-signals/content.ts'), 'utf8');
const contentSource = readFileSync(
  join(root, 'frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx'),
  'utf8'
);

test('watch surfaces identify historical job cost as recorded render cost', () => {
  assert.match(signalSource, /label: 'Recorded render cost'/);
  assert.match(contentSource, /label: 'Recorded render cost'/);
  assert.doesNotMatch(signalSource, /label: 'Render cost'/);
  assert.doesNotMatch(contentSource, /label: 'Estimated price'/);
});

test('watch prompt breakdown omits recorded render cost when the job has no stored cost', () => {
  assert.match(
    contentSource,
    /\.\.\.\(costLabel \? \[\{ label: 'Recorded render cost', value: costLabel \}\] : \[\]\)/
  );
  assert.doesNotMatch(contentSource, /Shown before render/);
});

test('localized recorded-cost labels do not imply a live or estimated quote', () => {
  const expected = {
    en: 'Recorded render cost',
    fr: 'Coût enregistré du rendu',
    es: 'Coste registrado del render',
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const messages = JSON.parse(readFileSync(join(root, `frontend/messages/${locale}.json`), 'utf8')) as {
      videoPage: { details: { priceTotalLabel: string } };
    };
    assert.equal(messages.videoPage.details.priceTotalLabel, expected[locale]);
  }
});

test('archived example recall makes the required model change explicit without offering Sora generation', async () => {
  const { buildWatchRecreationCopy } = await import('../frontend/app/(core)/video/[id]/_lib/video-watch-page-utils');
  for (const engineId of ['sora-2', 'openai-sora-2-pro', 'sora-pro']) {
    const copy = buildWatchRecreationCopy(engineId);
    assert.equal(copy.label, 'Reuse prompt with another model');
    assert.match(copy.description, /no longer available/i);
    assert.match(copy.description, /choose another model/i);
  }
  assert.deepEqual(buildWatchRecreationCopy('seedance-2-5'), {
    label: 'Start from this example',
    description: 'Reuse the prompt and available settings. Your next generation gets a fresh quote before you run it.',
  });
});

test('watch hero and sidebar share the current model-aware recall copy', () => {
  const sidebarSource = readFileSync(join(root, 'frontend/app/(core)/video/[id]/_components/VideoWatchSidebar.tsx'), 'utf8');
  assert.match(contentSource, /buildWatchRecreationCopy\(video\.engineId\)/);
  assert.match(contentSource, /recreationCopy=\{recreationCopy\}/);
  for (const source of [contentSource, sidebarSource]) {
    assert.match(source, /\{recreationCopy\.label\}/);
  }
  assert.match(sidebarSource, /\{recreationCopy\.description\}/);
});
