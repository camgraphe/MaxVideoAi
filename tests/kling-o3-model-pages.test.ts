import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { MARKETING_MODEL_SLUGS, MARKETING_NAV_COMPARE } from '../frontend/config/navigation.ts';
import {
  getExampleFamilyCurrentModelSlugs,
  getExampleFamilyDescriptor,
  getExampleFamilyModelSlugs,
  getExampleFamilyPrimaryModelSlug,
} from '../frontend/lib/model-families.ts';
import { buildModelDecisionDataFromContent } from './helpers/model-decision-content.ts';
import { PREFERRED_MEDIA } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

const ROOT = process.cwd();
const LOCALES = ['en', 'fr', 'es'] as const;
const KLING_O3_V2V_SLUGS = ['kling-o3-standard', 'kling-o3-pro'] as const;
const KLING_O3_MODEL_SLUGS = ['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k'] as const;
const KLING_O3_RENDER_PAIRS = {
  'kling-o3-standard': {
    hero: 'job_8836b967-bd47-49ed-8165-980611093802',
    demo: 'job_b19833a3-0c69-4738-b825-87964d165da5',
  },
  'kling-o3-pro': {
    hero: 'job_4975d7d3-7b53-480e-8d48-b88c4ce6902c',
    demo: 'job_683201ab-b96a-4f54-9bb4-2907f9d0dc27',
  },
  'kling-o3-4k': {
    hero: 'job_8af463de-b0e7-4b67-b791-b9687ca90a63',
    demo: 'job_80b9d956-88c7-467b-97e3-a7bb71aa9294',
  },
} as const;

function getEngine(slug: string) {
  const engine = listFalEngines().find((candidate) => candidate.id === slug || candidate.modelSlug === slug);
  assert.ok(engine, `Missing engine ${slug}`);
  return engine;
}

function readModelContent(locale: (typeof LOCALES)[number], slug: string) {
  const raw = readFileSync(join(ROOT, 'content', 'models', locale, `${slug}.json`), 'utf8');
  return {
    raw,
    text: JSON.stringify(JSON.parse(raw)),
  };
}

function hasInputField(engine: ReturnType<typeof getEngine>, fieldId: string) {
  const schema = engine.engine.inputSchema;
  return [...(schema?.required ?? []), ...(schema?.optional ?? [])].find((field) => field.id === fieldId);
}

test('Kling 3.0 Omni model prompt lab uses route-specific O3 prompt structures', () => {
  const componentSource = readFileSync(
    join(
      ROOT,
      'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection.tsx'
    ),
    'utf8'
  );
  const legacySource = readFileSync(
    join(
      ROOT,
      'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-legacy.ts'
    ),
    'utf8'
  );

  assert.match(legacySource, /getKlingO3PromptingTabs/);
  assert.match(legacySource, /const tabs = copy\.promptingTabs\.length[\s\S]+getKlingO3PromptingTabs\(locale, engineId\)/);
  assert.match(componentSource, /tabs=\{promptingTabs\}/);
  assert.match(legacySource, /Refs \+ V2V|V2V draft|@Video1/);
  assert.match(legacySource, /keep_audio/);
  assert.match(legacySource, /Final 4K|native 4K|4K native/);
  assert.match(legacySource, /Do not use @Video1|N’utilise pas @Video1|No usar @Video1/);
  assert.match(componentSource, /promptingGlobalPrinciples\.map/);
  assert.match(componentSource, /promptingEngineWhy\.map/);
});

test('Kling 3.0 Omni model pages pin the rendered Camp Graph media pairs', () => {
  for (const slug of KLING_O3_MODEL_SLUGS) {
    assert.deepEqual(PREFERRED_MEDIA[slug], KLING_O3_RENDER_PAIRS[slug]);
  }

  const promptLabSource = readFileSync(
    join(
      ROOT,
      'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-legacy.ts'
    ),
    'utf8'
  );

  assert.match(promptLabSource, /giant origami whale/i);
  assert.match(promptLabSource, /tiny lighthouse keeper/i);
  assert.match(promptLabSource, /handmade mechanical moon/i);
  const componentSource = readFileSync(
    join(
      ROOT,
      'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection.tsx'
    ),
    'utf8'
  );
  assert.match(componentSource, /demoMedia\?\.hasAudio \? ui\.audioOn : ui\.audioOff/);
});

test('Kling 3.0 Omni model pages use the current decision-page template', () => {
  for (const slug of KLING_O3_MODEL_SLUGS) {
    const engine = getEngine(slug);
    const template = getModelPageTemplateConfig(slug);

    assert.ok(template, `${slug} should be registered in the model-page template registry`);
    assert.equal(template.slug, slug);

    for (const locale of LOCALES) {
      const decisionData = buildModelDecisionDataFromContent({ engine, locale });
      assert.ok(decisionData, `${slug}/${locale} should have localized decision-page copy`);
      assert.match(decisionData.hero.title, /Kling 3\.0 Omni/i);
      assert.ok(decisionData.pricing.scenarios.length >= 3, `${slug}/${locale} should expose modern pricing cards`);
      assert.ok(decisionData.decisionCards.length >= 3, `${slug}/${locale} should expose decision cards`);
    }
  }
});

