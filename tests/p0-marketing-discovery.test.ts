import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import * as familyConfig from '../frontend/config/model-families.ts';
import * as launchReadiness from '../frontend/config/model-launch-readiness.ts';
import { MODEL_LAUNCH_WAVES } from '../frontend/config/model-launch-waves.ts';
import { listRuntimeModels, type RuntimeModelEntry } from '../frontend/config/model-runtime.ts';
import * as launchAssets from '../frontend/server/model-launch-assets-validation.ts';
import * as navigation from '../frontend/config/navigation.ts';
import * as homepageExamples from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples.ts';
import {
  buildDefaultModelCompareHref,
  buildModelsCatalogDecisionData,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts';
import type { ModelGalleryCard } from '../frontend/components/marketing/ModelsGallery.tsx';
import * as modelLandingData from '../frontend/lib/examples/modelLandingData.ts';
import * as modelCatalog from '../frontend/lib/models/catalog.ts';
import * as modelFamilies from '../frontend/lib/model-families.ts';
import type { GalleryVideo } from '../frontend/server/videos-normalization.ts';

const P0_IDS = [
  'wan-3',
  'wan-3-prime',
  'ltx-2-5-fast',
  'ltx-2-5-pro',
  'grok-imagine-video-1-5',
  'flux-3',
  'flux-3-draft',
] as const;

const P0_MENU_REPRESENTATIVES = [
  'ltx-2-5-pro',
  'wan-3-prime',
  'grok-imagine-video-1-5',
  'flux-3',
] as const;
const P0_BOUNDED_NAV_MENU_ENTRIES = [
  'ltx-2-5-pro',
  'wan-3',
  'wan-3-prime',
  'grok-imagine-video-1-5',
] as const;

function configuredLaunchSources(
  overrides: Partial<launchAssets.ModelLaunchSourceByWave> = {},
): launchAssets.ModelLaunchSourceByWave {
  return Object.fromEntries(MODEL_LAUNCH_WAVES.map((wave) => [
    wave.id,
    wave.id in overrides
      ? overrides[wave.id]
      : existsSync(wave.sourceManifest) ? readFileSync(wave.sourceManifest, 'utf8') : null,
  ])) as launchAssets.ModelLaunchSourceByWave;
}

const FAMILY_RANKS: Readonly<Record<(typeof P0_IDS)[number], number>> = {
  'wan-3-prime': 0,
  'wan-3': 1,
  'ltx-2-5-pro': 0,
  'ltx-2-5-fast': 1,
  'grok-imagine-video-1-5': 0,
  'flux-3': 0,
  'flux-3-draft': 1,
};

type AcceptedAsset = {
  assetId: string;
  videoId: string;
  modelId: string;
  engineId: string;
  familyId: 'wan' | 'ltx' | 'grok' | 'flux';
  libraryAssetId: string;
  jobId: string;
  mode: string;
  prompt: string;
  sourceKind: 'text' | 'image' | 'video' | 'references';
  sourceAssetIds: readonly string[];
  videoUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  durationSec: number;
  acceptedAt: string;
  reviewStatus: 'accepted';
  publicationState: 'gallery_only';
  watchPageCandidate: false;
  familyPlaylistId: string;
  modelPlaylistId: string;
  playlistSlugs: readonly string[];
};

function publishedFixture(): RuntimeModelEntry[] {
  const p0 = new Set<string>(P0_IDS);
  return listRuntimeModels().map((model) => {
    if (!p0.has(model.id)) return structuredClone(model);
    const rank = FAMILY_RANKS[model.id as (typeof P0_IDS)[number]];
    return {
      ...structuredClone(model),
      publication: {
        ...structuredClone(model.publication),
        model: { published: true, indexable: true },
        examples: {
          published: true,
          includeInFamilyCopy: true,
          current: true,
          familyRank: rank,
        },
        sitemap: { published: true },
      },
    };
  });
}

function acceptedAssets(): AcceptedAsset[] {
  const familyByModelId: Record<(typeof P0_IDS)[number], AcceptedAsset['familyId']> = {
    'wan-3': 'wan',
    'wan-3-prime': 'wan',
    'ltx-2-5-fast': 'ltx',
    'ltx-2-5-pro': 'ltx',
    'grok-imagine-video-1-5': 'grok',
    'flux-3': 'flux',
    'flux-3-draft': 'flux',
  };
  return P0_IDS.map((modelId, index) => ({
    assetId: `job_p0_accepted_${index + 1}`,
    videoId: `video_p0_accepted_${index + 1}`,
    modelId,
    engineId: modelId,
    familyId: familyByModelId[modelId],
    libraryAssetId: `library_p0_accepted_${index + 1}`,
    jobId: `job_p0_accepted_${index + 1}`,
    mode: 't2v',
    prompt: `A controlled motion study for ${modelId}`,
    sourceKind: 'text',
    sourceAssetIds: [],
    videoUrl: `https://media.maxvideoai.com/renders/p0/${modelId}.mp4`,
    thumbnailUrl: `https://media.maxvideoai.com/rendersthumbs/p0/${modelId}.webp`,
    width: 1280,
    height: 720,
    durationSec: 6,
    acceptedAt: '2026-09-01T12:00:00.000Z',
    reviewStatus: 'accepted',
    publicationState: 'gallery_only',
    watchPageCandidate: false,
    familyPlaylistId: `playlist_family_${familyByModelId[modelId]}`,
    modelPlaylistId: `playlist_model_${modelId}`,
    playlistSlugs: [`family-${familyByModelId[modelId]}`, `examples-${modelId}`],
  }));
}

function readinessFixture(): launchReadiness.ModelLaunchReadinessEntry[] {
  const result = launchAssets.validateP0VideoExamplePackDocument({
    schemaVersion: 1,
    assets: completeAcceptedPackAssets(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return [];
  return launchAssets.createModelLaunchReadinessProjection({
    sourceDigest: 'a'.repeat(64),
    assets: result.assets,
  }).models;
}

function galleryVideo({
  id,
  engineId,
  aspectRatio = '16:9',
}: {
  id: string;
  engineId: string;
  aspectRatio?: string;
}): GalleryVideo {
  return {
    id,
    userId: null,
    engineId,
    engineLabel: engineId,
    durationSec: 6,
    prompt: `Public example for ${engineId}`,
    promptExcerpt: `Public example for ${engineId}`,
    thumbUrl: `https://media.maxvideoai.com/rendersthumbs/public/${id}.webp`,
    videoUrl: `https://media.maxvideoai.com/renders/public/${id}.mp4`,
    aspectRatio,
    createdAt: '2026-09-01T12:00:00.000Z',
    visibility: 'public',
    indexable: true,
    hasAudio: true,
    canUpscale: false,
  };
}

function acceptedPublicLaunchVideos({ mixed = false }: { mixed?: boolean } = {}): Map<string, GalleryVideo[]> {
  const pack = completeAcceptedPackAssets();
  return new Map(P0_MENU_REPRESENTATIVES.map((modelId) => {
    const accepted = pack.find((asset) => asset.modelId === modelId && asset.mode === 't2v');
    assert.ok(accepted, modelId);
    const exact = galleryVideo({ id: accepted.videoId, engineId: modelId, aspectRatio: mixed ? '4:3' : '16:9' });
    const unrelated = galleryVideo({ id: `unrelated-${modelId}`, engineId: modelId, aspectRatio: '16:9' });
    return [modelId, mixed ? [unrelated, exact] : [exact]];
  }));
}

function unrelatedPublicLaunchVideos(): Map<string, GalleryVideo[]> {
  return new Map(P0_MENU_REPRESENTATIVES.map((modelId) => [modelId, [
    galleryVideo({ id: `unrelated-${modelId}`, engineId: modelId }),
  ]]));
}

function completeAcceptedPackAssets(): AcceptedAsset[] {
  return acceptedAssets().flatMap((asset) => [
    asset,
    {
      ...asset,
      assetId: `${asset.assetId}_second`,
      videoId: `${asset.videoId}_second`,
      libraryAssetId: `${asset.libraryAssetId}_second`,
      jobId: `${asset.jobId}_second`,
      mode: 'i2v',
      sourceKind: 'image',
      sourceAssetIds: [`source_image_${asset.modelId}`],
      videoUrl: asset.videoUrl.replace('.mp4', '-second.mp4'),
      thumbnailUrl: asset.thumbnailUrl.replace('.webp', '-second.webp'),
    },
  ]);
}

test('a durable-looking URL pair is not Task 12 accepted launch evidence', () => {
  assert.equal(launchAssets.isAcceptedDurableModelAsset({
    assetId: 'manual-url-pair',
    modelId: 'flux-3',
    videoUrl: 'https://media.maxvideoai.com/renders/p0/flux-3.mp4',
    thumbnailUrl: 'https://media.maxvideoai.com/rendersthumbs/p0/flux-3.webp',
    acceptedAt: '2026-09-01T12:00:00.000Z',
  } as unknown as AcceptedAsset), false);
  assert.equal(launchAssets.isAcceptedDurableModelAsset(acceptedAssets()[0]), true);
});

test('the Task 12 pack is complete, unique and exact before it can project launch evidence', () => {
  const validatePack = launchAssets.validateP0VideoExamplePackDocument;
  const complete = completeAcceptedPackAssets();
  assert.equal(validatePack({ schemaVersion: 1, assets: [] }).ok, false);
  assert.equal(validatePack({ schemaVersion: 1, assets: complete.slice(0, -1) }).ok, false);
  assert.equal(validatePack({ schemaVersion: 1, assets: complete }).ok, true);

  for (const field of ['assetId', 'videoId', 'libraryAssetId', 'jobId'] as const) {
    const duplicated = structuredClone(complete);
    duplicated[1][field] = duplicated[0][field];
    assert.equal(validatePack({ schemaVersion: 1, assets: duplicated }).ok, false, field);
  }
});

test('Task 12 evidence modes and source attachments follow each canonical Fal input schema', () => {
  const validatePack = launchAssets.validateP0VideoExamplePackDocument;
  const complete = completeAcceptedPackAssets();

  const invalidMode = structuredClone(complete);
  invalidMode[0].mode = 'totally-invalid';
  assert.equal(validatePack({ schemaVersion: 1, assets: invalidMode }).ok, false);

  const unsupportedModelMode = structuredClone(complete);
  unsupportedModelMode[0].mode = 'fl2v';
  unsupportedModelMode[0].sourceKind = 'image';
  unsupportedModelMode[0].sourceAssetIds = ['source_start', 'source_end'];
  assert.equal(validatePack({ schemaVersion: 1, assets: unsupportedModelMode }).ok, false);

  const wrongImageKind = structuredClone(complete);
  wrongImageKind[1].sourceKind = 'video';
  assert.equal(validatePack({ schemaVersion: 1, assets: wrongImageKind }).ok, false);

  const wrongImageCount = structuredClone(complete);
  wrongImageCount[1].sourceAssetIds = ['source_image_one', 'source_image_two'];
  assert.equal(validatePack({ schemaVersion: 1, assets: wrongImageCount }).ok, false);

  const textWithSource = structuredClone(complete);
  textWithSource[0].sourceAssetIds = ['source_image_for_text_mode'];
  assert.equal(validatePack({ schemaVersion: 1, assets: textWithSource }).ok, false);

  const prematureSeoClaim = structuredClone(complete) as Array<AcceptedAsset & { watchPageCandidate: boolean }>;
  prematureSeoClaim[0].watchPageCandidate = true;
  assert.equal(validatePack({ schemaVersion: 1, assets: prematureSeoClaim }).ok, false);
});

test('full Task 12 evidence stays server-only and projection freshness is release-gated', () => {
  const sharedFamilySource = readFileSync('frontend/config/model-families.ts', 'utf8');
  const sharedReadinessSource = readFileSync('frontend/config/model-launch-readiness.ts', 'utf8');
  const packageScripts = (JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  }).scripts;

  assert.doesNotMatch(sharedFamilySource, /ACCEPTED_DURABLE_MODEL_ASSETS|model-launch-assets\.generated/);
  assert.doesNotMatch(sharedReadinessSource, /model-launch-assets\.generated|jobId|libraryAssetId|reviewStatus|videoUrl/);
  const serverAssetOwner = readFileSync('frontend/server/model-launch-assets.ts', 'utf8');
  assert.match(serverAssetOwner, /import ['"]server-only['"]/);
  assert.match(serverAssetOwner, /model-launch-assets\.generated/);
  assert.match(packageScripts['audit:premerge'], /model:launch-assets:check/);
  assert.match(packageScripts['vercel-build'], /model:launch-assets:check/);

  const visited = new Set<string>();
  const queue = [
    resolve('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_components/CompareEngineFamilySelect.client.tsx'),
  ];
  while (queue.length) {
    const file = queue.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+|@\/[^'"]+)['"]/g)) {
      const base = match[1].startsWith('@/')
        ? resolve('frontend', match[1].slice(2))
        : resolve(dirname(file), match[1]);
      const dependency = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, resolve(base, 'index.ts')].find(existsSync);
      if (dependency) queue.push(dependency);
    }
  }
  const clientGraph = [...visited].map((file) => readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(clientGraph, /model-launch-assets\.generated|ACCEPTED_DURABLE_MODEL_ASSETS|libraryAssetId|reviewStatus/);
});

test('test validation compares both launch projections with source and detects isolated corruption', () => {
  const fullProjectionPath = 'frontend/server/model-launch-assets.generated.json';
  const readinessProjectionPath = 'frontend/config/model-launch-readiness.generated.json';
  const sources = configuredLaunchSources();
  const expected = launchAssets.buildModelLaunchProjectionsFromSources(sources);
  const generatedFull = JSON.parse(readFileSync(fullProjectionPath, 'utf8')) as unknown;
  const generatedReadiness = JSON.parse(readFileSync(readinessProjectionPath, 'utf8')) as unknown;
  assert.deepEqual(generatedFull, expected.full);
  assert.deepEqual(generatedReadiness, expected.readiness);
  assert.deepEqual(launchAssets.checkModelLaunchProjectionFreshness({ sources, full: generatedFull, readiness: generatedReadiness }), {
    ok: true,
    stale: [],
  });

  const fixtureDirectory = mkdtempSync(resolve(tmpdir(), 'maxvideoai-launch-assets-'));
  try {
    const validSource = `${JSON.stringify({ schemaVersion: 1, assets: completeAcceptedPackAssets() }, null, 2)}\n`;
    const validSources = configuredLaunchSources({ p0: validSource });
    const valid = launchAssets.buildModelLaunchProjectionsFromSources(validSources);
    const temporarySourcePath = resolve(fixtureDirectory, 'source.json');
    const temporaryFullPath = resolve(fixtureDirectory, 'full.json');
    const temporaryReadinessPath = resolve(fixtureDirectory, 'readiness.json');
    writeFileSync(temporarySourcePath, validSource, 'utf8');
    writeFileSync(temporaryFullPath, `${JSON.stringify(valid.full, null, 2)}\n`, 'utf8');
    writeFileSync(temporaryReadinessPath, `${JSON.stringify(valid.readiness, null, 2)}\n`, 'utf8');

    const corruptedFull = structuredClone(valid.full);
    corruptedFull.assets = corruptedFull.assets.slice(1);
    writeFileSync(temporaryFullPath, `${JSON.stringify(corruptedFull, null, 2)}\n`, 'utf8');
    assert.deepEqual(launchAssets.checkModelLaunchProjectionFreshness({
      sources: { ...validSources, p0: readFileSync(temporarySourcePath, 'utf8') },
      full: JSON.parse(readFileSync(temporaryFullPath, 'utf8')),
      readiness: JSON.parse(readFileSync(temporaryReadinessPath, 'utf8')),
    }), { ok: false, stale: ['full'] });

    writeFileSync(temporaryFullPath, `${JSON.stringify(valid.full, null, 2)}\n`, 'utf8');
    const corruptedReadiness = structuredClone(valid.readiness);
    const p0Readiness = corruptedReadiness.waves.find(({ waveId }) => waveId === 'p0');
    assert.ok(p0Readiness);
    p0Readiness.sourceDigest = '0'.repeat(64);
    writeFileSync(temporaryReadinessPath, `${JSON.stringify(corruptedReadiness, null, 2)}\n`, 'utf8');
    assert.deepEqual(launchAssets.checkModelLaunchProjectionFreshness({
      sources: { ...validSources, p0: readFileSync(temporarySourcePath, 'utf8') },
      full: JSON.parse(readFileSync(temporaryFullPath, 'utf8')),
      readiness: JSON.parse(readFileSync(temporaryReadinessPath, 'utf8')),
    }), { ok: false, stale: ['readiness'] });
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test('published P0 identities enter public discovery with the two promoted Wan variants', () => {
  const runtime = listRuntimeModels();
  const selectCatalogSlugs = (
    modelCatalog as typeof modelCatalog & {
      selectCurrentModelCatalogSlugs?: (models: readonly RuntimeModelEntry[]) => string[];
    }
  ).selectCurrentModelCatalogSlugs;

  assert.equal(typeof selectCatalogSlugs, 'function');
  if (!selectCatalogSlugs) return;

  const catalogSlugs = selectCatalogSlugs(runtime);
  assert.deepEqual(
    navigation.MARKETING_MODEL_SLUGS.filter((slug) => P0_IDS.includes(slug as never)),
    P0_BOUNDED_NAV_MENU_ENTRIES,
  );
  assert.deepEqual(navigation.MARKETING_NAV_EXAMPLES.map(({ key }) => key), navigation.MARKETING_FOOTER_EXAMPLES.map(({ key }) => key));
  assert.equal(navigation.MARKETING_NAV_EXAMPLES.some(({ key }) => key === 'grok'), true);
  assert.equal(navigation.MARKETING_NAV_EXAMPLES.some(({ key }) => key === 'flux'), true);
  assert.deepEqual(
    catalogSlugs.filter((slug) => P0_IDS.includes(slug as never)).sort(),
    [...P0_IDS].sort(),
  );
  assert.equal(catalogSlugs.includes('ltx-2'), false);
  assert.equal(catalogSlugs.includes('ltx-2-fast'), false);
  assert.equal(catalogSlugs.includes('wan-2-5'), false);
  assert.equal(modelFamilies.resolveExampleFamilyId('grok'), 'grok');
  assert.equal(modelFamilies.resolveExampleFamilyId('flux'), 'flux');
  for (const modelId of P0_IDS) {
    assert.equal(buildDefaultModelCompareHref(modelId), null, `${modelId} must not invent a generic comparison route`);
  }
});

test('a published fixture keeps the menu bounded while exposing both promoted Wan variants', () => {
  const buildMarketingModelMenu = (
    navigation as typeof navigation & {
      buildMarketingModelMenu?: (models: readonly RuntimeModelEntry[]) => Array<{ slug: string }>;
    }
  ).buildMarketingModelMenu;

  assert.equal(typeof buildMarketingModelMenu, 'function');
  if (!buildMarketingModelMenu) return;

  const menu = buildMarketingModelMenu(publishedFixture());
  assert.ok(menu.length <= 11);
  assert.deepEqual(
    menu.map(({ slug }) => slug).filter((slug) => P0_IDS.includes(slug as never)),
    P0_BOUNDED_NAV_MENU_ENTRIES,
  );
});

test('published current discovery contains all seven P0 cards before legacy and never deep legacy', () => {
  const selectCatalogSlugs = (
    modelCatalog as typeof modelCatalog & {
      selectCurrentModelCatalogSlugs?: (models: readonly RuntimeModelEntry[]) => string[];
    }
  ).selectCurrentModelCatalogSlugs;

  assert.equal(typeof selectCatalogSlugs, 'function');
  if (!selectCatalogSlugs) return;

  const slugs = selectCatalogSlugs(publishedFixture());
  const fixtureBySlug = new Map(publishedFixture().map((model) => [model.slug, model]));
  const firstLegacyIndex = slugs.findIndex((slug) => fixtureBySlug.get(slug)?.lifecycle === 'legacy');
  const lastCurrentIndex = slugs.findLastIndex((slug) => fixtureBySlug.get(slug)?.lifecycle === 'current');
  assert.ok(firstLegacyIndex === -1 || lastCurrentIndex < firstLegacyIndex, 'all current cards must precede legacy cards');
  for (const slug of P0_IDS) assert.ok(slugs.includes(slug), slug);
  assert.ok(slugs.indexOf('ltx-2-5-pro') < slugs.indexOf('ltx-2-3-pro'));
  assert.ok(slugs.indexOf('ltx-2-5-fast') < slugs.indexOf('ltx-2-3-fast'));
  assert.ok(slugs.indexOf('wan-3-prime') < slugs.indexOf('wan-2-6'));
  assert.ok(slugs.indexOf('wan-3') < slugs.indexOf('wan-2-6'));
  for (const deepLegacy of ['ltx-2', 'ltx-2-fast', 'wan-2-5']) {
    assert.equal(slugs.includes(deepLegacy), false, deepLegacy);
  }
});

test('published P0 cards enter curated picks without creating unauthored comparison links', () => {
  const cards = P0_IDS.map((id) => ({
    id,
    label: id,
    href: { pathname: '/models/[slug]', params: { slug: id } },
    overallScore: null,
  })) as unknown as ModelGalleryCard[];
  const decision = buildModelsCatalogDecisionData({ activeLocale: 'en', cards });

  assert.deepEqual(
    decision.topPicks.map(({ id }) => id),
    P0_MENU_REPRESENTATIVES,
  );
  assert.deepEqual(
    decision.recommendedCards.map(({ id }) => id),
    P0_IDS,
  );
  assert.deepEqual(decision.popularComparisons, []);
});

test('family routing requires both publication and named accepted durable asset evidence', () => {
  const buildFamilies = (
    familyConfig as typeof familyConfig & {
      buildModelFamilyDefinitions?: (
        models: readonly RuntimeModelEntry[],
        readiness: readonly launchReadiness.ModelLaunchReadinessEntry[],
      ) => familyConfig.ModelFamilyDefinition[];
    }
  ).buildModelFamilyDefinitions;
  const createResolver = (
    modelFamilies as typeof modelFamilies & {
      createExampleFamilyResolver?: (input: {
        families: readonly familyConfig.ModelFamilyDefinition[];
      }) => {
        resolveFamilyId: (raw: string) => string | null;
        getModelSlugs: (familyId: string) => string[];
        getCurrentModelSlugs: (familyId: string) => string[];
        getNavFamilyIds: () => string[];
      };
    }
  ).createExampleFamilyResolver;

  assert.equal(typeof buildFamilies, 'function');
  assert.equal(typeof createResolver, 'function');
  if (!buildFamilies || !createResolver) return;

  const noEvidence = createResolver({ families: buildFamilies(publishedFixture(), []) });
  assert.equal(noEvidence.resolveFamilyId('grok'), null);
  assert.equal(noEvidence.resolveFamilyId('flux'), null);

  const withEvidence = createResolver({ families: buildFamilies(publishedFixture(), readinessFixture()) });
  assert.equal(withEvidence.resolveFamilyId('grok'), 'grok');
  assert.equal(withEvidence.resolveFamilyId('flux'), 'flux');
  assert.deepEqual(withEvidence.getModelSlugs('ltx').slice(0, 4), [
    'ltx-2-5-pro',
    'ltx-2-5-fast',
    'ltx-2-3-pro',
    'ltx-2-3-fast',
  ]);
  assert.deepEqual(withEvidence.getCurrentModelSlugs('wan'), ['wan-3-prime', 'wan-3']);
  assert.deepEqual(withEvidence.getCurrentModelSlugs('ltx'), ['ltx-2-5-pro', 'ltx-2-5-fast']);
  assert.deepEqual(withEvidence.getModelSlugs('grok'), ['grok-imagine-video-1-5']);
  assert.deepEqual(withEvidence.getModelSlugs('flux'), ['flux-3', 'flux-3-draft']);
  assert.ok(withEvidence.getNavFamilyIds().includes('grok'));
  assert.ok(withEvidence.getNavFamilyIds().includes('flux'));
});

test('homepage P0 eligibility requires publication, safe readiness and exact public model-playlist media', async () => {
  const buildTargets = (
    homepageExamples as typeof homepageExamples & {
      buildHomepageP0PromotionTargets?: (input: {
        models: readonly RuntimeModelEntry[];
        readiness: readonly launchReadiness.ModelLaunchReadinessEntry[];
      }) => Array<{ family: string; modelId: string }>;
    }
  ).buildHomepageP0PromotionTargets;

  assert.equal(typeof buildTargets, 'function');
  if (!buildTargets) return;

  assert.deepEqual(
    buildTargets({ models: listRuntimeModels(), readiness: readinessFixture() }).map(({ family, modelId }) => [family, modelId]),
    [
      ['ltx', 'ltx-2-5-pro'],
      ['wan', 'wan-3-prime'],
      ['grok', 'grok-imagine-video-1-5'],
      ['flux', 'flux-3'],
    ],
  );
  assert.deepEqual(buildTargets({ models: publishedFixture(), readiness: [] }), []);
  assert.deepEqual(
    buildTargets({ models: publishedFixture(), readiness: readinessFixture() }).map(({ family, modelId }) => [family, modelId]),
    [
      ['ltx', 'ltx-2-5-pro'],
      ['wan', 'wan-3-prime'],
      ['grok', 'grok-imagine-video-1-5'],
      ['flux', 'flux-3'],
    ],
  );

  const assemble = homepageExamples.assembleHomepageExampleCards as unknown as (input: {
    locale: 'en';
    content: { examples: { fallbackCards: []; viewPrompt: string } };
    globalCandidates: [];
    familyVideos: Map<never, never>;
    modelVideos: ReturnType<typeof acceptedPublicLaunchVideos>;
    models: readonly RuntimeModelEntry[];
    readiness: readonly launchReadiness.ModelLaunchReadinessEntry[];
    acceptedAssets: readonly AcceptedAsset[];
  }) => Array<{ id: string; imageSrc: string }>;
  const cards = assemble({
    locale: 'en',
    content: { examples: { fallbackCards: [], viewPrompt: 'View prompt' } },
    globalCandidates: [],
    familyVideos: new Map(),
    modelVideos: acceptedPublicLaunchVideos(),
    models: publishedFixture(),
    readiness: readinessFixture(),
    acceptedAssets: completeAcceptedPackAssets(),
  });
  assert.deepEqual(cards, [], 'an empty homepage configuration owns no promotion slots');

  const realContent = (JSON.parse(readFileSync('frontend/messages/en.json', 'utf8')) as {
    home: { redesign: Parameters<typeof homepageExamples.assembleHomepageExampleCards>[0]['content'] };
  }).home.redesign;
  const rankedCards = homepageExamples.assembleHomepageExampleCards({
    locale: 'en',
    content: realContent,
    globalCandidates: [],
    familyVideos: new Map(),
    modelVideos: acceptedPublicLaunchVideos({ mixed: true }),
    models: publishedFixture(),
    readiness: readinessFixture(),
    acceptedAssets: completeAcceptedPackAssets(),
  });
  assert.deepEqual(rankedCards.map(({ id }) => id), [
    ...P0_MENU_REPRESENTATIVES.map((id) => `launch-${id}`),
    'fallback-seedance',
    'fallback-kling',
  ]);
  for (const card of rankedCards.filter(({ id }) => id.startsWith('launch-'))) {
    assert.match(card.imageSrc, /video_p0_accepted_/);
    assert.equal('jobId' in card || 'libraryAssetId' in card || 'reviewStatus' in card, false);
  }

  const unrelatedCards = homepageExamples.assembleHomepageExampleCards({
    locale: 'en',
    content: realContent,
    globalCandidates: [],
    familyVideos: new Map(),
    modelVideos: unrelatedPublicLaunchVideos(),
    models: publishedFixture(),
    readiness: readinessFixture(),
    acceptedAssets: completeAcceptedPackAssets(),
  });
  assert.equal(unrelatedCards.some(({ id }) => id.startsWith('launch-')), false);

  const wrongEngineVideos = acceptedPublicLaunchVideos();
  const ltxAccepted = completeAcceptedPackAssets().find((asset) => asset.modelId === 'ltx-2-5-pro' && asset.mode === 't2v');
  assert.ok(ltxAccepted);
  wrongEngineVideos.set('ltx-2-5-pro', [galleryVideo({ id: ltxAccepted.videoId, engineId: 'wan-3-prime' })]);
  const wrongEngineCards = homepageExamples.assembleHomepageExampleCards({
    locale: 'en',
    content: realContent,
    globalCandidates: [],
    familyVideos: new Map(),
    modelVideos: wrongEngineVideos,
    models: publishedFixture(),
    readiness: readinessFixture(),
    acceptedAssets: completeAcceptedPackAssets(),
  });
  assert.equal(wrongEngineCards.some(({ id }) => id === 'launch-ltx-2-5-pro'), false);
  const selectHeroPreviews = (
    homepageExamples as typeof homepageExamples & {
      selectHomepageHeroPreviews?: <T>(cards: readonly T[]) => T[];
    }
  ).selectHomepageHeroPreviews;
  assert.equal(typeof selectHeroPreviews, 'function');
  if (!selectHeroPreviews) return;
  assert.deepEqual(selectHeroPreviews(rankedCards).map(({ id }) => id), [
    ...P0_MENU_REPRESENTATIVES.map((id) => `launch-${id}`),
    'fallback-seedance',
  ]);

  const contentWithDuplicate = structuredClone(realContent);
  contentWithDuplicate.examples.fallbackCards.unshift({
    ...contentWithDuplicate.examples.fallbackCards[0],
    id: 'fallback-flux-duplicate',
    engineId: 'flux-3',
    modelSlug: 'flux-3',
    examplesSlug: 'flux',
  });
  const deduplicatedCards = homepageExamples.assembleHomepageExampleCards({
    locale: 'en',
    content: contentWithDuplicate,
    globalCandidates: [],
    familyVideos: new Map(),
    modelVideos: acceptedPublicLaunchVideos(),
    models: publishedFixture(),
    readiness: readinessFixture(),
    acceptedAssets: completeAcceptedPackAssets(),
  });
  assert.equal(deduplicatedCards.filter(({ engineId }) => engineId === 'flux-3').length, 1);
  assert.equal(deduplicatedCards.length, realContent.examples.fallbackCards.length);

  const queriedFamilies: string[] = [];
  const queriedModelPlaylists: string[] = [];
  const loadWithDependencies = homepageExamples.loadHomepageExamples as unknown as (
    locale: 'en',
    content: typeof realContent,
    dependencies: {
      models: readonly RuntimeModelEntry[];
      readiness: readonly launchReadiness.ModelLaunchReadinessEntry[];
      acceptedAssets: readonly AcceptedAsset[];
      listExamples: () => Promise<[]>;
      listExampleFamilyPage: (family: string) => Promise<{
        items: [];
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      }>;
      listPlaylistVideos: (slug: string) => Promise<ReturnType<typeof acceptedPublicLaunchVideos> extends Map<string, infer V> ? V : never>;
    },
  ) => Promise<Array<{ id: string }>>;
  const loadedCards = await loadWithDependencies('en', realContent, {
    models: publishedFixture(),
    readiness: readinessFixture(),
    acceptedAssets: completeAcceptedPackAssets(),
    listExamples: async () => [],
    listExampleFamilyPage: async (family) => {
      queriedFamilies.push(family);
      return { items: [], total: 0, limit: 24, offset: 0, hasMore: false };
    },
    listPlaylistVideos: async (slug) => {
      queriedModelPlaylists.push(slug);
      return acceptedPublicLaunchVideos({ mixed: true }).get(slug.replace('examples-', '')) ?? [];
    },
  });
  assert.deepEqual(loadedCards.map(({ id }) => id), rankedCards.map(({ id }) => id));
  for (const family of ['wan', 'grok', 'flux']) assert.ok(queriedFamilies.includes(family), family);
  for (const modelId of P0_MENU_REPRESENTATIVES) assert.ok(queriedModelPlaylists.includes(`examples-${modelId}`), modelId);
});

test('Grok and FLUX have complete genuine EN FR ES family descriptors ready behind routing gates', () => {
  const markers = {
    en: [/text-to-video/i, /reference/i, /opening image/i, /extend/i],
    fr: [/texte-vers-vidéo/i, /référence/i, /image d’ouverture/i, /prolong/i],
    es: [/texto a vídeo/i, /referencia/i, /imagen inicial/i, /ampli/i],
  } as const;

  const copyByFamily: Record<'grok' | 'flux', string[]> = { grok: [], flux: [] };
  const words = (value: string) => value.match(/\p{L}[\p{L}\p{M}'’\-]*/gu) ?? [];
  for (const locale of ['en', 'fr', 'es'] as const) {
    const localized = modelLandingData.getLocalizedModelData(locale);
    const grok = localized.grok;
    const flux = localized.flux;
    assert.ok(grok, `${locale}/grok`);
    assert.ok(flux, `${locale}/flux`);
    const serialize = (descriptor: typeof grok) => [
      descriptor.subtitle,
      descriptor.intro,
      descriptor.promptPatterns,
      descriptor.strengthsLimits,
      descriptor.pricingNotes,
      ...descriptor.faq.flatMap(({ question, answer }) => [question, answer]),
    ].join(' ');
    const grokCopy = serialize(grok);
    const fluxCopy = serialize(flux);
    copyByFamily.grok.push(grokCopy);
    copyByFamily.flux.push(fluxCopy);
    for (const marker of markers[locale].slice(0, 3)) assert.match(grokCopy, marker);
    assert.match(fluxCopy, markers[locale][0]);
    assert.match(fluxCopy, markers[locale][3]);
    assert.ok(grok.faq.length >= 3);
    assert.ok(flux.faq.length >= 3);
    assert.ok(words(grokCopy).length >= 400, `${locale}/grok requires at least 400 useful words`);
    assert.ok(words(fluxCopy).length >= 400, `${locale}/flux requires at least 400 useful words`);
    const grokVocabulary = new Set(words(grokCopy.toLowerCase()).filter((word) => word.length >= 6));
    const fluxVocabulary = new Set(words(fluxCopy.toLowerCase()).filter((word) => word.length >= 6));
    assert.ok([...grokVocabulary].filter((word) => !fluxVocabulary.has(word)).length >= 25, `${locale}/grok unique vocabulary`);
    assert.ok([...fluxVocabulary].filter((word) => !grokVocabulary.has(word)).length >= 25, `${locale}/flux unique vocabulary`);
  }
  for (const family of ['grok', 'flux'] as const) {
    assert.equal(new Set(copyByFamily[family]).size, 3, `${family} copy must be independently localized`);
  }
});
