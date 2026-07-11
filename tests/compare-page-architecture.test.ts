import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { EN_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts';
import {
  CATALOG_BY_SLUG,
  ENGINE_OPTIONS,
} from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config.ts';
import { resolvePromptInheritedShowdowns } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-showdowns.ts';
import * as compareRouting from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-routing.ts';
import {
  getCanonicalCompareSlug,
  resolveLegacyCompareRedirect,
} from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-routing.ts';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata.ts';

const routePath = 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx';
const pageSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-helpers.ts',
  'utf8'
);
const helperTextSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-text.ts',
  'utf8'
);
const helperRoutingSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-routing.ts',
  'utf8'
);
const helperEngineFormattingSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-engine-formatting.ts',
  'utf8'
);
const helperPricingSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-pricing.ts',
  'utf8'
);
const helperSpecValuesSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values.ts',
  'utf8'
);
const helperScoreUtilsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-score-utils.ts',
  'utf8'
);
const loaderSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-data-loaders.ts',
  'utf8'
);
const localizationSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-localization.ts',
  'utf8'
);
const overrideSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts',
  'utf8'
);
const overrideTypesSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-types.ts',
  'utf8'
);
const overrideEnSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts',
  'utf8'
);
const overrideFrSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts',
  'utf8'
);
const overrideEsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts',
  'utf8'
);
const faqSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-faq.ts',
  'utf8'
);
const metadataSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-metadata.ts',
  'utf8'
);

test('comparison routing exposes a focused legacy replacement resolver', () => {
  assert.equal(
    typeof (compareRouting as Record<string, unknown>).resolveLegacyCompareRedirect,
    'function',
  );
});

test('legacy Happy Horse 1.0 vs Sora comparison redirects to the published 1.1 replacement', () => {
  assert.equal(
    resolveLegacyCompareRedirect({
      slug: 'happy-horse-1-0-vs-sora-2-pro',
      locale: 'en',
    }),
    '/ai-video-engines/happy-horse-1-1-vs-sora-2-pro',
  );
  assert.equal(
    resolveLegacyCompareRedirect({
      slug: 'happy-horse-1-0-vs-sora-2-pro',
      order: 'happy-horse-1-0',
      locale: 'es',
    }),
    '/es/comparativa/happy-horse-1-1-vs-sora-2-pro?order=happy-horse-1-1',
  );
  assert.equal(
    resolveLegacyCompareRedirect({
      slug: 'happy-horse-1-0-vs-seedance-2-0',
      locale: 'fr',
    }),
    null,
  );
  const reversed = getCanonicalCompareSlug('sora-2-pro-vs-happy-horse-1-0');
  assert.equal(
    resolveLegacyCompareRedirect({
      slug: reversed?.canonicalSlug ?? '',
      order: 'sora-2-pro',
      locale: 'fr',
    }),
    '/fr/comparatif/happy-horse-1-1-vs-sora-2-pro?order=sora-2-pro',
  );
});

test('comparison detail page applies legacy replacements as permanent redirects', () => {
  assert.match(pageSource, /resolveLegacyCompareRedirect/);
  assert.match(pageSource, /legacyRedirect[\s\S]*permanentRedirect\(legacyRedirect\)/);
});
const scorecardSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-scorecard.ts',
  'utf8'
);
const copySource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-copy.ts',
  'utf8'
);
const relatedLinksSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-related-links.ts',
  'utf8'
);
const routeDataSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-route-data.ts',
  'utf8'
);
const schemaSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-schema.ts',
  'utf8'
);
const showdownsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-showdowns.ts',
  'utf8'
);
const specRowsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-rows.ts',
  'utf8'
);
const configSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config.ts',
  'utf8'
);
const detailContentSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareDetailContent.tsx',
  'utf8'
);
const detailHeroSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareDetailHero.tsx',
  'utf8'
);
const engineHeroCardsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareEngineHeroCards.tsx',
  'utf8'
);
const scorecardSectionSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareScorecardSection.tsx',
  'utf8'
);
const specsSectionSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareSpecsSection.tsx',
  'utf8'
);
const showdownSectionSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareShowdownSection.tsx',
  'utf8'
);
const relatedSectionSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareRelatedSection.tsx',
  'utf8'
);
const faqSectionSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareFaqSection.tsx',
  'utf8'
);
const generateCardSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareGenerateCard.tsx',
  'utf8'
);
const compareConfig = JSON.parse(readFileSync('frontend/config/compare-config.json', 'utf8')) as {
  scoreboardOnlyComparisons?: string[];
  relatedComparisons?: Record<string, string[]>;
  trophyComparisons?: string[];
  showdowns?: Record<
    string,
    Array<{
      slotId?: string;
      aspectRatio?: string;
      mode?: string;
      prompt?: string;
      promptSourceSlug?: string;
      left?: { jobId?: string };
      right?: { jobId?: string };
    }>
  >;
};
const compareHubConfig = JSON.parse(readFileSync('frontend/config/compare-hub.json', 'utf8')) as {
  useCaseBuckets?: Array<{ id: string; pairs?: Array<{ left: string; right: string }> }>;
};

