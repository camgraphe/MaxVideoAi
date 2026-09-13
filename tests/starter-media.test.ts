import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { BUILTIN_STARTER_MEDIA, isPublicStarterMediaUrl, STARTER_MEDIA_SLUGS } from '../frontend/lib/starter-media';
import { derivePlaylistRuntimeMeta, isLockedPlaylistSlug } from '../frontend/server/playlists/runtime-meta';

test('image and audio starter collections ship real, bounded local media', () => {
  for (const surface of ['image', 'audio'] as const) {
    assert.equal(BUILTIN_STARTER_MEDIA[surface].length, 3);
    for (const item of BUILTIN_STARTER_MEDIA[surface]) {
      assert.ok(isPublicStarterMediaUrl(item.src));
      const file = `frontend/public${item.src}`;
      assert.ok(existsSync(file));
      assert.ok(statSync(file).size > 1000);
      if (surface === 'image') { assert.ok(statSync(file).size < 200000); assert.ok(item.prompt.length > 100); }
    }
  }
});

test('private, signed and unknown sources cannot enter the public starter image optimizer', () => {
  for (const url of ['https://media.maxvideoai.com/a.webp?token=secret', 'https://other.test/image.webp', 'https://user:secret@media.maxvideoai.com/a.webp', '//private.test/a.webp', '/api/private/image']) assert.equal(isPublicStarterMediaUrl(url), false);
});

test('audio starter selection demonstrates spoken voice, instrumental music and a song', () => {
  assert.deepEqual(BUILTIN_STARTER_MEDIA.audio.map(item => item.audioKind), ['voice', 'music', 'song']);
  for (const item of BUILTIN_STARTER_MEDIA.audio) {
    assert.match(item.src, /^\/assets\/app-starters\/.+-[a-f0-9]{12}\.mp3$/);
    assert.ok(statSync(`frontend/public${item.src}`).size < 450000);
  }
});

test('admin starter playlist roles retain fixed routes and allow bundled empty states', () => {
  for (const surface of ['image', 'audio'] as const) {
    const slug = STARTER_MEDIA_SLUGS[surface];
    assert.equal(isLockedPlaylistSlug(slug), true);
    assert.equal(derivePlaylistRuntimeMeta(slug, 0).drivesRoute, `/app/${surface}`);
    assert.equal(derivePlaylistRuntimeMeta(slug, 3).surfaceStatus, 'ready');
  }
});

test('samples are separate from owned history and no audio preloads or generation is triggered', () => {
  const shelf = readFileSync('frontend/components/starters/StarterMediaShelf.client.tsx', 'utf8');
  assert.match(shelf, /preload="none"/);
  assert.match(shelf, /loading="lazy"/);
  assert.match(shelf, /onUsePrompt\?\.\(item.prompt\)/);
  assert.doesNotMatch(shelf, /runAudioGenerate|runImage|autoPlay|saveImageToLibrary|localStorage/);
  const reader = readFileSync('frontend/server/starter-media.ts', 'utf8');
  assert.match(reader, /p.is_public = TRUE/);
  assert.match(reader, /j.visibility = 'public'/);
  assert.match(reader, /j.surface = \$2/);
  assert.doesNotMatch(reader, /ensure.*Schema|INSERT|UPDATE/);
});
