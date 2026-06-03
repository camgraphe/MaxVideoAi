import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStoryboardPrompt } from '../frontend/src/components/tools/storyboard/_lib/storyboard-prompt.ts';
import { buildStoryboardShotPlan } from '../frontend/src/components/tools/storyboard/_lib/storyboard-shot-plan.ts';

test('builds deterministic 4, 6, and 8 panel shot maps', () => {
  const four = buildStoryboardShotPlan({
    subject: 'Coffee bag',
    action: 'Reveal the packaging',
    style: 'cinema',
    targetModel: 'kling',
    durationSec: 6,
    frameCount: 4,
  });
  const six = buildStoryboardShotPlan({
    subject: 'Coffee bag',
    action: 'Reveal the packaging',
    style: 'cinema',
    targetModel: 'kling',
    durationSec: 10,
    frameCount: 6,
  });
  const eight = buildStoryboardShotPlan({
    subject: 'Coffee bag',
    action: 'Reveal the packaging',
    style: 'cinema',
    targetModel: 'kling',
    durationSec: 15,
    frameCount: 8,
  });

  assert.equal(four.shots.length, 4);
  assert.equal(six.shots.length, 6);
  assert.equal(eight.shots.length, 8);
  assert.match(four.shots[0]?.title ?? '', /Establishing/i);
  assert.match(four.shots[3]?.title ?? '', /End frame/i);
  assert.match(six.shots[2]?.title ?? '', /Main action/i);
  assert.match(eight.shots[4]?.title ?? '', /Secondary angle/i);
});

test('allocates dialogue across middle panels and keeps speaker labels', () => {
  const plan = buildStoryboardShotPlan({
    subject: 'Founder in a product demo',
    action: 'Show the product and react',
    dialogue: 'Founder: This is ready for launch.\nCustomer: It feels premium.',
    style: 'ugc',
    targetModel: 'kling',
    durationSec: 10,
    frameCount: 6,
  });

  const dialogueBeats = plan.shots.map((shot) => shot.dialogueBeat).filter(Boolean);
  assert.equal(dialogueBeats.length, 2);
  assert.match(dialogueBeats[0] ?? '', /Founder:/);
  assert.match(dialogueBeats[1] ?? '', /Customer:/);
  assert.equal(plan.shots[0]?.dialogueBeat, undefined);
  assert.equal(plan.shots[5]?.dialogueBeat, undefined);
});

test('adds target, style, and reference guidance', () => {
  const plan = buildStoryboardShotPlan({
    subject: 'Animated cooking object',
    action: 'Pour sauce into a pan',
    style: 'anime',
    targetModel: 'seedance',
    durationSec: 10,
    frameCount: 6,
    referenceImageCount: 2,
  });

  assert.match(plan.summary, /Seedance/i);
  assert.match(plan.targetGuidance, /no real people/i);
  assert.match(plan.styleGuidance, /anime/i);
  assert.match(plan.referenceGuidance ?? '', /2 reference images/i);
  assert.match(plan.shots[3]?.visualPriority ?? '', /reference/i);
});

test('prompt includes shot map guidance while keeping dialogue out of the drawn board', () => {
  const shotPlan = buildStoryboardShotPlan({
    subject: 'Founder in a product demo',
    action: 'Show the product and react',
    dialogue: 'Founder: This is ready for launch.',
    style: 'ugc',
    targetModel: 'kling',
    durationSec: 10,
    frameCount: 4,
  });
  const prompt = buildStoryboardPrompt({
    subject: 'Founder in a product demo',
    action: 'Show the product and react',
    dialogue: 'Founder: This is ready for launch.',
    style: 'ugc',
    targetModel: 'kling',
    durationSec: 10,
    frameCount: 4,
    shotPlan,
  });

  assert.match(prompt, /Shot map:/);
  assert.match(prompt, /Panel 1:/);
  assert.match(prompt, /Do not draw dialogue text/);
});