test('Kling 3.0 Omni Standard and Pro model pages expose source-video V2V distinctly from references', () => {
  for (const slug of KLING_O3_V2V_SLUGS) {
    const engine = getEngine(slug);

    assert.ok(engine.modes.some((mode) => mode.mode === 'v2v'), `${slug} should expose v2v in the catalog`);
    assert.equal(engine.type, 'textImageReferenceVideoEdit');
    assert.ok(hasInputField(engine, 'video_url'), `${slug} should expose source video input`);
    assert.ok(hasInputField(engine, 'keep_audio'), `${slug} should expose keep_audio for v2v`);

    for (const locale of LOCALES) {
      const { text } = readModelContent(locale, slug);
      assert.match(text, /video-to-video|V2V/i, `${slug}/${locale} should mention the V2V workflow`);
      assert.match(text, /source video|source-video|vid[eé]o source|video fuente/i, `${slug}/${locale} should mention source video input`);
      assert.match(text, /@Video1/i, `${slug}/${locale} should tell users how to reference the source clip`);
      assert.match(text, /keep_audio|Keep source audio|conserver l.audio|mantener el audio/i, `${slug}/${locale} should mention keep-audio behavior`);
      assert.match(text, /@Image1/i, `${slug}/${locale} should keep the reference-image workflow visible`);
      assert.match(text, /Kling 3(?:\.0)? (?:Pro|Standard)|start[- ]frame/i, `${slug}/${locale} should contrast against Kling V3 start-frame routes`);
    }
  }
});

test('Kling 3.0 Omni 4K stays reference-first and does not claim source-video V2V', () => {
  const engine = getEngine('kling-o3-4k');

  assert.deepEqual(
    engine.modes.map((mode) => mode.mode),
    ['t2v', 'i2v', 'ref2v']
  );
  assert.equal(engine.type, 'textImageReference');
  assert.equal(hasInputField(engine, 'video_url'), undefined);
  assert.equal(hasInputField(engine, 'keep_audio'), undefined);
  assert.doesNotMatch(engine.seo.title, /video-to-video|V2V/i);
  assert.doesNotMatch(engine.seo.description, /video-to-video|V2V/i);

  for (const locale of LOCALES) {
    const { text } = readModelContent(locale, 'kling-o3-4k');
    assert.match(text, /4K/i, `kling-o3-4k/${locale} should keep native 4K positioning`);
    assert.match(text, /@Image1/i, `kling-o3-4k/${locale} should expose reference image anchors`);
    assert.match(text, /not.*video-to-video|pas.*video-to-video|sin.*video-to-video|no.*V2V/i, `kling-o3-4k/${locale} should state that source-video V2V is not the 4K route`);
  }
});

test('Kling V3 model pages keep start-frame positioning instead of cannibalizing O3 V2V', () => {
  for (const slug of ['kling-3-standard', 'kling-3-pro', 'kling-3-4k']) {
    const engine = getEngine(slug);

    assert.ok(!engine.modes.some((mode) => mode.mode === 'ref2v' || mode.mode === 'v2v'), `${slug} should not expose O3 reference modes`);
    assert.equal(hasInputField(engine, 'video_url'), undefined);
    assert.equal(hasInputField(engine, 'keep_audio'), undefined);

    for (const locale of LOCALES) {
      const { text } = readModelContent(locale, slug);
      assert.match(text, /start[- ]frame|image-to-video|image.vid[eé]o|imagen a video/i, `${slug}/${locale} should own start-frame intent`);
      assert.doesNotMatch(text, /@Video1|keep_audio|source-video V2V|video-to-video source/i, `${slug}/${locale} should not claim O3 source-video V2V`);
    }
  }
});

test('Kling marketing family and navigation are O3-first without dropping Kling V3 support', () => {
  const descriptor = getExampleFamilyDescriptor('kling-o3-pro');
  assert.ok(descriptor);
  assert.equal(descriptor.id, 'kling');
  assert.equal(descriptor.navLabel, 'Kling 3.0 Omni');
  assert.equal(descriptor.defaultModelSlug, 'kling-o3-pro');
  assert.equal(getExampleFamilyPrimaryModelSlug('kling'), 'kling-o3-pro');

  assert.deepEqual(getExampleFamilyCurrentModelSlugs('kling'), [
    'kling-o3-pro',
    'kling-o3-standard',
    'kling-o3-4k',
    'kling-3-pro',
    'kling-3-standard',
    'kling-3-4k',
  ]);
  assert.deepEqual(getExampleFamilyModelSlugs('kling').slice(0, 8), [
    'kling-o3-pro',
    'kling-o3-standard',
    'kling-o3-4k',
    'kling-3-pro',
    'kling-3-standard',
    'kling-3-4k',
    'kling-2-6-pro',
    'kling-2-5-turbo',
  ]);

  assert.ok(MARKETING_MODEL_SLUGS.includes('kling-o3-pro'));
  assert.ok(MARKETING_MODEL_SLUGS.includes('kling-o3-4k'));
  assert.ok(!MARKETING_MODEL_SLUGS.includes('kling-3-pro'));
  assert.ok(MARKETING_NAV_COMPARE.some((item) => item.key === 'kling-3-pro-vs-kling-o3-pro'));
});
