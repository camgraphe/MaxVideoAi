import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAudioMixFilterGraph } from '../frontend/src/server/audio/media';

test('audio mix graph prioritizes voice and ducks music when narration is present', () => {
  const graph = buildAudioMixFilterGraph({
    hasSoundDesign: true,
    hasMusic: true,
    hasVoice: true,
    targetDurationSec: 10,
  });

  assert.match(graph, /sidechaincompress=threshold=0\.03:ratio=10:attack=20:release=450/);
  assert.match(graph, /\[2:a\]aresample=48000,volume=1\.18\[voice\]/);
  assert.match(graph, /\[1:a\]aresample=48000,volume=0\.70\[music\]/);
  assert.match(graph, /\[sfx\]\[musicduck\]amix=inputs=2:duration=longest:weights=1 0\.85\[bed\]/);
  assert.match(graph, /weights=1 1\.30,atrim=0:10\.000,asetpts=N\/SR\/TB,alimiter=limit=0\.92\[outa\]/);
});

test('audio mix graph stays lighter when no voice track is present', () => {
  const graph = buildAudioMixFilterGraph({
    hasSoundDesign: true,
    hasMusic: true,
    hasVoice: false,
  });

  assert.doesNotMatch(graph, /sidechaincompress/);
  assert.match(graph, /\[1:a\]aresample=48000,volume=0\.70\[music\]/);
  assert.match(graph, /weights=1 0\.85,alimiter=limit=0\.92\[outa\]/);
});

test('audio mix graph supports sfx plus voice without music', () => {
  const graph = buildAudioMixFilterGraph({
    hasSoundDesign: true,
    hasMusic: false,
    hasVoice: true,
  });

  assert.doesNotMatch(graph, /sidechaincompress/);
  assert.match(graph, /\[1:a\]aresample=48000,volume=1\.18\[voice\]/);
  assert.match(graph, /\[sfx\]\[voice\]amix=inputs=2:duration=longest:weights=1 1\.30,alimiter=limit=0\.92\[outa\]/);
});

test('audio mix graph supports standalone voice and standalone music', () => {
  const voiceGraph = buildAudioMixFilterGraph({
    hasSoundDesign: false,
    hasMusic: false,
    hasVoice: true,
  });
  const musicGraph = buildAudioMixFilterGraph({
    hasSoundDesign: false,
    hasMusic: true,
    hasVoice: false,
    targetDurationSec: 8,
  });

  assert.match(voiceGraph, /\[0:a\]aresample=48000,volume=1\.14,alimiter=limit=0\.92\[outa\]/);
  assert.match(musicGraph, /\[0:a\]aresample=48000,volume=0\.88,atrim=0:8\.000,asetpts=N\/SR\/TB,alimiter=limit=0\.92\[outa\]/);
});
