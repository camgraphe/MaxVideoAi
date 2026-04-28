import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const tokensSource = readFileSync('frontend/src/styles/tokens.css', 'utf8');
const globalsSource = readFileSync('frontend/app/globals.css', 'utf8');
const homeSource = readFileSync('frontend/components/marketing/home/HomeRedesignSections.tsx', 'utf8');
const navSource = readFileSync('frontend/components/marketing/MarketingNav.tsx', 'utf8');

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
  assert.match(globalsSource, /\[data-theme="dark"\] body \{\n  background:\n    radial-gradient\(1200px 720px at 78% -10%, rgba\(80, 112, 255, 0\.20\), transparent 58%\),/);
  assert.match(globalsSource, /radial-gradient\(920px 620px at 100% 12%, rgba\(168, 85, 247, 0\.13\), transparent 52%\),/);
  assert.match(globalsSource, /linear-gradient\(180deg, #050b14 0%, #07111f 46%, #050b14 100%\);/);
  assert.match(globalsSource, /background-attachment: fixed;/);
  assert.match(globalsSource, /\[data-theme="dark"\] \.home-monochrome \{[\s\S]*--surface-glass-80: rgba\(11, 20, 36, 0\.80\);/);
});

test('homepage dark mode follows the reference with luminous hero and tokenized glass surfaces', () => {
  const homeHeroSource = homeSource.slice(homeSource.indexOf('export function HomeHero'), homeSource.indexOf('export function ProofBar'));

  assert.match(homeHeroSource, /<section className="home-hero-section relative overflow-hidden border-b border-hairline bg-bg">/);
  assert.match(homeHeroSource, /radial-gradient\(ellipse_at_78%_16%,rgba\(89,125,255,0\.22\),transparent_42%\)/);
  assert.match(homeHeroSource, /radial-gradient\(ellipse_at_94%_26%,rgba\(168,85,247,0\.16\),transparent_40%\)/);
  assert.match(homeSource, /dark:bg-surface-glass-80/);
  assert.match(homeSource, /dark:bg-surface-glass-70/);
  assert.doesNotMatch(homeSource, /dark:bg-white\/\[0\.055\]/);
});

test('marketing navigation dark mode is translucent like the reference header', () => {
  assert.match(
    navSource,
    /'sticky top-0 z-40 border-b border-hairline bg-surface dark:bg-surface-glass-90 dark:backdrop-blur-xl'/
  );
});
