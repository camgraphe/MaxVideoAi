import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET as listModes } from '../frontend/app/api/mobile/audio/catalog/route';
import { GET as getMode } from '../frontend/app/api/mobile/audio/catalog/[mode]/route';
import type { MobileAudioCatalog } from '../frontend/lib/mobile-audio-contract';

const catalogUrl = 'https://example.invalid/api/mobile/audio/catalog';

function modeResponse(mode: string, query: string) {
  return getMode(new NextRequest(catalogUrl + '/' + mode + query), {
    params: Promise.resolve({ mode }),
  });
}

for (const withReferences of [false, true]) {
  const query = withReferences ? '?references=1' : '';
  test(`public mobile audio discovery, reference support ${withReferences}`, async () => {
    const response = await listModes(new Request(catalogUrl + query));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    const { modes, options }: MobileAudioCatalog = await response.json();
    const expected = ['ambience_only', 'music_only', 'sfx_only', 'song', 'voice_only'];
    if (withReferences) expected.push('cinematic', 'cinematic_voice');
    assert.deepEqual(modes.map(entry => entry.mode).sort(), expected.sort());
    assert.ok(options.elevenVoices.length > 0);
    for (const entry of modes) {
      assert.equal('references' in entry, withReferences);
      const detail = await modeResponse(entry.mode, query);
      assert.equal(detail.status, 200);
      assert.deepEqual(await detail.json(), entry);
    }
    const music = modes.find(entry => entry.mode === 'music_only');
    if (withReferences) {
      assert.equal(music?.references?.sourceVideo, 'optional');
      assert.equal(modes.find(entry => entry.mode === 'cinematic')?.references?.sourceVideo, 'required');
    } else {
      assert.equal(music?.duration.source, 'requested');
      assert.equal((await modeResponse('cinematic', query)).status, 404);
    }
    const missing = await modeResponse('unknown', query);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'MODE_NOT_FOUND');
  });
}
