import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata.ts';

const root = process.cwd();
const angleWrapperPath = join(root, 'frontend/src/components/tools/AngleLandingPage.tsx');
const characterWrapperPath = join(root, 'frontend/src/components/tools/CharacterBuilderLandingPage.tsx');
const backgroundRemovalWrapperPath = join(root, 'frontend/src/components/tools/BackgroundRemovalLandingPage.tsx');
const angleViewPath = join(root, 'frontend/src/components/tools/angle/landing/AngleLandingView.tsx');
const angleSectionsPath = join(root, 'frontend/src/components/tools/angle/landing/AngleLandingSections.tsx');
const angleLeadSectionsPath = join(root, 'frontend/src/components/tools/angle/landing/AngleLandingLeadSections.tsx');
const angleUseCaseSectionsPath = join(root, 'frontend/src/components/tools/angle/landing/AngleLandingUseCaseSections.tsx');
const angleConversionSectionsPath = join(root, 'frontend/src/components/tools/angle/landing/AngleLandingConversionSections.tsx');
const anglePrimitivesPath = join(root, 'frontend/src/components/tools/angle/landing/AngleLandingPrimitives.tsx');
const angleAssetsPath = join(root, 'frontend/src/components/tools/angle/landing/angle-landing-assets.ts');
const angleStylesPath = join(root, 'frontend/src/components/tools/angle/landing/AngleLanding.module.css');
const englishMessagesPath = join(root, 'frontend/messages/en.json');
const frenchMessagesPath = join(root, 'frontend/messages/fr.json');
const spanishMessagesPath = join(root, 'frontend/messages/es.json');
const characterViewPath = join(root, 'frontend/src/components/tools/character-builder/landing/CharacterBuilderLandingView.tsx');
const characterSectionsPath = join(root, 'frontend/src/components/tools/character-builder/landing/CharacterBuilderLandingSections.tsx');
const characterLeadSectionsPath = join(root, 'frontend/src/components/tools/character-builder/landing/CharacterBuilderLandingLeadSections.tsx');
const characterWorkflowSectionsPath = join(root, 'frontend/src/components/tools/character-builder/landing/CharacterBuilderLandingWorkflowSections.tsx');
const characterConversionSectionsPath = join(root, 'frontend/src/components/tools/character-builder/landing/CharacterBuilderLandingConversionSections.tsx');
const characterPrimitivesPath = join(root, 'frontend/src/components/tools/character-builder/landing/CharacterBuilderLandingPrimitives.tsx');
const characterAssetsPath = join(root, 'frontend/src/components/tools/character-builder/landing/character-builder-landing-assets.ts');
const backgroundRemovalViewPath = join(root, 'frontend/src/components/tools/background-removal/landing/BackgroundRemovalLandingView.tsx');
const backgroundRemovalSectionsPath = join(root, 'frontend/src/components/tools/background-removal/landing/BackgroundRemovalLandingSections.tsx');
const backgroundRemovalAssetsPath = join(root, 'frontend/src/components/tools/background-removal/landing/background-removal-landing-assets.ts');
const jsonLdPath = join(root, 'frontend/src/components/tools/landing/tool-marketing-json-ld.ts');
const angleRoutePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/tools/angle/page.tsx');
const characterRoutePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/tools/character-builder/page.tsx');
const backgroundRemovalRoutePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/tools/background-removal/page.tsx');

