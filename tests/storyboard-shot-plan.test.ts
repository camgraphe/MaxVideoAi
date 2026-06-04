import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStoryboardPrompt } from '../frontend/src/components/tools/storyboard/_lib/storyboard-prompt.ts';
import { buildStoryboardShotPlan } from '../frontend/src/components/tools/storyboard/_lib/storyboard-shot-plan.ts';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

test('prompt includes shot map guidance and panel metadata rows', () => {
  const shotPlan = buildStoryboardShotPlan({
    subject: 'Founder in a product demo',
    action: 'Show the product and react',
    dialogue: 'Founder: This is ready for launch.',
    style: 'ugc',
    targetModel: 'kling',
    orientation: 'landscape',
    durationSec: 10,
    frameCount: 4,
  });
  const prompt = buildStoryboardPrompt({
    subject: 'Founder in a product demo',
    action: 'Show the product and react',
    dialogue: 'Founder: This is ready for launch.',
    visualNotes: 'Keep the office background bright and avoid text overlays.',
    style: 'ugc',
    targetModel: 'kling',
    orientation: 'landscape',
    durationSec: 10,
    frameCount: 4,
    templateReference: true,
    shotPlan,
  });

  assert.match(prompt, /Shot map:/);
  assert.match(prompt, /Panel 1:/);
  assert.match(prompt, /Landscape 16:9/);
  assert.match(prompt, /blank landscape storyboard structure template/);
  assert.match(prompt, /metadata rows below each thumbnail/);
  assert.match(prompt, /Under every thumbnail, fill exactly these metadata rows/);
  assert.match(prompt, /Shot type, Camera, Action, Dialogue/);
  assert.match(prompt, /Metadata rows: Shot type:/);
  assert.match(prompt, /Dialogue: Founder: This is ready for launch/);
  assert.match(prompt, /Scene notes and constraints/);
  assert.match(prompt, /no captions inside thumbnails/);
});

test('prompt keeps the global brief out of repeated panel rows', () => {
  const subject =
    'A funny UGC soda spot with a polished presenter holding one colorful can in a bright casual studio, preserving the same product, room, outfit, lighting, and playful eco props across the sequence';
  const action =
    'Plan one continuous handheld vertical take where the presenter reveals the can near the lens, steps back, points to a small plant, places the can beside a recycling bin, takes one sip, and finishes with a confident product pose';
  const shotPlan = buildStoryboardShotPlan({
    subject,
    action,
    dialogue: 'Presenter: This can makes the whole room feel brighter.',
    style: 'ugc',
    targetModel: 'kling',
    durationSec: 10,
    frameCount: 6,
    referenceImageCount: 2,
  });
  const prompt = buildStoryboardPrompt({
    subject,
    action,
    dialogue: 'Presenter: This can makes the whole room feel brighter.',
    visualNotes: 'Keep the same presenter, product, room, and camera path.',
    style: 'ugc',
    targetModel: 'kling',
    orientation: 'portrait',
    durationSec: 10,
    frameCount: 6,
    templateReference: true,
    referenceImageCount: 2,
    shotPlan,
  });

  const subjectOccurrences = prompt.match(new RegExp(escapeRegExp(subject), 'g'))?.length ?? 0;
  const actionOccurrences = prompt.match(new RegExp(escapeRegExp(action), 'g'))?.length ?? 0;

  assert.equal(subjectOccurrences, 1);
  assert.equal(actionOccurrences, 1);
  assert.ok(prompt.length < 9000, `expected compact storyboard prompt, got ${prompt.length} chars`);
});

test('prompt stays below provider limits when optional fields are very long', () => {
  const longSubject = Array.from({ length: 180 }, (_, index) => `Subject detail ${index + 1}: same can, same presenter, same studio, same styling.`).join(' ');
  const longAction = Array.from({ length: 180 }, (_, index) => `Action beat ${index + 1}: keep a smooth handheld move and product continuity.`).join(' ');
  const longDialogue = Array.from({ length: 120 }, (_, index) => `Presenter: line ${index + 1} about the product feeling bright and refreshing.`).join('\n');
  const longNotes = Array.from({ length: 120 }, (_, index) => `Constraint ${index + 1}: avoid overlays and keep the product readable.`).join(' ');
  const shotPlan = buildStoryboardShotPlan({
    subject: longSubject,
    action: longAction,
    dialogue: longDialogue,
    style: 'ugc',
    targetModel: 'kling',
    durationSec: 10,
    frameCount: 6,
    referenceImageCount: 2,
  });
  const prompt = buildStoryboardPrompt({
    subject: longSubject,
    action: longAction,
    dialogue: longDialogue,
    visualNotes: longNotes,
    style: 'ugc',
    targetModel: 'kling',
    orientation: 'portrait',
    durationSec: 10,
    frameCount: 6,
    templateReference: true,
    referenceImageCount: 2,
    shotPlan,
  });

  assert.ok(prompt.length < 32000, `expected prompt below provider limit, got ${prompt.length} chars`);
  assert.match(prompt, /trimmed/);
});

test('prompt rewrites risky negative constraints into neutral production language', () => {
  const prompt = buildStoryboardPrompt({
    subject: 'A Miami glam influencer presents a soda bottle in a phone-shot UGC ad',
    action: 'Walk toward camera and keep the bottle readable',
    visualNotes:
      'Avoid vulgarity, drunk behavior, inappropriate jokes, extra people, celebrity likenesses, and use body language from the reference.',
    dialogue: 'Presenter: This bottle has chaotic confidence.',
    style: 'ugc',
    targetModel: 'kling',
    orientation: 'portrait',
    durationSec: 10,
    frameCount: 6,
  });

  assert.doesNotMatch(prompt, /drunk|vulgarity|vulgar|inappropriate|celebrity likeness|body language/i);
  assert.match(prompt, /clean/);
  assert.match(prompt, /generic non-famous people/i);
  assert.match(prompt, /gesture language/i);
});
