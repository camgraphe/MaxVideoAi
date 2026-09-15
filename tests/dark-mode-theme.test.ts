import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import { getEnginePictogram } from '../frontend/src/lib/engine-branding.ts';

const tokensSource = readFileSync('frontend/src/styles/tokens.css', 'utf8');
const themeTokensSource = readFileSync('frontend/lib/theme-tokens.ts', 'utf8');
const globalsSource = readFileSync('frontend/app/globals.css', 'utf8');
const homeSource = [
  readFileSync('frontend/components/marketing/home/HomeRedesignSections.tsx', 'utf8'),
  readFileSync('frontend/components/marketing/home/HomeHeroSection.tsx', 'utf8'),
  readFileSync('frontend/components/marketing/home/HomeShotTypeEngineSelector.tsx', 'utf8'),
  readFileSync('frontend/components/marketing/home/HomeRealExamplesPreview.tsx', 'utf8'),
  readFileSync('frontend/components/marketing/home/HomeConversionSections.tsx', 'utf8'),
].join('\n');
const heroShowcaseSource = readFileSync('frontend/components/marketing/home/HeroVideoShowcase.tsx', 'utf8');
const navSource = readFileSync('frontend/components/marketing/MarketingNav.tsx', 'utf8');
const buttonSource = readFileSync('frontend/components/ui/Button.tsx', 'utf8');
const toolsHubSource = readFileSync('frontend/src/components/tools/ToolsMarketingHubPage.tsx', 'utf8');
const blogPageSource = readFileSync('frontend/app/(localized)/[locale]/(marketing)/blog/page.tsx', 'utf8');
const comparePageSource = readFileSync('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/page.tsx', 'utf8');
const marketingHeroImageSource = readFileSync('frontend/components/marketing/MarketingHeroImage.tsx', 'utf8');

const lightTokenBlock = tokensSource.slice(tokensSource.indexOf(':root {'), tokensSource.indexOf('\n}\n\n@media'));
const darkTokenBlock = tokensSource.slice(tokensSource.indexOf('[data-theme="dark"] {'), tokensSource.indexOf('\n}\n\n.card'));