const angleWrapperSource = readFileSync(angleWrapperPath, 'utf8');
const characterWrapperSource = readFileSync(characterWrapperPath, 'utf8');
const backgroundRemovalWrapperSource = readFileSync(backgroundRemovalWrapperPath, 'utf8');
const angleViewSource = readFileSync(angleViewPath, 'utf8');
const angleSectionsSource = readFileSync(angleSectionsPath, 'utf8');
const angleLeadSectionsSource = readFileSync(angleLeadSectionsPath, 'utf8');
const angleUseCaseSectionsSource = readFileSync(angleUseCaseSectionsPath, 'utf8');
const angleConversionSectionsSource = readFileSync(angleConversionSectionsPath, 'utf8');
const angleStylesSource = readFileSync(angleStylesPath, 'utf8');
const angleRouteSource = readFileSync(angleRoutePath, 'utf8');
const characterViewSource = readFileSync(characterViewPath, 'utf8');
const characterSectionsSource = readFileSync(characterSectionsPath, 'utf8');
const characterLeadSectionsSource = readFileSync(characterLeadSectionsPath, 'utf8');
const characterConversionSectionsSource = readFileSync(characterConversionSectionsPath, 'utf8');
const backgroundRemovalViewSource = readFileSync(backgroundRemovalViewPath, 'utf8');
const jsonLdSource = readFileSync(jsonLdPath, 'utf8');

const landingFiles = [
  angleViewPath,
  angleSectionsPath,
  angleLeadSectionsPath,
  angleUseCaseSectionsPath,
  angleConversionSectionsPath,
  anglePrimitivesPath,
  angleAssetsPath,
  characterViewPath,
  characterSectionsPath,
  characterLeadSectionsPath,
  characterWorkflowSectionsPath,
  characterConversionSectionsPath,
  characterPrimitivesPath,
  characterAssetsPath,
  backgroundRemovalViewPath,
  backgroundRemovalSectionsPath,
  backgroundRemovalAssetsPath,
] as const;

test('tool marketing landing entry files stay thin wrappers', () => {
  assert.ok(existsSync(angleViewPath), 'angle landing view should live in the angle landing folder');
  assert.ok(existsSync(characterViewPath), 'character builder landing view should live in the character builder landing folder');
  assert.ok(existsSync(backgroundRemovalViewPath), 'background removal landing view should live in the background removal landing folder');

  assert.match(angleWrapperSource, /AngleLandingView/, 'angle wrapper should delegate to the colocated view');
  assert.match(characterWrapperSource, /CharacterBuilderLandingView/, 'character wrapper should delegate to the colocated view');
  assert.match(backgroundRemovalWrapperSource, /BackgroundRemovalLandingView/, 'background removal wrapper should delegate to the colocated view');

  for (const [label, source] of [
    ['AngleLandingPage', angleWrapperSource],
    ['CharacterBuilderLandingPage', characterWrapperSource],
    ['BackgroundRemovalLandingPage', backgroundRemovalWrapperSource],
  ] as const) {
    assert.ok(source.split('\n').length <= 12, `${label} should stay a thin route-facing wrapper`);
    assert.doesNotMatch(source, /FAQSchema|buildMarketingServiceJsonLd|dangerouslySetInnerHTML|next\/image/, `${label} should not own landing rendering or SEO scripts`);
  }
});

