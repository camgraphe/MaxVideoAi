import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecastBrief, isRecastAudioFile } from '../frontend/src/lib/character-studio-recast';

test('product and voice belong to separate references and the literal spoken line survives export', () => {
  const input = {
    source: 'clip.mp4',
    character: 'Cole · Minuit acier',
    product: 'watch.png',
    direction: 'Turn wrist.',
    dialogue: '  Regardez ce cadran.  ',
    audio: 'voice.wav',
  };
  const brief = buildRecastBrief(input);
  assert.deepEqual(brief.images, [
    { role: 'character', file: input.character },
    { role: 'product', file: 'watch.png' },
  ]);
  assert.equal(brief.referenceAudio, 'voice.wav');
  assert.equal(brief.dialogue, 'Regardez ce cadran.');
  assert.equal(brief.generateAudio, true);
  assert.ok(brief.prompt.includes(input.direction));
  assert.ok(brief.prompt.includes(JSON.stringify(brief.dialogue)));
  const silent = buildRecastBrief({ source: input.source, character: input.character, dialogue: '  ' });
  assert.equal(silent.generateAudio, false);
  assert.equal(silent.images.length, 1);
  assert.doesNotMatch(silent.prompt, /product|speak|audio/i);
});

test('audio reference follows the supported file types and byte limit', () => {
  const file = { name: 'line.wav', type: 'audio/wav', size: 9000 };
  assert.ok(isRecastAudioFile(file));
  assert.ok(isRecastAudioFile({ ...file, name: 'LINE.MP3', type: 'audio/mpeg' }));
  assert.equal(isRecastAudioFile({ ...file, name: 'line.m4a', type: 'audio/mp4' }), false);
  assert.equal(isRecastAudioFile({ ...file, size: 0 }), false);
  assert.equal(isRecastAudioFile({ ...file, size: 15 * 1024 * 1024 + 1 }), false);
});
