import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata.ts';

test('metadata preserves a complete descriptive title when the automatic brand would exceed the title budget', () => {
  const metadata = buildSeoMetadata({
    locale: 'en',
    englishPath: '/models/minimax-h3-max',
    title: 'MiniMax H3 Max AI Video: Fast 768P, References & Audio',
    description: 'Generate video with MiniMax H3 Max.',
  });
  assert.deepEqual(metadata.title, { absolute: 'MiniMax H3 Max AI Video: Fast 768P, References & Audio' });
  assert.equal(metadata.openGraph?.title, 'MiniMax H3 Max AI Video: Fast 768P, References & Audio');
  assert.equal(metadata.twitter?.title, 'MiniMax H3 Max AI Video: Fast 768P, References & Audio');
});

test('metadata preserves authored long localized titles without synthesizing an ellipsis', () => {
  const metadata = buildSeoMetadata({
    locale: 'es',
    englishPath: '/models/seedance-2-5',
    title: 'Generador de vídeo con IA Seedance 2.5: 30 segundos, 1080p y audio',
    description: 'Genera vídeos con Seedance 2.5.',
    titleBranding: 'none',
  });
  assert.deepEqual(metadata.title, {
    absolute: 'Generador de vídeo con IA Seedance 2.5: 30 segundos, 1080p y audio',
  });
  assert.equal(metadata.alternates?.canonical, 'https://maxvideoai.com/es/modelos/seedance-2-5');
});

test('short titles retain branding and authored branded titles are not branded twice', () => {
  for (const [title, expected] of [
    ['  Pricing  ', 'Pricing — MaxVideoAI'],
    ['AI Video Pricing | MaxVideoAI', 'AI Video Pricing | MaxVideoAI'],
  ]) {
    const metadata = buildSeoMetadata({ locale: 'en', title, description: 'Pricing.', englishPath: '/pricing' });
    assert.deepEqual(metadata.title, { absolute: expected });
  }
});