test('tool marketing landing views own SEO orchestration and delegate sections', () => {
  assert.match(angleViewSource, /export function AngleLandingView/, 'angle view should export the render orchestrator');
  assert.match(characterViewSource, /export function CharacterBuilderLandingView/, 'character builder view should export the render orchestrator');
  assert.match(backgroundRemovalViewSource, /export function BackgroundRemovalLandingView/, 'background removal view should export the render orchestrator');
  assert.match(angleViewSource, /AngleLandingSections/, 'angle view should delegate visible rendering to section components');
  assert.match(characterViewSource, /CharacterBuilderLandingSections/, 'character builder view should delegate visible rendering to section components');
  assert.match(backgroundRemovalViewSource, /BackgroundRemovalLandingSections/, 'background removal view should delegate visible rendering to section components');

  for (const [label, source] of [
    ['AngleLandingView', angleViewSource],
    ['CharacterBuilderLandingView', characterViewSource],
    ['BackgroundRemovalLandingView', backgroundRemovalViewSource],
  ] as const) {
    assert.match(source, /buildToolBreadcrumbJsonLd/, `${label} should use the shared breadcrumb JSON-LD helper`);
    assert.doesNotMatch(source, /function serializeJsonLd/, `${label} should not define duplicate JSON-LD serializers`);
    assert.doesNotMatch(source, /next\/image|ButtonLink|Card/, `${label} should not own visual section rendering`);
  }

  for (const [label, source] of [
    ['CharacterBuilderLandingView', characterViewSource],
    ['BackgroundRemovalLandingView', backgroundRemovalViewSource],
  ] as const) {
    assert.match(source, /buildToolHowToJsonLd/, `${label} should use the shared HowTo JSON-LD helper`);
    assert.match(source, /FAQSchema/, `${label} should keep FAQ schema rendering`);
  }

  assert.match(jsonLdSource, /export function serializeJsonLd/, 'JSON-LD helper should expose safe serialization');
  assert.match(jsonLdSource, /export function buildToolBreadcrumbJsonLd/, 'JSON-LD helper should build breadcrumbs');
  assert.match(jsonLdSource, /export function buildToolHowToJsonLd/, 'JSON-LD helper should build HowTo schema');
  assert.match(jsonLdSource, /#step-\$\{index \+ 1\}/, 'HowTo helper should preserve step anchor URLs');
});

test('Angle keeps permitted SEO orchestration and drops restricted rich-result schemas', () => {
  assert.match(angleViewSource, /buildToolBreadcrumbJsonLd/);
  assert.match(angleViewSource, /buildMarketingServiceJsonLd/);
  assert.doesNotMatch(angleViewSource, /FAQSchema|buildToolHowToJsonLd|howToJsonLd/);
});

test('Angle premium content ships with matching keys in all three locales', () => {
  const dictionaries = [englishMessagesPath, frenchMessagesPath, spanishMessagesPath].map((path) =>
    JSON.parse(readFileSync(path, 'utf8')).toolMarketing.angle,
  );
  const keys = (value: unknown): string[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [key, ...keys(child).map((nested) => `${key}.${nested}`)]);
  };
  assert.deepEqual(keys(dictionaries[1]), keys(dictionaries[0]));
  assert.deepEqual(keys(dictionaries[2]), keys(dictionaries[0]));
});

test('Angle limits copy names source quality, cross-angle consistency, and supported uses in every locale', () => {
  const localeExpectations = [
    { path: englishMessagesPath, quality: /quality/i, consistency: /consistency/i, supportedUses: /still images|first frames/i },
    { path: frenchMessagesPath, quality: /qualité/i, consistency: /cohérence/i, supportedUses: /images fixes|premières images/i },
    { path: spanishMessagesPath, quality: /calidad/i, consistency: /coherencia/i, supportedUses: /imágenes fijas|primeros fotogramas/i },
  ];

  for (const { path, quality, consistency, supportedUses } of localeExpectations) {
    const limits = JSON.parse(readFileSync(path, 'utf8')).toolMarketing.angle.faq.limits;
    assert.equal(typeof limits, 'string', `${path} should provide dedicated limits copy`);
    assert.match(limits, quality, `${path} should explain the source-quality dependency`);
    assert.match(limits, consistency, `${path} should explain consistency limits between generated angles`);
    assert.match(limits, supportedUses, `${path} should identify supported uses`);
  }
});

test('Angle metadata and Orbit labels are complete in every locale', () => {
  for (const messagePath of [englishMessagesPath, frenchMessagesPath, spanishMessagesPath]) {
    const angle = JSON.parse(readFileSync(messagePath, 'utf8')).toolMarketing.angle;
    assert.ok(angle.meta.title.length >= 30 && angle.meta.title.length <= 60, `${messagePath} title length`);
    assert.ok(angle.meta.description.length >= 120 && angle.meta.description.length <= 160, `${messagePath} description length`);
    assert.equal(angle.hero.orbit.views.length, 4);
    assert.ok(angle.hero.orbit.dragLabel && angle.hero.orbit.previousLabel && angle.hero.orbit.nextLabel && angle.hero.orbit.livePrefix);
    assert.ok(angle.videoPrep.title && angle.videoPrep.body && angle.videoPrep.sourceAlt && angle.videoPrep.outputAlt);
  }
});