const seedanceFamilyShowdownComparisons = [
  'seedance-2-0-vs-seedance-2-0-fast',
  'dreamina-seedance-2-0-mini-vs-seedance-2-0',
  'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
];

const miniScoreboardOnlyComparisons = [
  'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast',
  'dreamina-seedance-2-0-mini-vs-veo-3-1-fast',
  'dreamina-seedance-2-0-mini-vs-happy-horse-1-1',
  'dreamina-seedance-2-0-mini-vs-luma-ray-3-2',
];

const geminiScoreboardOnlyComparisons = [
  'gemini-omni-flash-vs-veo-3-1',
  'gemini-omni-flash-vs-veo-3-1-fast',
  'gemini-omni-flash-vs-sora-2',
  'gemini-omni-flash-vs-seedance-2-0',
];

const canonicalMiniCompareOverrideSlugs = [
  'dreamina-seedance-2-0-mini-vs-seedance-2-0',
  'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
  'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast',
  'dreamina-seedance-2-0-mini-vs-veo-3-1-fast',
  'dreamina-seedance-2-0-mini-vs-happy-horse-1-1',
  'dreamina-seedance-2-0-mini-vs-luma-ray-3-2',
];

test('Seedance 2.0 vs Fast comparison owns CTR metadata without a site-name suffix', () => {
  const override = EN_COMPARE_PAGE_OVERRIDES['seedance-2-0-vs-seedance-2-0-fast'];
  const meta = override?.meta as { title?: string; description?: string; titleBranding?: string } | undefined;
  const title = 'Seedance 2.0 vs Fast: Quality, Speed, Price & Best Uses';
  const description =
    'Compare Seedance 2.0 and Fast with identical prompts, side-by-side video outputs, pricing, speed, quality tradeoffs and when to use each model.';

  assert.equal(meta?.title, title);
  assert.equal(meta?.description, description);
  assert.equal(meta?.titleBranding, 'none');
  assert.match(
    override?.heroIntro ?? '',
    /^Use Seedance 2\.0 when quality and consistency matter\. Use Seedance 2\.0 Fast when you want quicker, cheaper prompt tests and rapid iteration\./
  );
  assert.equal(override?.quickVerdict?.title, 'Quick verdict');
  assert.match(
    override?.quickVerdict?.body ?? '',
    /Seedance 2\.0 vs Seedance 2\.0 Fast is mainly a quality versus iteration-speed choice/
  );
  assert.match(
    override?.quickVerdict?.body ?? '',
    /final 1080p or 4K shots[\s\S]*cheaper 480p or 720p drafts/,
    'Seedance 2.0 vs Fast should expose the direct snippet answer and resolution tradeoff'
  );
  assert.match(
    JSON.stringify(override?.faq?.items ?? []),
    /Fast vs normal/i,
    'Seedance 2.0 vs Fast should cover the rising "fast vs normal" query language'
  );
  assert.match(
    JSON.stringify(override?.faq?.items ?? []),
    /video edit[\s\S]*extend|extend[\s\S]*video edit/i,
    'Seedance 2.0 vs Fast should answer video edit and extend support queries'
  );
  assert.doesNotMatch(
    JSON.stringify(override?.faq?.items ?? []),
    /BytePlus|byteplus|fal\.ai|\bFal\b/,
    'public Seedance comparison copy should not name implementation providers'
  );
  assert.match(metadataSource, /titleBranding:\s*metaOverride\.titleBranding \?\? 'auto'/);

  const metadata = buildSeoMetadata({
    locale: 'en',
    title,
    description,
    englishPath: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
    titleBranding: meta?.titleBranding === 'none' ? 'none' : 'auto',
  });

  assert.equal(typeof metadata.title === 'object' ? metadata.title.absolute : metadata.title, title);
});

