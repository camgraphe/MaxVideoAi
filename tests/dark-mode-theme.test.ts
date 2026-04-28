import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const tokensSource = readFileSync('frontend/src/styles/tokens.css', 'utf8');
const globalsSource = readFileSync('frontend/app/globals.css', 'utf8');
const homeSource = readFileSync('frontend/components/marketing/home/HomeRedesignSections.tsx', 'utf8');
const heroShowcaseSource = readFileSync('frontend/components/marketing/home/HeroVideoShowcase.tsx', 'utf8');
const navSource = readFileSync('frontend/components/marketing/MarketingNav.tsx', 'utf8');
const buttonSource = readFileSync('frontend/components/ui/Button.tsx', 'utf8');
const toolsHubSource = readFileSync('frontend/src/components/tools/ToolsMarketingHubPage.tsx', 'utf8');
const pricingPageSource = readFileSync('frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx', 'utf8');
const blogPageSource = readFileSync('frontend/app/(localized)/[locale]/(marketing)/blog/page.tsx', 'utf8');
const comparePageSource = readFileSync('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/page.tsx', 'utf8');

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

test('homepage dark sections use a darker base and reusable neon contour treatment', () => {
  const sectionNeonMatches = homeSource.match(/dark-section-neon/g) ?? [];

  assert.match(globalsSource, /linear-gradient\(180deg, #030712 0%, #040816 46%, #030712 100%\);/);
  assert.match(globalsSource, /\[data-theme="dark"\] \.dark-section-neon::before/);
  assert.match(globalsSource, /\[data-theme="dark"\] \.dark-neon-panel/);
  assert.match(globalsSource, /rgba\(96, 165, 250, 0\.46\)/);
  assert.match(globalsSource, /rgba\(217, 70, 239, 0\.30\)/);
  assert.ok(sectionNeonMatches.length >= 9, `Expected dark-section-neon on each homepage section, saw ${sectionNeonMatches.length}`);
  assert.match(homeSource, /dark-neon-panel/);
  assert.doesNotMatch(globalsSource, /rgba\(80, 112, 255, 0\.20\)/);
  assert.doesNotMatch(globalsSource, /rgba\(168, 85, 247, 0\.13\)/);
});

test('homepage dark mode follows the reference with luminous hero and tokenized glass surfaces', () => {
  const homeHeroSource = homeSource.slice(homeSource.indexOf('export function HomeHero'), homeSource.indexOf('export function ProofBar'));

  assert.match(homeHeroSource, /<section className="home-hero-section dark-section-neon relative overflow-hidden border-b border-hairline bg-bg">/);
  assert.match(homeHeroSource, /radial-gradient\(ellipse_at_78%_16%,rgba\(255,255,255,0\.055\),transparent_46%\)/);
  assert.match(homeHeroSource, /radial-gradient\(ellipse_at_94%_26%,rgba\(125,211,252,0\.035\),transparent_42%\)/);
  assert.match(homeSource, /dark:bg-surface-glass-80/);
  assert.match(homeSource, /dark:bg-surface-glass-70/);
  assert.doesNotMatch(homeSource, /dark:bg-white\/\[0\.055\]/);
});

test('homepage hero preview uses subdued dark borders instead of bright white outlines', () => {
  const homeHeroSource = homeSource.slice(homeSource.indexOf('export function HomeHero'), homeSource.indexOf('export function ProofBar'));

  assert.match(globalsSource, /\.home-hero-dark-grid/);
  assert.match(homeHeroSource, /home-hero-dark-grid/);
  assert.match(homeHeroSource, /dark:bg-\[linear-gradient\(135deg,rgba\(15,23,42,0\.78\),rgba\(30,41,59,0\.32\)\)\]/);
  assert.match(homeHeroSource, /dark:shadow-\[inset_0_1px_0_rgba\(255,255,255,0\.04\),0_18px_50px_-34px_rgba\(0,0,0,0\.9\)\]/);
  assert.doesNotMatch(homeHeroSource, /VALUE_CARD_ICONS/);
  assert.doesNotMatch(homeHeroSource, /copy\.trustBadges/);
  assert.match(heroShowcaseSource, /<div className="relative">\n        <div className="absolute -inset-3 rounded-\[34px\][\s\S]*blur-xl[\s\S]*rgba\(217,70,239,0\.13\)/);
  assert.match(heroShowcaseSource, /dark:bg-\[linear-gradient\(135deg,rgba\(96,165,250,0\.74\)_0%,rgba\(125,211,252,0\.36\)_43%,rgba\(217,70,239,0\.76\)_100%\)\]/);
  assert.match(heroShowcaseSource, /dark:opacity-80 dark:shadow-\[0_0_18px_rgba\(96,165,250,0\.20\),22px_-14px_34px_-22px_rgba\(217,70,239,0\.58\)\]/);
  assert.match(heroShowcaseSource, /data-hero-player="main"[\s\S]*dark:border-\[rgba\(147,197,253,0\.30\)\]/);
  assert.match(heroShowcaseSource, /dark:shadow-\[0_0_0_1px_rgba\(96,165,250,0\.18\),0_0_36px_-20px_rgba\(59,130,246,0\.62\)/);
  assert.match(heroShowcaseSource, /22px_-18px_46px_-32px_rgba\(217,70,239,0\.74\)/);
  assert.match(heroShowcaseSource, /-18px_6px_44px_-32px_rgba\(96,165,250,0\.58\)/);
  assert.match(heroShowcaseSource, /dark:border-white\/\[0\.14\]/);
  assert.match(heroShowcaseSource, /dark:border-white\/\[0\.18\]/);
  assert.match(heroShowcaseSource, /dark:border-white\/\[0\.08\]/);
  assert.match(heroShowcaseSource, /dark:hover:border-white\/\[0\.16\]/);
  assert.match(heroShowcaseSource, /dark:focus:ring-\[rgba\(143,183,255,0\.34\)\]/);
  assert.match(heroShowcaseSource, /dark:bg-surface-glass-70/);
  assert.match(homeHeroSource, /dark:border-white\/\[0\.08\]/);
  assert.match(homeHeroSource, /dark:bg-white\/\[0\.035\]/);
  assert.match(heroShowcaseSource, /focus:ring-white\/90/);
  assert.match(heroShowcaseSource, /focus:ring-white\/80/);

  assert.doesNotMatch(heroShowcaseSource, /dark:border-white\/70/);
  assert.doesNotMatch(heroShowcaseSource, /dark:shadow-\[0_0_0_2px_rgba\(255,255,255,0\.20\)/);
  assert.doesNotMatch(heroShowcaseSource, /0_0_72px_-20px_rgba\(96,165,250,0\.88\)/);
  assert.doesNotMatch(heroShowcaseSource, /0_0_70px_-22px_rgba\(59,130,246,0\.80\)/);
  assert.doesNotMatch(heroShowcaseSource, /28px_-24px_76px_-26px_rgba\(217,70,239,0\.82\)/);
  assert.doesNotMatch(heroShowcaseSource, /rgba\(45,212,191,0\.34\)/);
  assert.doesNotMatch(heroShowcaseSource, /rgba\(34,211,238,0\.82\)/);
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

test('tools pricing and blog hero images use compare-style derived dark assets', () => {
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heroAssets = [
    {
      name: 'tools',
      source: toolsHubSource,
      lightUrl: '/assets/tools/tools-hero-reference.webp',
      darkUrl: '/assets/tools/tools-hero-reference-dark.webp',
      darkFile: 'frontend/public/assets/tools/tools-hero-reference-dark.webp',
      overlay:
        /dark:bg-\[radial-gradient\(circle_at_50%_38%,rgba\(3,7,18,0\.24\)_0%,rgba\(3,7,18,0\.16\)_42%,rgba\(3,7,18,0\.05\)_76%,rgba\(3,7,18,0\.00\)_100%\)\]/,
    },
    {
      name: 'pricing',
      source: pricingPageSource,
      lightUrl: '/assets/pricing/pricing-hero-reference.webp',
      darkUrl: '/assets/pricing/pricing-hero-reference-dark.webp',
      darkFile: 'frontend/public/assets/pricing/pricing-hero-reference-dark.webp',
      overlay:
        /dark:bg-\[radial-gradient\(circle_at_50%_38%,rgba\(3,7,18,0\.24\)_0%,rgba\(3,7,18,0\.16\)_42%,rgba\(3,7,18,0\.05\)_76%,rgba\(3,7,18,0\.00\)_100%\)\]/,
    },
    {
      name: 'blog',
      source: blogPageSource,
      lightUrl: '/assets/blog/blog-hero-reference.webp',
      darkUrl: '/assets/blog/blog-hero-reference-dark.webp',
      darkFile: 'frontend/public/assets/blog/blog-hero-reference-dark.webp',
      overlay:
        /dark:bg-\[linear-gradient\(90deg,rgba\(3,7,18,0\.30\)_0%,rgba\(3,7,18,0\.18\)_42%,rgba\(3,7,18,0\.05\)_76%,rgba\(3,7,18,0\.00\)_100%\)\]/,
    },
  ] as const;

  assert.match(comparePageSource, /compare-hero-reference-light\.webp/);
  assert.match(comparePageSource, /dark:bg-\[url\('\/assets\/compare\/compare-hero-reference-dark\.webp'\)\] dark:opacity-70/);

  for (const hero of heroAssets) {
    assert.ok(existsSync(hero.darkFile), `${hero.name} should have a derived dark hero asset`);
    assert.match(hero.source, new RegExp(`bg-\\[url\\('${escapeRegExp(hero.lightUrl)}'\\)\\]`));
    assert.match(hero.source, new RegExp(`dark:bg-\\[url\\('${escapeRegExp(hero.darkUrl)}'\\)\\] dark:opacity-70`));
    assert.match(hero.source, hero.overlay);
    assert.doesNotMatch(hero.source, /dark:(brightness|contrast|saturate|invert)/, `${hero.name} should use a dark asset instead of CSS image filters`);
  }
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