test('Angle metadata resolves exact localized titles and the 1600 by 1200 social hero', () => {
  const socialImage = {
    url: 'https://maxvideoai.com/assets/tools/angle-orbit-hero-dialogue-field.webp',
    width: 1600,
    height: 1200,
  };
  const localeMessages = [
    ['en', englishMessagesPath],
    ['fr', frenchMessagesPath],
    ['es', spanishMessagesPath],
  ] as const;

  assert.match(angleRouteSource, /titleBranding:\s*'none'/);
  assert.match(angleRouteSource, /openGraph:\s*\{\s*images:\s*\[angleSocialImage\]\s*\}/);
  assert.match(angleRouteSource, /twitter:\s*\{\s*images:\s*\[angleSocialImage\]\s*\}/);

  for (const [locale, messagePath] of localeMessages) {
    const meta = JSON.parse(readFileSync(messagePath, 'utf8')).toolMarketing.angle.meta;
    const image = { ...socialImage, alt: meta.imageAlt };
    const metadata = buildSeoMetadata({
      locale,
      title: meta.title,
      description: meta.description,
      englishPath: '/tools/angle',
      availableLocales: ['en', 'fr', 'es'],
      keywords: meta.keywords,
      image: socialImage.url,
      imageAlt: meta.imageAlt,
      titleBranding: 'none',
      openGraph: { images: [image] },
      twitter: { images: [image] },
    });

    assert.equal(typeof metadata.title === 'object' ? metadata.title.absolute : metadata.title, meta.title);
    assert.equal(metadata.openGraph?.title, meta.title);
    assert.equal(metadata.twitter?.title, meta.title);
    assert.deepEqual(metadata.openGraph?.images, [image]);
    assert.deepEqual(metadata.twitter?.images, [image]);
  }
});

test('tool marketing landing sections preserve CTAs and stay split by responsibility', () => {
  assert.match(
    `${angleLeadSectionsSource}\n${angleUseCaseSectionsSource}\n${angleConversionSectionsSource}`,
    /data-analytics-event="tool_cta_click"/,
    'angle section owners should preserve CTA analytics attributes',
  );
  assert.match(characterLeadSectionsSource, /data-analytics-event="tool_cta_click"/, 'character hero should preserve CTA analytics attributes');
  assert.match(characterConversionSectionsSource, /data-analytics-event="tool_cta_click"/, 'character final CTA should preserve CTA analytics attributes');
  assert.match(characterSectionsSource, /CharacterBuilderOutputsWorkflowSection/, 'character section orchestrator should compose workflow rendering');
  assert.match(backgroundRemovalViewSource, /buildMarketingServiceJsonLd/, 'background removal view should use shared service JSON-LD');

  for (const filePath of landingFiles) {
    const lineCount = readFileSync(filePath, 'utf8').split('\n').length;
    assert.ok(lineCount <= 500, `${filePath} should stay below 500 lines after section extraction, got ${lineCount}`);
  }
});

test('Angle landing composes focused premium section owners without repeated image modules', () => {
  const lead = readFileSync(join(root, 'frontend/src/components/tools/angle/landing/AngleLandingLeadSections.tsx'), 'utf8');
  const useCases = readFileSync(join(root, 'frontend/src/components/tools/angle/landing/AngleLandingUseCaseSections.tsx'), 'utf8');
  const conversion = readFileSync(join(root, 'frontend/src/components/tools/angle/landing/AngleLandingConversionSections.tsx'), 'utf8');
  assert.match(angleSectionsSource, /AngleLandingHeroSection/);
  assert.match(angleSectionsSource, /AngleLandingUseCaseSections/);
  assert.match(angleSectionsSource, /AngleLandingConversionSections/);
  assert.match(useCases, /ANGLE_ORBIT_ASSETS\.product/);
  assert.match(useCases, /ANGLE_ORBIT_ASSETS\.storyboard/);
  assert.match(useCases, /ANGLE_ORBIT_ASSETS\.adCreative/);
  assert.match(useCases, /ANGLE_ORBIT_ASSETS\.videoPrep/);
  assert.match(conversion, /ANGLE_ORBIT_ASSETS\.workspace/);
  assert.doesNotMatch(conversion, /ANGLE_ORBIT_ASSETS\.(hero|proof|product|storyboard|adCreative|videoPrep)/);
  for (const source of [lead, useCases, conversion, angleSectionsSource]) {
    assert.ok(source.split('\n').length <= 500);
  }
});

