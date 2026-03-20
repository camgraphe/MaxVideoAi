import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAudioMixFilterGraph } from '../frontend/src/server/audio/media';

test('audio mix graph prioritizes voice and ducks music when narration is present', () => {
  const graph = buildAudioMixFilterGraph(true);

  assert.match(graph, /sidechaincompress=threshold=0\.03:ratio=10:attack=20:release=450/);
  assert.match(graph, /\[3:a\]aresample=48000,volume=1\.18\[voice\]/);
  assert.match(graph, /\[2:a\]aresample=48000,volume=0\.70\[music\]/);
  assert.match(graph, /\[sfx\]\[musicduck\]amix=inputs=2:duration=longest:normalize=0:weights=1 0\.85\[bed\]/);
  assert.match(graph, /weights=1 1\.3,alimiter=limit=0\.92\[outa\]/);
});

test('audio mix graph stays lighter when no voice track is present', () => {
  const graph = buildAudioMixFilterGraph(false);

  assert.doesNotMatch(graph, /sidechaincompress/);
  assert.match(graph, /\[2:a\]aresample=48000,volume=0\.70\[music\]/);
  assert.match(graph, /weights=1 0\.85,alimiter=limit=0\.92\[outa\]/);
});
