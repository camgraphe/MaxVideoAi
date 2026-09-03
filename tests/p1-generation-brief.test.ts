import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { GEMINI_OMNI_FLASH_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/gemini-omni-flash';
import { KLING_3_TURBO_PRO_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-pro';
import { KLING_3_TURBO_STANDARD_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-standard';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
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
  intent: Intent;
  multiPrompt?: MultiPromptShot[];
};

const modelContracts: Record<ModelId, {
  engine: EngineCaps;
  executableModes: readonly string[];
  defaultResolution: string;
}> = {
  'gemini-omni-flash': {
    engine: GEMINI_OMNI_FLASH_FAL_ENGINE_REGISTRY[0]!.engine,
    executableModes: ['t2v'],
    defaultResolution: '720p',
  },
  'kling-3-turbo-standard': {
    engine: KLING_3_TURBO_STANDARD_ENGINE,
    executableModes: ['t2v'],
    defaultResolution: '720p',
  },
  'kling-3-turbo-pro': {
    engine: KLING_3_TURBO_PRO_ENGINE,
    executableModes: ['t2v'],
    defaultResolution: '1080p',
  },
  'minimax-h3-max': {
    engine: MINIMAX_H3_MAX_ENGINE,
    executableModes: ['t2v'],
    defaultResolution: '768P',
  },
};

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

    const duration = inputField(contract.engine, 'duration', brief.mode);
    const durationOptions = (duration?.values ?? []).map((value) => Number(String(value).replace(/s$/i, '')));
    assert.ok(durationOptions.includes(brief.durationSec), `${brief.modelId}:${brief.durationSec}s is unsupported`);

    const aspectRatio = inputField(contract.engine, 'aspect_ratio', brief.mode);
    assert.ok(aspectRatio?.values?.includes(brief.aspectRatio), `${brief.modelId}:${brief.aspectRatio} is unsupported`);
    assert.ok(
      brief.prompt.length <= (contract.engine.inputLimits?.promptMaxChars ?? Number.POSITIVE_INFINITY),
      `${brief.modelId} prompt exceeds its local limit`,
    );

    const resolution = inputField(contract.engine, 'resolution', brief.mode)?.default
      ?? contract.engine.resolutions[0];
    assert.equal(resolution, contract.defaultResolution, `${brief.modelId} draft resolution changed`);

    const keys = Object.keys(brief).sort();
    const expectedKeys = [
      'aspectRatio', 'durationSec', 'intent', 'mode', 'modelId', 'prompt',
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
    assert.match(
      brief.prompt,
      /\b(?:anonymous|unidentifiable|face (?:always )?(?:hidden|obscured|out of frame|never visible)|seen from behind|shoulders down)\b/i,
      `${brief.modelId} human concept must prevent a recognizable face`,
    );
  }

  const multishotBriefs = briefs.filter((brief) => brief.multiPrompt !== undefined);
  assert.equal(multishotBriefs.length, 1, 'exactly one launch brief should exercise structured multishot');
  const [multishot] = multishotBriefs;
  assert.ok(multishot);
  assert.equal(multishot.intent, 'multishot');
  assert.match(multishot.modelId, /^kling-3-turbo-(?:standard|pro)$/);
  assert.equal(multishot.mode, 't2v');
  assert.ok(multishot.multiPrompt!.length >= 1 && multishot.multiPrompt!.length <= 6);
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
  assert.equal(
    new Set(allPromptStrings.map((prompt) => sha256(normalizePrompt(prompt)))).size,
    allPromptStrings.length,
    'every editorial and shot prompt should be unique',
  );

  const forbiddenDependency = /\b(?:celebrity|public figure|famous (?:actor|athlete|singer|politician)|likeness of|in the style of|marvel|disney|pixar|star wars|pokemon|barbie|nike|adidas|coca[ -]?cola|pepsi|iphone|samsung|tesla|ferrari|lego|netflix|spotify|logo|wordmark|slogan|caption|on[ -]?screen text|readable text|typography)\b/i;
  for (const prompt of allPromptStrings) {
    assert.doesNotMatch(prompt, forbiddenDependency);
  }
});