test('dark mode uses the reference deep navy palette without changing light tokens', () => {
  assert.match(lightTokenBlock, /--bg: #F6F8FC;/);
  assert.match(lightTokenBlock, /--surface: #FFFFFF;/);
  assert.match(lightTokenBlock, /--text-primary: #111827;/);

  assert.match(darkTokenBlock, /--bg: #050B14;/);
  assert.match(darkTokenBlock, /--surface: #0B1424;/);
  assert.match(darkTokenBlock, /--surface-2: #101B2E;/);
  assert.match(darkTokenBlock, /--surface-3: #15233A;/);
  assert.match(darkTokenBlock, /--surface-glass-80: rgba\(11, 20, 36, 0\.80\);/);
  assert.match(darkTokenBlock, /--hairline: rgba\(148, 163, 184, 0\.14\);/);
  assert.match(darkTokenBlock, /--accent: #8FB7FF;/);
  assert.match(darkTokenBlock, /--shadow-card: 0 1px 0 rgba\(255,255,255,\.04\), 0 24px 70px rgba\(0,0,0,\.34\);/);

  assert.doesNotMatch(darkTokenBlock, /--bg: #0A111E;/);
  assert.doesNotMatch(darkTokenBlock, /--surface-glass-80: #111A2C;/);
});

test('engine brand ids used by catalog have theme tokens in light and dark modes', () => {
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const brandIds = [...new Set(engineCatalog.map((entry) => entry.brandId).filter(Boolean))].sort();

  for (const brandId of brandIds) {
    const escaped = escapeRegExp(brandId);
    assert.match(lightTokenBlock, new RegExp(`--engine-${escaped}-bg: #[0-9A-Fa-f]{6};`));
    assert.match(lightTokenBlock, new RegExp(`--engine-${escaped}-ink: #[0-9A-Fa-f]{6};`));
    assert.match(darkTokenBlock, new RegExp(`--engine-${escaped}-bg: #[0-9A-Fa-f]{6};`));
    assert.match(darkTokenBlock, new RegExp(`--engine-${escaped}-ink: #[0-9A-Fa-f]{6};`));
    assert.match(themeTokensSource, new RegExp(`key: 'engine-${escaped}-bg'`));
    assert.match(themeTokensSource, new RegExp(`key: 'engine-${escaped}-ink'`));
  }
});

test('xAI and Black Forest Labs cards consume their semantic theme tokens', () => {
  assert.deepEqual(getEnginePictogram({ brandId: 'xai', label: 'Grok Imagine Video' }), {
    code: 'Gr',
    backgroundColor: 'var(--engine-xai-bg)',
    textColor: 'var(--engine-xai-ink)',
  });
  assert.deepEqual(getEnginePictogram({ brandId: 'black-forest-labs', label: 'FLUX 3 Video' }), {
    code: 'Fl',
    backgroundColor: 'var(--engine-black-forest-labs-bg)',
    textColor: 'var(--engine-black-forest-labs-ink)',
  });
});

test('global dark background adds reference-style depth while light remains plain token background', () => {
  assert.match(globalsSource, /body \{\n  @apply bg-bg text-text-primary antialiased font-sans;\n  background: var\(--bg\);\n\}/);
  assert.match(globalsSource, /\[data-theme="dark"\] body \{\n  background:\n    radial-gradient\(1200px 720px at 78% -10%, rgba\(255, 255, 255, 0\.035\), transparent 64%\),/);
  assert.match(globalsSource, /radial-gradient\(920px 620px at 100% 12%, rgba\(125, 211, 252, 0\.025\), transparent 58%\),/);
  assert.match(globalsSource, /linear-gradient\(180deg, #030712 0%, #040816 46%, #030712 100%\);/);
  assert.match(globalsSource, /background-attachment: fixed;/);
  assert.match(globalsSource, /\[data-theme="dark"\] \.home-monochrome \{[\s\S]*--surface-glass-80: rgba\(11, 20, 36, 0\.80\);/);
});

test('dark gradients are strongly attenuated while CTAs stay bright like the reference', () => {
  assert.match(globalsSource, /radial-gradient\(1200px 720px at 78% -10%, rgba\(255, 255, 255, 0\.035\), transparent 64%\),/);
  assert.match(globalsSource, /radial-gradient\(920px 620px at 100% 12%, rgba\(125, 211, 252, 0\.025\), transparent 58%\),/);
  assert.match(globalsSource, /background-image: radial-gradient\(760px 320px at 50% 0%, rgba\(255, 255, 255, 0\.030\), transparent 66%\);/);
  assert.match(darkTokenBlock, /--brand-gradient: linear-gradient\(135deg, #FFFFFF 0%, #F8FAFC 62%, #E5E7EB 100%\);/);
  assert.match(darkTokenBlock, /--brand-gradient-strong: linear-gradient\(135deg, #FFFFFF 0%, #FFFFFF 54%, #F1F5F9 100%\);/);
  assert.match(buttonSource, /dark:border-white\/\[0\.24\] dark:bg-white\/\[0\.045\] dark:text-white/);
  assert.doesNotMatch(globalsSource, /rgba\(59, 130, 246, 0\.10\)/);
  assert.doesNotMatch(globalsSource, /rgba\(168, 85, 247, 0\.06\)/);
});





test('homepage workflow cards avoid light image wash in dark mode', () => {
  const referenceWorkflowSource = homeSource.slice(homeSource.indexOf('export function ReferenceWorkflow'), homeSource.indexOf('export function AiVideoToolbox'));

  assert.match(referenceWorkflowSource, /dark:opacity-\[0\.28\]/);
  assert.match(referenceWorkflowSource, /dark:brightness-\[0\.72\]/);
  assert.match(referenceWorkflowSource, /rgba\(3,7,18,0\.96\)_0%/);
  assert.match(referenceWorkflowSource, /rgba\(3,7,18,0\.88\)_100%/);
  assert.doesNotMatch(referenceWorkflowSource, /dark:invert/);
  assert.doesNotMatch(referenceWorkflowSource, /rgba\(5,11,20,0\.66\)_100%/);
});


test('decorative marketing hero images stay hidden from assistive tech', () => {
  assert.match(marketingHeroImageSource, /<div aria-hidden=\{alt \? undefined : 'true'\}/);
  assert.match(marketingHeroImageSource, /alt=\{alt\}[\s\S]*aria-hidden=\{alt \? undefined : 'true'\}/);
});

test('marketing navigation dark mode is translucent like the reference header', () => {
  assert.match(
    navSource,
    /'sticky top-0 z-40 border-b border-hairline bg-surface dark:bg-surface-glass-90 dark:backdrop-blur-xl'/
  );
});

test('marketing navigation authenticated generate CTA turns white in dark mode', () => {
  assert.match(navSource, /marketing_nav_start_app/);
  assert.match(navSource, /dark:bg-white dark:text-\[#030712\]/);
  assert.match(navSource, /dark:hover:bg-slate-100/);
});

// D85 gives marketing a fixed palette; the app keeps its independent dark theme.
test('cinema hero uses the fixed ivory surface and subdued player without ambient neon', () => {
  const cinema = readFileSync('frontend/src/styles/marketing-cinema.css', 'utf8');
  const hero = readFileSync('frontend/components/marketing/home/HomeHeroSection.tsx', 'utf8');
  assert.match(hero, /home-hero-section cinema-opening/);
  assert.doesNotMatch(hero, /home-hero-dark-grid|dark-section-neon/);
  assert.match(cinema, /\.marketing-site \.cinema-opening\{background:#f4f2ee/);
  assert.match(cinema, /\.marketing-site \.cinema-player>div:first-child>div.absolute\{display:none\}/);
  assert.match(cinema, /\.marketing-site \.cinema-player \[data-hero-player\]\{border:0/);
});

test('tools hero uses the actual catalogue artwork in a fixed composition', () => {
  assert.match(toolsHubSource, /tools-hub-montage/);
  assert.match(toolsHubSource, /WORKSHOP_ART\['character-builder'\]/);
  assert.match(toolsHubSource, /WORKSHOP_ART.angle/);
  assert.match(toolsHubSource, /QUICK_TOOL_ART\['upscale-image'\]/);
  assert.match(toolsHubSource, /aria-hidden="true"/);
  assert.doesNotMatch(toolsHubSource, /tools-hero-reference-dark|dark:invert/);
});