test('Angle section orchestration relies on the marketing layout main landmark', () => {
  assert.match(angleSectionsSource, /<div className=\{styles\.page\}>/);
  assert.doesNotMatch(angleSectionsSource, /<main\b/);
});

test('Angle conversion renders dedicated limits copy before the visible questions', () => {
  const limitsIndex = angleConversionSectionsSource.indexOf('content.faq.limits');
  const questionsIndex = angleConversionSectionsSource.indexOf('<details');

  assert.ok(limitsIndex >= 0, 'conversion sections should render dedicated localized limits copy');
  assert.ok(questionsIndex > limitsIndex, 'limits copy should appear before the visible questions');
  assert.doesNotMatch(angleConversionSectionsSource, /limitAnswers|faq\.items\[\d+\]\.answer/, 'limits copy should not be assembled from FAQ answers');
});

test('localized tool routes keep importing stable landing entry points', () => {
  const characterRouteSource = readFileSync(characterRoutePath, 'utf8');
  const backgroundRemovalRouteSource = readFileSync(backgroundRemovalRoutePath, 'utf8');

  assert.match(angleRouteSource, /@\/components\/tools\/AngleLandingPage/, 'angle route should keep the stable landing import');
  assert.match(characterRouteSource, /@\/components\/tools\/CharacterBuilderLandingPage/, 'character builder route should keep the stable landing import');
  assert.match(backgroundRemovalRouteSource, /@\/components\/tools\/BackgroundRemovalLandingPage/, 'background removal route should keep the stable landing import');
});

test('Angle Orbit keeps static hero copy server-side and browser logic in one client island', () => {
  const leadPath = join(root, 'frontend/src/components/tools/angle/landing/AngleLandingLeadSections.tsx');
  const orbitPath = join(root, 'frontend/src/components/tools/angle/landing/AngleOrbitStudio.client.tsx');
  const lead = readFileSync(leadPath, 'utf8');
  const orbit = readFileSync(orbitPath, 'utf8');
  assert.match(lead, /export function AngleLandingHeroSection/);
  assert.match(lead, /<h1/);
  assert.match(lead, /data-analytics-cta-name="angle_try_tool_hero"/);
  assert.match(orbit, /^'use client';/);
  assert.match(orbit, /onPointerDown|onPointerMove|onPointerUp/);
  assert.match(orbit, /onKeyDown/);
  assert.match(orbit, /prefers-reduced-motion/);
  assert.doesNotMatch(orbit, /three|WebGL|canvas/i);
});

test('Angle Orbit rejects secondary pointers and active-drag takeover before pointer capture', () => {
  const orbitPath = join(root, 'frontend/src/components/tools/angle/landing/AngleOrbitStudio.client.tsx');
  const orbit = readFileSync(orbitPath, 'utf8');
  const pointerDownStart = orbit.indexOf('const handlePointerDown');
  const pointerGuard = orbit.indexOf('if (!event.isPrimary || pointerStart.current) return;', pointerDownStart);
  const pointerCapture = orbit.indexOf('event.currentTarget.setPointerCapture', pointerDownStart);

  assert.ok(pointerDownStart >= 0, 'Orbit should define a pointer-down handler');
  assert.ok(pointerGuard > pointerDownStart, 'Orbit should reject a non-primary pointer or an active-drag takeover');
  assert.ok(pointerGuard < pointerCapture, 'Orbit should reject pointer takeover before capturing it');
});

