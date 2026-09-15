import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CREATIVE_FILMS } from '../frontend/components/marketing/creative-films';

test('creative collection only uses originals explicitly public in the reviewed selection', () => {
  const selection = JSON.parse(readFileSync('docs/redesign/review/reference-film-09/selection.json', 'utf8'));
  for (const film of CREATIVE_FILMS) {
    const source = selection.clips.find((clip: { key: string }) => clip.key === film.key);
    assert.equal(source?.visibility, 'public');
    assert.equal(film.video, source.video);
    assert.equal(film.poster, source.poster);
    assert.equal(film.model, source.model);
    assert.equal(new URL(film.video).hostname, 'media.maxvideoai.com');
    assert.equal(new URL(film.video).search, '');
  }
});

test('below-fold creative films retain manual shared playback and a responsive cover', () => {
  const source = readFileSync('frontend/components/marketing/CreativeFilm.client.tsx', 'utf8');
  assert.match(source, /usePublicVideoControls\(video, 'watch'\)/);
  assert.match(source, /src=\{video\} preload="none"/);
  assert.match(source, /loading="lazy"/);
  assert.doesNotMatch(source, /autoPlay|setInterval|poster=|fetchPriority="high"/);
});