test('public comparison engine selector excludes disabled admin-only engines', () => {
  const serializedOptions = JSON.stringify(ENGINE_OPTIONS);

  assert.doesNotMatch(serializedOptions, /byteplus|BytePlus/);
  assert.doesNotMatch(serializedOptions, /Fast Direct/);
  assert.equal(ENGINE_OPTIONS.some((option) => option.value === 'seedance-2-0-fast-byteplus'), false);
  assert.equal(CATALOG_BY_SLUG.get('seedance-2-0-fast-byteplus')?.surfaces?.compare?.includeInHub, false);
  ENGINE_OPTIONS.forEach((option) => {
    assert.equal(
      CATALOG_BY_SLUG.get(String(option.value))?.surfaces?.compare?.includeInHub,
      true,
      `${String(option.value)} should be a public compare hub engine`
    );
  });
});

test('Seedance 2.0 vs Fast comparison uses curated opposite-engine watch-page outputs', () => {
  const showdowns = compareConfig.showdowns?.['seedance-2-0-vs-seedance-2-0-fast'] ?? [];
  assert.equal(showdowns.length, 3);

  const bySlotId = new Map(showdowns.map((entry) => [entry.slotId, entry]));
  const weather = bySlotId.get('motion-physics');
  const map = bySlotId.get('ugc-lipsync');
  const skateboard = bySlotId.get('hands-text');

  assert.ok(weather);
  assert.equal(weather.left?.jobId, 'job_d12164ca-1c6f-46da-9136-2255a136f124');
  assert.equal(weather.right?.jobId, 'job_528fe01f-e2ea-4cc0-850c-e98190a17473');
  assert.equal(weather.aspectRatio, '16:9');
  assert.equal(weather.mode, 't2v');
  assert.match(weather.prompt ?? '', /weather immediately changes/);

  assert.ok(map);
  assert.equal(map.left?.jobId, 'job_5a365d86-98f8-495a-96b2-5737c88185b9');
  assert.equal(map.right?.jobId, 'job_5bf86ec5-b464-4516-8163-6b11131df5b4');
  assert.equal(map.aspectRatio, '16:9');
  assert.equal(map.mode, 'ref2v');
  assert.match(map.prompt ?? '', /harmless stunt-show tone/);
  assert.doesNotMatch(map.prompt ?? '', /police|weapons|blood|real explosion|injury/i);

  assert.ok(skateboard);
  assert.equal(skateboard.left?.jobId, 'job_638aae88-1368-43a2-8098-10686f9e941c');
  assert.equal(skateboard.right?.jobId, 'job_49f653bb-2ed2-425c-b0d2-f335d3d7f124');
  assert.equal(skateboard.aspectRatio, '16:9');
  assert.equal(skateboard.mode, 't2v');
  assert.match(skateboard.prompt ?? '', /colorful interlocking toy brick/);
  assert.doesNotMatch(skateboard.prompt ?? '', /Lego|immersive/i);
  assert.match(showdownsSource, /aspectRatio:\s*entry\?\.aspectRatio \?\? template\.aspectRatio/);
  assert.match(showdownsSource, /mode:\s*entry\?\.mode \?\? template\.mode/);
});

