import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { GEMINI_OMNI_FLASH_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/gemini-omni-flash';
import { KLING_3_TURBO_PRO_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-pro';
import { KLING_3_TURBO_STANDARD_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-standard';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { EngineCaps, Mode } from '../frontend/types/engines';

const BRIEF_PATH = 'docs/model-launch/p1-generation-brief.json';
const MODEL_IDS = [
  'gemini-omni-flash',
  'kling-3-turbo-standard',
  'kling-3-turbo-pro',
  'minimax-h3-max',
] as const;
const INTENTS = ['human', 'scene', 'product', 'multishot'] as const;

type ModelId = (typeof MODEL_IDS)[number];
type Intent = (typeof INTENTS)[number];
type MultiPromptShot = { prompt: string; durationSec: number };
type P1GenerationBrief = {
  modelId: ModelId;
  prompt: string;
  mode: string;
  durationSec: number;
  aspectRatio: string;
  resolution: string;
  outputCount: number;
  intent: Intent;
  audio?: boolean;
  promptExpansionMode?: string;
  multiPrompt?: MultiPromptShot[];
};

const modelContracts: Record<ModelId, {
  engine: EngineCaps;
  executableModes: readonly string[];
  requiredResolution: string;
}> = {
  'gemini-omni-flash': {
    engine: GEMINI_OMNI_FLASH_FAL_ENGINE_REGISTRY[0]!.engine,
    executableModes: ['t2v'],
    requiredResolution: '1080p',
  },
  'kling-3-turbo-standard': {
    engine: KLING_3_TURBO_STANDARD_ENGINE,
    executableModes: ['t2v'],
    requiredResolution: '720p',
  },
  'kling-3-turbo-pro': {
    engine: KLING_3_TURBO_PRO_ENGINE,
    executableModes: ['t2v'],
    requiredResolution: '1080p',
  },
  'minimax-h3-max': {
    engine: MINIMAX_H3_MAX_ENGINE,
    executableModes: ['t2v'],
    requiredResolution: '768P',
  },
};

const REVIEWED_PROMPT_HASHES = [
  '1a972eec509eb5431bfe742c4b0882d9a22298692200d3d54f0a839976a126db',
  'bdf1221fca81d8c8b1b28f279724fa539d625861a300ef8c313b79f7d0ced23f',
  '2741dcc992f2a4706d015268ae325d2b62831d01999dd014737e6a16326868d9',
  'cddb137a2a528536b5e97f087ed79805f4d5ab2ed22796bd30d985c1a1e2d60e',
  'dfd17c3ca43681506d4b2948aa4e43db6649f44095f2d872f6c82381bc0d02e6',
  'd65a8533e073af22d25ef9b065d69f8e436510a323e3a79fa8b80b03c009194b',
  'b4aeea7100876615e33fa323e61f0929cbe6fe81f6616741d4cf2ed2587e5e6a',
  'f301673a554adb8efa56c3169ebcff903a46e2919fbcb13f7388bc429b02a921',
  '9457f4ccd61d385e0e6d8a555818af951b412d7ce6c825bfa6a14730cae2491b',
  '0f04e2c7116070487ae62798124129818d20151ce84d2e76fc9945ec6e821680',
  '98386b27abf4da953de0900010f8cc414cecfb6227aaad6db76c74bb25d97aab',
] as const;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizePrompt(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function withoutColorWords(value: string): string {
  return normalizePrompt(value)
    .replace(/\b(?:red|orange|yellow|green|blue|purple|pink|black|white|gray|grey|brown|gold|silver|teal|cyan|magenta)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentTokens(value: string): Set<string> {
  const stopWords = new Set([
    'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'is', 'of', 'on',
    'or', 'the', 'then', 'through', 'to', 'with', 'without',
  ]);
  return new Set(withoutColorWords(value).split(' ').filter((token) => token.length > 2 && !stopWords.has(token)));
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 1 : intersection / union;
}

function inputField(engine: EngineCaps, fieldId: string, mode: string) {
  const fields = [
    ...(engine.inputSchema?.required ?? []),
    ...(engine.inputSchema?.optional ?? []),
  ];
  return fields.find((field) =>
    field.id === fieldId && (!field.modes || field.modes.includes(mode as Mode)));
}

function loadBriefs(): P1GenerationBrief[] {
  assert.equal(existsSync(BRIEF_PATH), true, `${BRIEF_PATH} should exist`);
  const parsed: unknown = JSON.parse(readFileSync(BRIEF_PATH, 'utf8'));
  assert.ok(Array.isArray(parsed), 'P1 generation brief should be a JSON array');
  return parsed as P1GenerationBrief[];
}

test('P1 launch generation brief defines exactly two executable briefs per target model', () => {
  const briefs = loadBriefs();
  assert.equal(briefs.length, 8);

  for (const modelId of MODEL_IDS) {
    assert.equal(briefs.filter((brief) => brief.modelId === modelId).length, 2, modelId);
  }

  for (const [index, brief] of briefs.entries()) {
    assert.ok(MODEL_IDS.includes(brief.modelId), `brief ${index + 1} has an unknown model`);
    assert.ok(INTENTS.includes(brief.intent), `brief ${index + 1} has an unknown intent`);
    assert.equal(typeof brief.prompt, 'string');
    assert.ok(brief.prompt.trim().length >= 120, `brief ${index + 1} prompt should be concrete`);
    assert.equal(Number.isInteger(brief.durationSec), true);
    assert.equal(typeof brief.aspectRatio, 'string');

    const contract = modelContracts[brief.modelId];
    assert.ok(contract.engine.modes.includes(brief.mode as Mode), `${brief.modelId}:${brief.mode} is not registered`);
    assert.ok(contract.executableModes.includes(brief.mode), `${brief.modelId}:${brief.mode} is not executable in Task 8`);
    assert.equal(brief.outputCount, 1, `${brief.modelId} launch briefs produce one output`);

    const duration = inputField(contract.engine, 'duration', brief.mode);
    const durationOptions = (duration?.values ?? []).map((value) => Number(String(value).replace(/s$/i, '')));
    assert.ok(durationOptions.includes(brief.durationSec), `${brief.modelId}:${brief.durationSec}s is unsupported`);

    const aspectRatio = inputField(contract.engine, 'aspect_ratio', brief.mode);
    assert.ok(aspectRatio?.values?.includes(brief.aspectRatio), `${brief.modelId}:${brief.aspectRatio} is unsupported`);
    assert.equal(brief.resolution, contract.requiredResolution, `${brief.modelId} resolution must be explicit`);
    assert.ok(contract.engine.resolutions.includes(brief.resolution), `${brief.modelId}:${brief.resolution} is unsupported`);
    const pricing = contract.engine.pricingDetails?.perSecondCents;
    const rate = pricing?.byResolution?.[brief.resolution as keyof typeof pricing.byResolution]
      ?? pricing?.default;
    assert.equal(typeof rate, 'number', `${brief.modelId}:${brief.resolution} has no local pricing input`);
    assert.ok((rate ?? 0) > 0, `${brief.modelId}:${brief.resolution} local pricing input must be positive`);
    assert.ok(
      brief.prompt.length <= (contract.engine.inputLimits?.promptMaxChars ?? Number.POSITIVE_INFINITY),
      `${brief.modelId} prompt exceeds its local limit`,
    );

    if (brief.modelId === 'gemini-omni-flash') {
      assert.equal(brief.audio, true, 'Gemini launch briefs request native audio explicitly');
    } else {
      assert.equal(Object.hasOwn(brief, 'audio'), false, `${brief.modelId} always generates audio without a toggle`);
    }
    if (brief.modelId === 'minimax-h3-max') {
      assert.equal(brief.promptExpansionMode, 'quality');
      assert.ok(inputField(contract.engine, 'prompt_expansion_mode', brief.mode)?.values?.includes('quality'));
    } else {
      assert.equal(Object.hasOwn(brief, 'promptExpansionMode'), false);
    }

    const keys = Object.keys(brief).sort();
    const expectedKeys = [
      'aspectRatio', 'durationSec', 'intent', 'mode', 'modelId', 'outputCount', 'prompt', 'resolution',
      ...(brief.audio !== undefined ? ['audio'] : []),
      ...(brief.promptExpansionMode !== undefined ? ['promptExpansionMode'] : []),
      ...(brief.multiPrompt ? ['multiPrompt'] : []),
    ].sort();
    assert.deepEqual(keys, expectedKeys, `brief ${index + 1} contains an unsupported field`);
  }
});

test('P1 launch concepts cover people, action environments, products, and a real Kling multishot', () => {
  const briefs = loadBriefs();
  const countIntent = (intent: Intent) => briefs.filter((brief) => brief.intent === intent).length;
  assert.ok(countIntent('human') >= 2);
  assert.ok(countIntent('scene') >= 2);
  assert.ok(countIntent('product') >= 2);
  assert.ok(countIntent('multishot') >= 1);

  for (const brief of briefs.filter((candidate) => candidate.intent === 'human')) {
    assert.match(brief.prompt, /\banonymous\b/i, `${brief.modelId} human concept must be anonymous`);
    assert.match(
      brief.prompt,
      /\b(?:unidentifiable|face (?:always )?(?:hidden|obscured|out of frame|never visible)|seen from behind|shoulders down)\b/i,
      `${brief.modelId} human concept must also hide the face through framing`,
    );
  }

  const multishotBriefs = briefs.filter((brief) => brief.multiPrompt !== undefined);
  assert.equal(multishotBriefs.length, 1, 'exactly one launch brief should exercise structured multishot');
  const [multishot] = multishotBriefs;
  assert.ok(multishot);
  assert.equal(multishot.intent, 'multishot');
  assert.match(multishot.modelId, /^kling-3-turbo-(?:standard|pro)$/);
  assert.equal(multishot.mode, 't2v');
  assert.equal(multishot.multiPrompt!.length, 3, 'the reviewed launch multishot has exactly three shots');
  assert.ok(multishot.multiPrompt!.length >= 2 && multishot.multiPrompt!.length <= 6);
  assert.ok(multishot.multiPrompt!.every((shot) => shot.prompt.trim().length >= 60));
  assert.ok(multishot.multiPrompt!.every((shot) => Number.isInteger(shot.durationSec) && shot.durationSec >= 1));
  assert.equal(
    multishot.multiPrompt!.reduce((total, shot) => total + shot.durationSec, 0),
    multishot.durationSec,
  );
  assert.ok(multishot.durationSec <= 15);
  assert.ok(
    inputField(modelContracts[multishot.modelId].engine, 'multi_prompt', 't2v'),
    `${multishot.modelId} must expose the canonical runtime multi_prompt field`,
  );

  for (const brief of briefs.filter((candidate) => candidate.multiPrompt === undefined)) {
    assert.notEqual(brief.intent, 'multishot', `${brief.modelId} multishot intent needs structured shots`);
  }

  const baker = briefs.find((brief) =>
    brief.modelId === 'kling-3-turbo-standard' && brief.intent === 'human');
  assert.ok(baker);
  assert.match(
    baker.prompt,
    /single cord of dough.*one clean knot.*sets it on a metal baking tray.*rapid lateral tracking.*breath of the oven.*tray snap/is,
  );

  assert.match(multishot.prompt, /continuous rain.*bicycle wheel sound.*three shots.*no dialogue/is);
  assert.ok(multishot.multiPrompt!.every((shot) => /\b(?:rain|wheel|tire|spokes|freehub)\b/i.test(shot.prompt)));
  const atomizer = briefs.find((brief) =>
    brief.modelId === 'kling-3-turbo-pro' && brief.intent === 'product');
  const observatory = briefs.find((brief) =>
    brief.modelId === 'kling-3-turbo-pro' && brief.intent === 'scene');
  assert.ok(atomizer && observatory);
  assert.match(atomizer.prompt, /glass chime.*room tone.*no dialogue/is);
  assert.match(observatory.prompt, /wind.*servo whir.*thunder.*no dialogue/is);
});

test('P1 launch briefs project to reusable canonical requests without mixing single and multi-shot prompts', async () => {
  let projectBrief: ((brief: P1GenerationBrief) => CanonicalGenerationRequest) | undefined;
  try {
    const module = await import('../frontend/src/server/model-launch/p1-generation-brief');
    projectBrief = module.projectP1GenerationBriefToCanonicalRequest;
  } catch {
    // The assertion below records the RED state without hiding a module-loader failure.
  }
  assert.equal(typeof projectBrief, 'function', 'the reusable P1 brief projection should exist');

  const briefs = loadBriefs();
  const projected = briefs.map((brief) => ({ brief, request: projectBrief!(brief) }));
  for (const { brief, request } of projected) {
    assert.equal(request.outputCount, 1);
    assert.equal(request.settings.durationSec, brief.durationSec);
    assert.equal(request.settings.resolution, brief.resolution);
    assert.equal(request.settings.aspectRatio, brief.aspectRatio);
    assert.deepEqual(request.references, []);
  }

  const multishot = projected.find(({ brief }) => brief.intent === 'multishot');
  assert.ok(multishot?.brief.multiPrompt);
  assert.equal(multishot.request.prompt, '');
  assert.deepEqual(multishot.request.settings.multiPrompt, multishot.brief.multiPrompt);
  assert.equal(multishot.request.settings.multiPrompt.length, 3);
  assert.notEqual(multishot.request.prompt, multishot.brief.prompt, 'the editorial summary is never sent with multiPrompt');

  for (const item of projected.filter(({ brief }) => brief.intent !== 'multishot')) {
    assert.equal(item.request.prompt, item.brief.prompt);
    assert.equal('multiPrompt' in item.request.settings, false);
  }
  assert.ok(projected.filter(({ brief }) => brief.modelId === 'gemini-omni-flash')
    .every(({ request }) => request.settings.audio === true));
  assert.ok(projected.filter(({ brief }) => brief.modelId === 'minimax-h3-max')
    .every(({ request }) => request.settings.promptExpansionMode === 'quality'));
  assert.ok(projected.filter(({ brief }) => brief.modelId !== 'gemini-omni-flash')
    .every(({ request }) => !Object.hasOwn(request.settings, 'audio')));
});

test('P1 launch prompts are original concepts without public-figure, trademark, IP, or text dependencies', () => {
  const briefs = loadBriefs();
  const promptHashes = briefs.map((brief) => sha256(normalizePrompt(brief.prompt)));
  assert.equal(new Set(promptHashes).size, 8, 'top-level prompt hashes must be unique');

  const colorBlindHashes = briefs.map((brief) => sha256(withoutColorWords(brief.prompt)));
  assert.equal(new Set(colorBlindHashes).size, 8, 'prompts must not be color-swapped duplicates');

  for (let left = 0; left < briefs.length; left += 1) {
    for (let right = left + 1; right < briefs.length; right += 1) {
      assert.ok(
        jaccardSimilarity(contentTokens(briefs[left]!.prompt), contentTokens(briefs[right]!.prompt)) < 0.4,
        `briefs ${left + 1} and ${right + 1} are too similar`,
      );
    }
  }

  const allPromptStrings = briefs.flatMap((brief) => [
    brief.prompt,
    ...(brief.multiPrompt?.map((shot) => shot.prompt) ?? []),
  ]);
  assert.deepEqual(
    allPromptStrings.map((prompt) => sha256(prompt)),
    REVIEWED_PROMPT_HASHES,
    'every reviewed prompt and sub-prompt hash must remain frozen',
  );
  assert.equal(
    new Set(allPromptStrings.map((prompt) => sha256(normalizePrompt(prompt)))).size,
    allPromptStrings.length,
    'every editorial and shot prompt should be unique',
  );

  // This is a bounded high-risk denylist; frozen hashes retain the human review
  // boundary instead of pretending a regex can identify every person or mark.
  const forbiddenDependency = /\b(?:celebrity|public figure|famous (?:actor|athlete|singer|politician)|president|royal family|superstar|likeness of|in the style of|mona lisa|marvel|dc comics|disney|pixar|star wars|pokemon|barbie|batman|superman|mickey mouse|harry potter|jurassic park|nike|adidas|coca[ -]?cola|pepsi|iphone|samsung|tesla|ferrari|lego|nintendo|playstation|xbox|netflix|spotify|youtube|tiktok|google|amazon|meta|openai|chanel|gucci|rolex|mcdonald'?s|starbucks|logo|wordmark|slogan|caption|on[ -]?screen text|readable text|typography)\b/i;
  for (const prompt of allPromptStrings) {
    assert.doesNotMatch(prompt, forbiddenDependency);
    assert.doesNotMatch(prompt, /\b(?:speaks?|says?|voiceover|spoken words|conversation)\b/i);
  }
});
