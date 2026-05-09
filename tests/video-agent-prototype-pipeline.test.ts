import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_VIDEO_AGENT_SETTINGS,
  VIDEO_AGENT_LLM_CONFIG,
  VIDEO_AGENT_PRESETS,
} from '../frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-config';
import {
  EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
  getMissingCommercialBriefFields,
  isCommercialBriefComplete,
} from '../frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-brief';
import {
  applyCommercialIntakeMessage,
  askNextCommercialBriefQuestion,
} from '../frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-intake';
import { createCommercialVideoPromptPackage } from '../frontend/app/(core)/(workspace)/app/video-agents/_lib/commercial-video-prompt-package';
import { reviewCommercialVideoRequest } from '../frontend/app/(core)/(workspace)/app/video-agents/_lib/video-agent-safety';

test('commercial intake extracts a complete brief from a labeled client message', () => {
  const brief = applyCommercialIntakeMessage(
    EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    [
      'Product: black connected watch',
      'Audience: urban professionals',
      'Goal: launch',
      'Benefit: stay focused and connected',
      'Scene: minimalist premium tech studio',
      'Style: luxury cinematic tech commercial',
      'Tone: calm, precise, premium',
      'CTA: Stay Ahead',
      'Include: watch face lighting up, wrist usage shot',
      'Avoid: medical claims, fake logos, Apple-like design',
    ].join('\n')
  );

  assert.equal(brief.productOrOffer, 'black connected watch');
  assert.equal(brief.marketingGoal, 'launch');
  assert.deepEqual(brief.mustInclude, ['watch face lighting up', 'wrist usage shot']);
  assert.deepEqual(brief.avoid, ['medical claims', 'fake logos', 'Apple-like design']);
  assert.equal(isCommercialBriefComplete(brief), true);
  assert.deepEqual(getMissingCommercialBriefFields(brief), []);
});

test('commercial intake extracts a natural English coffee ad request', () => {
  const brief = applyCommercialIntakeMessage(
    EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    'Create a 10 second premium product ad for an artisanal coffee brand aimed at busy morning customers. Show espresso pouring on a warm cafe counter at sunrise. The main benefit is fresh morning energy. Style premium cinematic. CTA Start Fresh. Avoid fake logos and unreadable text.'
  );

  assert.equal(brief.productOrOffer, 'artisanal coffee brand');
  assert.equal(brief.audience, 'busy morning customers');
  assert.equal(brief.mainBenefit, 'fresh morning energy');
  assert.equal(brief.scene, 'warm cafe counter at sunrise');
  assert.equal(brief.visualStyle, 'premium cinematic');
  assert.equal(brief.cta, 'Start Fresh');
  assert.deepEqual(brief.avoid, ['fake logos', 'unreadable text']);
  assert.equal(isCommercialBriefComplete(brief), true);
});

test('commercial intake extracts a common natural English restaurant ad request', () => {
  const brief = applyCommercialIntakeMessage(
    EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    'I need a warm cinematic restaurant ad for a cozy Italian restaurant targeting local couples. Show fresh pasta on a candlelit table, benefit is handmade food in a welcoming evening atmosphere, CTA Book Tonight, avoid alcohol focus and crowded background.'
  );

  assert.equal(brief.productOrOffer, 'cozy Italian restaurant');
  assert.equal(brief.audience, 'local couples');
  assert.equal(brief.mainBenefit, 'handmade food in a welcoming evening atmosphere');
  assert.equal(brief.scene, 'fresh pasta on a candlelit table');
  assert.equal(brief.visualStyle, 'warm cinematic restaurant ad');
  assert.equal(brief.cta, 'Book Tonight');
  assert.deepEqual(brief.avoid, ['alcohol focus', 'crowded background']);
  assert.equal(isCommercialBriefComplete(brief), true);
});

test('commercial intake keeps a vague English product request focused and asks for audience next', () => {
  const brief = applyCommercialIntakeMessage(
    EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    'Make a UGC style ad for my skincare serum'
  );

  assert.equal(brief.productOrOffer, 'skincare serum');
  assert.equal(brief.visualStyle, 'UGC style');
  assert.deepEqual(getMissingCommercialBriefFields(brief), [
    'audience',
    'mainBenefit',
    'scene',
    'cta',
  ]);
  assert.equal(
    askNextCommercialBriefQuestion(brief),
    'Who is the main target audience for this video?'
  );
});

test('safety blocks explicit sexual requests before prompt preparation', () => {
  const unsafeBrief = {
    ...EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    productOrOffer: 'fashion perfume',
    audience: 'adults',
    marketingGoal: 'conversion' as const,
    mainBenefit: 'premium fragrance',
    scene: 'studio',
    visualStyle: 'luxury commercial',
    brandTone: 'bold',
    cta: 'Shop now',
    avoid: ['boring lighting'],
    rawRequest: 'create a nude perfume ad',
  };

  const review = reviewCommercialVideoRequest(unsafeBrief);

  assert.equal(review.allowed, false);
  assert.match(review.reason ?? '', /sexual|nudity/i);
});