test('Veo 3.1 Lite vs Fast comparison owns tier CTR metadata without a site-name suffix', () => {
  const override = EN_COMPARE_PAGE_OVERRIDES['veo-3-1-fast-vs-veo-3-1-lite'];
  const meta = override?.meta as { title?: string; description?: string; titleBranding?: string } | undefined;
  const title = 'Veo 3.1 Lite vs Fast: Price, Quality & Best Uses';
  const description =
    'Compare Veo 3.1 Lite and Fast by pricing, output quality, audio control, workflow flexibility and when each tier is worth using.';

  assert.equal(meta?.title, title);
  assert.equal(meta?.description, description);
  assert.equal(meta?.titleBranding, 'none');
  assert.match(
    override?.heroIntro ?? '',
    /^Choose Veo 3\.1 Lite for lower-cost tests\. Choose Veo 3\.1 Fast when quality, audio control and workflow flexibility matter more\./
  );

  const metadata = buildSeoMetadata({
    locale: 'en',
    title,
    description,
    englishPath: '/ai-video-engines/veo-3-1-fast-vs-veo-3-1-lite',
    titleBranding: meta?.titleBranding === 'none' ? 'none' : 'auto',
  });

  assert.equal(typeof metadata.title === 'object' ? metadata.title.absolute : metadata.title, title);
});

test('Seedance family comparisons use video showdowns while Mini and Gemini pages stay scoreboard-only', () => {
  assert.deepEqual(compareConfig.scoreboardOnlyComparisons, [
    ...miniScoreboardOnlyComparisons,
    ...geminiScoreboardOnlyComparisons,
  ]);
  assert.match(configSource, /export const SCOREBOARD_ONLY_COMPARISONS/);
  assert.match(configSource, /compareConfig as \{ scoreboardOnlyComparisons\?: string\[\] \}/);
  assert.ok(compareConfig.trophyComparisons?.every((slug) => !slug.includes('dreamina-seedance-2-0-mini')));
  seedanceFamilyShowdownComparisons.forEach((slug) => {
    assert.ok(!compareConfig.scoreboardOnlyComparisons?.includes(slug), `${slug} should not be scoreboard-only`);
    assert.equal(compareConfig.showdowns?.[slug]?.length, 3, `${slug} should have three curated video showdowns`);
  });
  geminiScoreboardOnlyComparisons.forEach((slug) => {
    assert.equal(compareConfig.showdowns?.[slug], undefined, `${slug} should stay scorecard-only until curated outputs exist`);
  });

  const bestQualityBucket = compareHubConfig.useCaseBuckets?.find((bucket) => bucket.id === 'best-quality');
  assert.ok(bestQualityBucket);
  assert.ok(
    bestQualityBucket.pairs?.every((pair) => pair.left !== 'dreamina-seedance-2-0-mini' && pair.right !== 'dreamina-seedance-2-0-mini')
  );

  assert.deepEqual(compareConfig.relatedComparisons?.['dreamina-seedance-2-0-mini-vs-seedance-2-0'], [
    'seedance-2-0-vs-seedance-2-0-fast',
    'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
    'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast',
    'dreamina-seedance-2-0-mini-vs-veo-3-1-fast',
    'dreamina-seedance-2-0-mini-vs-happy-horse-1-1',
    'dreamina-seedance-2-0-mini-vs-luma-ray-3-2',
  ]);
});