test('Angle landing owns a page-scoped graphite dark theme contract', () => {
  const pageBlock = angleStylesSource.match(/\.page\s*\{([^}]*)\}/)?.[1];
  const darkPageBlock = angleStylesSource.match(/:global\(\[data-theme='dark'\]\)\s+\.page\s*\{([^}]*)\}/)?.[1];

  assert.ok(pageBlock, 'Angle styles should define light theme properties on .page');
  assert.ok(darkPageBlock, 'Angle styles should override those properties under the global dark theme');

  const requiredTokens = [
    '--angle-canvas',
    '--angle-canvas-alt',
    '--angle-hero-background',
    '--angle-surface',
    '--angle-surface-translucent',
    '--angle-surface-elevated',
    '--angle-surface-inset',
    '--angle-media-matte',
    '--angle-media-placeholder',
    '--angle-orbit-placeholder',
    '--angle-hero-border',
    '--angle-controls-text',
    '--angle-button-border',
    '--angle-link-decoration',
    '--angle-text',
    '--angle-text-secondary',
    '--angle-text-muted',
    '--angle-border',
    '--angle-border-strong',
    '--angle-output-border',
    '--angle-accent',
    '--angle-accent-soft',
    '--angle-shadow-soft',
    '--angle-shadow-elevated',
    '--angle-workspace-shell',
    '--angle-workspace-border',
    '--angle-workspace-text',
    '--angle-workspace-muted',
    '--angle-final-section',
    '--angle-final-background',
    '--angle-final-border',
    '--angle-final-copy',
  ];

  for (const token of requiredTokens) {
    const declaration = new RegExp(`${token}:`);
    assert.match(pageBlock, declaration, `${token} should have a light value`);
    assert.match(darkPageBlock, declaration, `${token} should have a graphite dark value`);
  }

  assert.match(darkPageBlock, /--angle-canvas:\s*#050910/);
  assert.match(darkPageBlock, /--angle-text:\s*#f4f1ea/);
  assert.doesNotMatch(darkPageBlock, /#fffaf1|#f3eee5|#ece5da/);

  for (const [selector, token] of [
    ['.hero', '--angle-hero-background'],
    ['.heroStage', '--angle-surface-translucent'],
    ['.heroStage', '--angle-hero-border'],
    ['.orbitTrack', '--angle-orbit-placeholder'],
    ['.orbitControls', '--angle-controls-text'],
    ['.orbitButton', '--angle-surface'],
    ['.orbitButton', '--angle-button-border'],
    ['.sectionRule', '--angle-border'],
    ['.sectionIntro h2', '--angle-text'],
    ['.sectionIntroBody', '--angle-text-secondary'],
    ['.textLink', '--angle-text'],
    ['.textLink', '--angle-link-decoration'],
  ] as const) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declarations = angleStylesSource.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1];
    assert.ok(declarations, `${selector} should have a style block`);
    assert.match(declarations, new RegExp(`var\\(${token}\\)`), `${selector} should consume ${token}`);
  }
});

test('Angle reduced motion neutralizes Orbit controls and hover transforms explicitly', () => {
  const reducedMotionBlock = angleStylesSource.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]+)\}\s*$/)?.[1];
  assert.ok(reducedMotionBlock, 'Angle styles should include a final reduced-motion media block');

  for (const selector of ['.orbitButton', '.orbitButton:hover', '.heroStage:hover']) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declarations = reducedMotionBlock.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1];
    assert.ok(declarations, `${selector} should have an explicit reduced-motion rule`);
    assert.match(declarations, /animation:\s*none/);
    assert.match(declarations, /transition:\s*none/);
    assert.match(declarations, /transform:\s*none/);
  }
});

test('existing marketing surfaces link to Angle with descriptive localized intent', () => {
  const hub = readFileSync(join(root, 'frontend/src/components/tools/ToolsMarketingHubPage.tsx'), 'utf8');
  const prepLinks = readFileSync(join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prep-links.ts'), 'utf8');
  assert.match(hub, /\/tools\/angle/);
  assert.match(prepLinks, /Change the camera angle before video/);
  assert.match(prepLinks, /Changer l’angle de caméra avant la vidéo/);
  assert.match(prepLinks, /Cambiar el ángulo de cámara antes del video/);
});
