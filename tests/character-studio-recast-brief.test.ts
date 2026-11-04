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

test('dialogue suggests whole seconds and a manual duration survives later script edits', async () => {
  const { getRecastTiming } = await import('../frontend/src/lib/character-studio-recast-timing');
  const script = 'Je vous montre ma montre. Pas ce poignet-là. Voilà. Avec quatre bras, la démo dure un peu plus longtemps.';
  const draft = { sourceSeconds: null, audioSeconds: null, dialogue: script, manualSeconds: null };
  assert.equal(getRecastTiming(draft).seconds, 8);
  assert.equal(getRecastTiming({ ...draft, dialogue: 'Bonjour', manualSeconds: 12 }).seconds, 12);
  assert.equal(getRecastTiming({ ...draft, audioSeconds: 3.27 }).seconds, 4);
  const edit = getRecastTiming({ ...draft, sourceSeconds: 6.4 });
  assert.equal(edit.seconds, 7);
  assert.equal(edit.speechTooLong, true);
  assert.equal(getRecastTiming({ ...draft, dialogue: 'Bonjour '.repeat(100) }).valid, false);
  assert.equal(getRecastTiming({ ...draft, sourceSeconds: 14.3, manualSeconds: 16 }).valid, false);
  const exported = buildRecastBrief({ character: 'Vesper', dialogue: script, durationSec: 12 });
  assert.equal(exported.durationSec, 12);
  assert.equal(exported.sourceVideo, null);
  assert.doesNotMatch(exported.prompt, /supplied video/);
});