test('Seedance 2.0 Mini family showdowns reuse the Standard vs Fast prompts with Mini outputs', () => {
  const sourceSlug = 'seedance-2-0-vs-seedance-2-0-fast';
  const sourceShowdowns = compareConfig.showdowns?.[sourceSlug] ?? [];
  const miniVsStandardSlug = 'dreamina-seedance-2-0-mini-vs-seedance-2-0';
  const miniVsFastSlug = 'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast';
  const miniVsStandard = compareConfig.showdowns?.[miniVsStandardSlug] ?? [];
  const miniVsFast = compareConfig.showdowns?.[miniVsFastSlug] ?? [];

  assert.equal(sourceShowdowns.length, 3);
  assert.equal(miniVsStandard.length, 3);
  assert.equal(miniVsFast.length, 3);
  miniVsStandard.forEach((entry) => {
    assert.equal(entry.promptSourceSlug, sourceSlug);
    assert.equal(entry.prompt, undefined);
  });
  miniVsFast.forEach((entry) => {
    assert.equal(entry.promptSourceSlug, sourceSlug);
    assert.equal(entry.prompt, undefined);
  });

  const resolvedMiniVsStandard = resolvePromptInheritedShowdowns(miniVsStandard, compareConfig.showdowns ?? {});
  const resolvedMiniVsFast = resolvePromptInheritedShowdowns(miniVsFast, compareConfig.showdowns ?? {});

  resolvedMiniVsStandard.forEach((entry, index) => {
    assert.equal(entry?.prompt, sourceShowdowns[index]?.prompt);
    assert.equal(entry?.title, sourceShowdowns[index]?.title);
    assert.equal(entry?.aspectRatio, '16:9');
  });
  resolvedMiniVsFast.forEach((entry, index) => {
    assert.equal(entry?.prompt, sourceShowdowns[index]?.prompt);
    assert.equal(entry?.title, sourceShowdowns[index]?.title);
    assert.equal(entry?.aspectRatio, '16:9');
  });

  const standardBySlotId = new Map(resolvedMiniVsStandard.map((entry) => [entry?.slotId, entry]));
  assert.equal(standardBySlotId.get('motion-physics')?.left?.jobId, 'job_f2605150-0d2a-48ad-b1a9-bba8891d568b');
  assert.equal(standardBySlotId.get('motion-physics')?.right?.jobId, 'job_d12164ca-1c6f-46da-9136-2255a136f124');
  assert.equal(standardBySlotId.get('ugc-lipsync')?.left?.jobId, 'job_f9e077a0-2568-464e-a4e6-962537320dec');
  assert.equal(standardBySlotId.get('ugc-lipsync')?.right?.jobId, 'job_5a365d86-98f8-495a-96b2-5737c88185b9');
  assert.equal(standardBySlotId.get('hands-text')?.left?.jobId, 'job_2581d0af-23fc-46dd-a1df-049cac1824c1');
  assert.equal(standardBySlotId.get('hands-text')?.right?.jobId, 'job_638aae88-1368-43a2-8098-10686f9e941c');

  const fastBySlotId = new Map(resolvedMiniVsFast.map((entry) => [entry?.slotId, entry]));
  assert.equal(fastBySlotId.get('motion-physics')?.left?.jobId, 'job_f2605150-0d2a-48ad-b1a9-bba8891d568b');
  assert.equal(fastBySlotId.get('motion-physics')?.right?.jobId, 'job_528fe01f-e2ea-4cc0-850c-e98190a17473');
  assert.equal(fastBySlotId.get('ugc-lipsync')?.left?.jobId, 'job_f9e077a0-2568-464e-a4e6-962537320dec');
  assert.equal(fastBySlotId.get('ugc-lipsync')?.right?.jobId, 'job_5bf86ec5-b464-4516-8163-6b11131df5b4');
  assert.equal(fastBySlotId.get('hands-text')?.left?.jobId, 'job_2581d0af-23fc-46dd-a1df-049cac1824c1');
  assert.equal(fastBySlotId.get('hands-text')?.right?.jobId, 'job_49f653bb-2ed2-425c-b0d2-f335d3d7f124');
});