test('safety does not block protective avoid instructions for celebrity likeness', () => {
  const safeBrief = {
    ...EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    productOrOffer: 'meal delivery app',
    audience: 'busy young professionals',
    marketingGoal: 'conversion' as const,
    mainBenefit: 'save time while eating well',
    scene: 'home entrance in the evening',
    visualStyle: 'clean modern lifestyle commercial',
    brandTone: 'warm and friendly',
    cta: 'Order tonight',
    avoid: ['fake logos', 'tiny unreadable app text', 'celebrity likeness'],
    legalSafetyConstraints: ['no celebrity likeness'],
    rawRequest:
      'Create a promotional video for a meal delivery app. Avoid fake logos, tiny unreadable app text, and celebrity likeness.',
  };

  const review = reviewCommercialVideoRequest(safeBrief);

  assert.equal(review.allowed, true);
});

test('safety still blocks affirmative celebrity requests', () => {
  const unsafeBrief = {
    ...EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    productOrOffer: 'energy drink',
    audience: 'sports fans',
    marketingGoal: 'conversion' as const,
    mainBenefit: 'high energy mood',
    scene: 'stadium',
    visualStyle: 'cinematic commercial',
    brandTone: 'bold',
    cta: 'Try it',
    rawRequest: 'Create a video with Tom Cruise drinking our energy drink.',
  };

  const review = reviewCommercialVideoRequest(unsafeBrief);

  assert.equal(review.allowed, false);
  assert.match(review.reason ?? '', /protected IP|celebrities|likeness/i);
});

test('commercial video prompt package exposes Seedance settings, scenario, reviewer output, and final prompt', () => {
  const preset = VIDEO_AGENT_PRESETS[0];
  const brief = applyCommercialIntakeMessage(
    EMPTY_COMMERCIAL_VIDEO_AGENT_BRIEF,
    [
      'Product: artisanal coffee',
      'Audience: coffee lovers and busy morning customers',
      'Goal: social_ad',
      'Benefit: fresh premium coffee that starts the day well',
      'Scene: warm cafe counter at sunrise',
      'Style: premium cinematic lifestyle ad',
      'Tone: cozy, premium, inviting',
      'CTA: Start Fresh',
      'Include: coffee cup, visible steam, coffee bag, clean final hero shot',
      'Avoid: fake logos, unreadable text, crowded background',
    ].join('\n')
  );

  const result = createCommercialVideoPromptPackage({
    brief,
    estimatedPriceCents: 240,
    preset,
    settings: DEFAULT_VIDEO_AGENT_SETTINGS,
  });

  assert.equal(result.videoEngine, 'seedance-2.0');
  assert.equal(result.imageEngine, null);
  assert.equal(result.mode, 'text-to-video');
  assert.equal(result.settings.engineLabel, 'Seedance 2.0');
  assert.equal(result.settings.generationMode, 't2v');
  assert.equal(result.settings.durationSec, 10);
  assert.equal(result.structuredScenario.timeline.length, 3);
  assert.equal(result.reviewChecklist.fitsSelectedDuration, true);
  assert.equal(result.reviewChecklist.usesSeedanceFriendlyStructure, true);
  assert.match(result.finalPrompt, /Create a 10-second commercial video for artisanal coffee/);
  assert.match(result.finalPrompt, /0-3s:/);
  assert.match(result.finalPrompt, /Composition: vertical 9:16/);
  assert.match(result.finalPrompt, /Use original generic branding only/);
  assert.deepEqual(result.negativePromptOrAvoid.slice(0, 3), [
    'fake logos',
    'unreadable text',
    'crowded background',
  ]);
});

test('video agent LLM config separates intake, prompt writing, and human-readable latency', () => {
  assert.equal(VIDEO_AGENT_LLM_CONFIG.intakeModel, 'gpt-5.4-nano');
  assert.equal(VIDEO_AGENT_LLM_CONFIG.promptModel, 'gpt-5.4-mini');
  assert.equal(VIDEO_AGENT_LLM_CONFIG.reviewerModel, 'gpt-5.4-mini');
  assert.ok(
    VIDEO_AGENT_LLM_CONFIG.latency.intakeMinimumMs >= 900,
    'nano intake should not feel instantaneous in the chat UI'
  );
  assert.ok(
    VIDEO_AGENT_LLM_CONFIG.latency.promptMinimumMs >= 1600,
    'prompt writing should expose a longer thinking state'
  );
});