test('Seedance 2.0 Mini localized compare overrides distinguish family videos from scorecard-only pages', () => {
  canonicalMiniCompareOverrideSlugs.forEach((slug) => {
    assert.ok(EN_COMPARE_PAGE_OVERRIDES[slug], `missing EN Mini override for ${slug}`);
    assert.match(overrideFrSource, new RegExp(`'${slug}'`));
    assert.match(overrideEsSource, new RegExp(`'${slug}'`));
  });

  assert.match(EN_COMPARE_PAGE_OVERRIDES['dreamina-seedance-2-0-mini-vs-seedance-2-0']?.heroIntro ?? '', /flagship final-quality/);
  assert.doesNotMatch(EN_COMPARE_PAGE_OVERRIDES['dreamina-seedance-2-0-mini-vs-seedance-2-0']?.heroIntro ?? '', /scorecard and specs comparison/);
  assert.match(EN_COMPARE_PAGE_OVERRIDES['dreamina-seedance-2-0-mini-vs-seedance-2-0']?.heroIntro ?? '', /side-by-side Mini vs Seedance 2\.0 videos/);
  assert.match(EN_COMPARE_PAGE_OVERRIDES['dreamina-seedance-2-0-mini-vs-seedance-2-0-fast']?.heroIntro ?? '', /lower-cost batch volume/);
  assert.match(EN_COMPARE_PAGE_OVERRIDES['dreamina-seedance-2-0-mini-vs-seedance-2-0-fast']?.heroIntro ?? '', /side-by-side Mini vs Fast videos/);
  assert.match(EN_COMPARE_PAGE_OVERRIDES['dreamina-seedance-2-0-mini-vs-ltx-2-3-fast']?.heroIntro ?? '', /480p\/720p batches/);
  assert.match(EN_COMPARE_PAGE_OVERRIDES['dreamina-seedance-2-0-mini-vs-veo-3-1-fast']?.heroIntro ?? '', /does not include comparison videos/);
  assert.match(overrideFrSource, /videos cote-a-cote Mini vs Seedance 2\.0/);
  assert.match(overrideFrSource, /videos cote-a-cote Mini vs Fast/);
  assert.match(overrideEsSource, /videos lado a lado Mini vs Seedance 2\.0/);
  assert.match(overrideEsSource, /videos lado a lado Mini vs Fast/);
  assert.match(overrideFrSource, /n inclut pas de videos comparatives/);
  assert.match(overrideEsSource, /no incluye videos comparativos/);
  [overrideEnSource, overrideFrSource, overrideEsSource].forEach((source) => {
    const seedanceSlice = source.slice(
      source.indexOf("'seedance-2-0-vs-seedance-2-0-fast'"),
      source.indexOf("'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast'")
    );
    assert.doesNotMatch(seedanceSlice, /BytePlus|byteplus|fal\.ai|\bFal\b/);
  });
});

test('scoreboard-only comparisons skip video showdown lookup before database requests', () => {
  const gateIndex = showdownsSource.indexOf('SCOREBOARD_ONLY_COMPARISON_SET.has(canonicalSlug)');
  const returnIndex = showdownsSource.indexOf('return [];', gateIndex);
  const curatedIndex = showdownsSource.indexOf('const hasCuratedPairShowdowns');
  const publicByIdsIndex = showdownsSource.indexOf('await getPublicVideosByIds');
  const latestVideoIndex = showdownsSource.indexOf('getLatestPublicVideoByPromptAndEngine(template.prompt');

  assert.ok(gateIndex > -1, 'showdowns should check SCOREBOARD_ONLY_COMPARISONS');
  assert.ok(returnIndex > gateIndex, 'showdowns should return [] for scoreboard-only pairs');
  assert.ok(returnIndex < curatedIndex, 'scoreboard-only return should happen before curated showdown hydration');
  assert.ok(returnIndex < publicByIdsIndex, 'scoreboard-only return should happen before override video lookups');
  assert.ok(returnIndex < latestVideoIndex, 'scoreboard-only return should happen before prompt/engine video lookups');
});

test('comparison detail page delegates copy, data, schema, and media responsibilities', () => {
  const lineCount = pageSource.split('\n').length;

  assert.ok(lineCount <= 300, `comparison page should stay under 300 lines after orchestration extraction, got ${lineCount}`);
  assert.ok(pageSource.includes("from './_lib/compare-page-helpers'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-overrides'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-faq'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-metadata'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-related-links'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-route-data'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-schema'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-scorecard'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-spec-rows'"));
  assert.ok(pageSource.includes("from './_lib/compare-page-showdowns'"));
  assert.ok(pageSource.includes("from './_components/CompareDetailContent'"));
  assert.doesNotMatch(pageSource, /const COMPARE_PAGE_OVERRIDES/);
  assert.doesNotMatch(pageSource, /type ComparePageCopy =/);
  assert.doesNotMatch(pageSource, /const generatedFaqItems =/);
  assert.doesNotMatch(pageSource, /const comparisonMetrics = \[/);
  assert.doesNotMatch(pageSource, /<section className=/);
  assert.doesNotMatch(pageSource, /buildSeoMetadata/);
  assert.doesNotMatch(pageSource, /getPublicVideosByIds/);
  assert.doesNotMatch(pageSource, /getLatestPublicVideoByPromptAndEngine/);
  assert.doesNotMatch(pageSource, /SHOWDOWN_OVERRIDES/);
  assert.doesNotMatch(pageSource, /RELATED_COMPARISONS/);
  assert.doesNotMatch(pageSource, /fetchEngineAverageDurations/);
  assert.doesNotMatch(pageSource, /loadEngineScores/);
  assert.doesNotMatch(pageSource, /BreadcrumbList/);
  assert.doesNotMatch(pageSource, /'@type': 'WebPage'/);
});

test('comparison detail helper facade delegates routing, pricing, specs, and localized overrides', () => {
  const helperLineCount = helperSource.split('\n').length;

  assert.ok(helperLineCount <= 80, `compare-page-helpers.ts should stay a facade below 80 lines, got ${helperLineCount}`);
  assert.match(helperSource, /from '\.\/compare-page-data-loaders'/);
  assert.match(helperSource, /from '\.\/compare-page-localization'/);
  assert.match(helperSource, /from '\.\/compare-page-routing'/);
  assert.match(helperSource, /from '\.\/compare-page-pricing'/);
  assert.match(helperSource, /from '\.\/compare-page-spec-values'/);
  assert.match(helperSource, /from '\.\/compare-page-score-utils'/);
  assert.match(helperSource, /from '\.\/compare-page-engine-formatting'/);
  assert.match(helperSource, /from '\.\/compare-page-text'/);
  assert.match(helperRoutingSource, /export function getCanonicalCompareSlug/);
  assert.match(helperRoutingSource, /export function resolveExcludedCompareRedirect/);
  assert.match(helperPricingSource, /export async function resolvePricingDisplay/);
  assert.match(helperPricingSource, /export function computePricingScore/);
  assert.match(helperSpecValuesSource, /export function buildSpecValues/);
  assert.match(helperSpecValuesSource, /export function localizeSpecDetailValue/);
  assert.match(helperEngineFormattingSource, /export function formatEngineName/);
  assert.match(helperEngineFormattingSource, /export function formatSpeedChip/);
  assert.match(helperEngineFormattingSource, /export type EngineAccent/);
  assert.match(helperScoreUtilsSource, /export function computePairScores/);
  assert.match(helperScoreUtilsSource, /export function pickFirstCapabilityDifference/);
  assert.match(helperTextSource, /export function formatTemplate/);
  assert.match(helperTextSource, /export function stripAudioReferencesForSilentPair/);
  assert.ok(overrideSource.split('\n').length <= 40, 'compare-page-overrides.ts should stay a small facade');
  assert.match(overrideSource, /export function getComparePageOverride/);
  assert.match(overrideSource, /from '\.\/compare-page-overrides-en'/);
  assert.match(overrideSource, /from '\.\/compare-page-overrides-fr'/);
  assert.match(overrideSource, /from '\.\/compare-page-overrides-es'/);
  assert.match(overrideTypesSource, /export type ComparePageOverride/);
  assert.match(overrideEnSource, /export const EN_COMPARE_PAGE_OVERRIDES/);
  assert.match(overrideFrSource, /export const FR_COMPARE_PAGE_OVERRIDES/);
  assert.match(overrideEsSource, /export const ES_COMPARE_PAGE_OVERRIDES/);
  assert.doesNotMatch(helperSource, /const LOCALIZED_BEST_FOR/);
  assert.doesNotMatch(helperSource, /export async function loadEngineScores/);
  assert.doesNotMatch(helperSource, /computeMarketingPriceRange/);
  assert.doesNotMatch(helperSource, /canonicalizeFalModelSlug/);
});

test('comparison route excludes image-only Luma Uni models', () => {
  assert.match(configSource, /EXCLUDED_ENGINE_SLUGS[\s\S]*'luma-uni-1'[\s\S]*'luma-uni-1-max'/);
});

test('comparison detail split helpers own FAQ, scorecard, and generate card responsibilities', () => {
  assert.match(faqSource, /export function buildCompareFaqItems/);
  assert.match(faqSource, /export function buildCompareFaqJsonLd/);
  assert.match(scorecardSource, /export function buildComparisonMetrics/);
  assert.match(scorecardSource, /export function buildCompareSummaryRows/);
  assert.match(scorecardSource, /export function deriveCompareStrengths/);
  assert.match(metadataSource, /export async function buildComparePageMetadata/);
  assert.match(metadataSource, /buildSeoMetadata/);
  assert.match(copySource, /export function buildCompareDetailLabels/);
  assert.match(copySource, /export function buildCompareDetailPageText/);
  assert.match(relatedLinksSource, /export function buildRelatedComparisonLinks/);
  assert.match(routeDataSource, /export async function buildCompareRouteData/);
  assert.match(schemaSource, /export function buildCompareBreadcrumbJsonLd/);
  assert.match(schemaSource, /export function buildCompareWebPageJsonLd/);
  assert.match(showdownsSource, /export async function buildCompareShowdownSlots/);
  assert.match(showdownsSource, /getPublicVideosByIds/);
  assert.match(showdownsSource, /getLatestPublicVideoByPromptAndEngine/);
  assert.match(specRowsSource, /export function buildCompareSpecRows/);
  assert.match(detailContentSource, /export function CompareDetailContent/);
  assert.match(generateCardSource, /export function CompareGenerateCard/);
  assert.match(detailContentSource, /CompareDetailHero/);
  assert.match(detailContentSource, /CompareEngineHeroCards/);
  assert.match(detailContentSource, /CompareScorecardSection/);
  assert.match(detailContentSource, /CompareSpecsSection/);
  assert.match(detailContentSource, /CompareShowdownSection/);
  assert.match(detailContentSource, /CompareFaqSection/);
  assert.match(detailHeroSource, /export function CompareDetailHero/);
  assert.match(engineHeroCardsSource, /export function CompareEngineHeroCards/);
  assert.match(scorecardSectionSource, /export function CompareScorecardSection/);
  assert.match(scorecardSectionSource, /BenchmarkMethodologyLink/);
  assert.match(scorecardSectionSource, /activeLocale/);
  assert.match(specsSectionSource, /export function CompareSpecsSection/);
  assert.match(showdownSectionSource, /export function CompareShowdownSection/);
  assert.match(relatedSectionSource, /export function CompareRelatedSection/);
  assert.match(faqSectionSource, /export function CompareFaqSection/);
  assert.match(showdownSectionSource, /CompareShowdownMedia/);
  assert.match(specsSectionSource, /CompareSpecValue/);
  assert.match(faqSectionSource, /dangerouslySetInnerHTML/);
});

test('comparison detail data and localization helpers expose focused contracts', () => {
  assert.match(loaderSource, /export async function loadEngineScores/);
  assert.match(loaderSource, /export async function loadEngineKeySpecs/);
  assert.match(loaderSource, /export async function hydrateShowdowns/);
  assert.match(localizationSource, /const LOCALIZED_BEST_FOR/);
  assert.match(localizationSource, /export const LOCALIZED_SHOWDOWN_TITLES/);
  assert.match(localizationSource, /export const LOCALIZED_SHOWDOWN_TESTS/);
  assert.match(localizationSource, /export function localizeMappedValue/);
  assert.match(localizationSource, /export function localizeBestFor/);
});

test('comparison detail content stays a visual orchestrator', () => {
  const lineCount = detailContentSource.split('\n').length;

  assert.ok(lineCount <= 230, `CompareDetailContent should stay below 230 lines after section extraction, got ${lineCount}`);
  assert.doesNotMatch(detailContentSource, /showdownSlots\.map/);
  assert.doesNotMatch(detailContentSource, /specRows\.map/);
  assert.doesNotMatch(detailContentSource, /faqItems\.map/);
  assert.doesNotMatch(detailContentSource, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(detailContentSource, /DeferredSourcePrompt/);
  assert.doesNotMatch(detailContentSource, /CopyPromptButton/);
});
