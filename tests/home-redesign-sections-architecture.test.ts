import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/components/marketing/home/HomeRedesignSections.tsx');
const heroPath = join(root, 'frontend/components/marketing/home/HomeHeroSection.tsx');
const shotTypePath = join(root, 'frontend/components/marketing/home/HomeShotTypeEngineSelector.tsx');
const examplesPath = join(root, 'frontend/components/marketing/home/HomeRealExamplesPreview.tsx');
const startupPath = join(root, 'frontend/components/marketing/home/HomeStartupFameLink.tsx');

const readSource = (path: string) => readFileSync(path, 'utf8');
const lineCount = (source: string) => source.split('\n').length;

test('home redesign sections facade delegates focused homepage sections', () => {
  for (const path of [facadePath, heroPath, shotTypePath, examplesPath, startupPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const facadeSource = readSource(facadePath);
  const heroSource = readSource(heroPath);
  const shotTypeSource = readSource(shotTypePath);
  const examplesSource = readSource(examplesPath);
  const startupSource = readSource(startupPath);

  assert.match(facadeSource, /export \{ HomeHero \}/, 'facade should re-export HomeHero');
  assert.match(facadeSource, /export \{ ShotTypeEngineSelector \}/, 'facade should re-export ShotTypeEngineSelector');
  assert.match(facadeSource, /export \{ RealExamplesPreview \}/, 'facade should re-export RealExamplesPreview');
  assert.doesNotMatch(facadeSource, /function buildHeroVideoItems|BEST_FOR_CARD_VISUALS|examples\.map/, 'facade should not own section rendering internals');
  assert.match(heroSource, /buildHeroVideoItems|HeroVideoShowcase|PROOF_ICONS/, 'hero section should own hero media and proof stats');
  assert.match(shotTypeSource, /BEST_FOR_CARD_VISUALS|formatBestForPickLabel|StartupFameLink/, 'shot type selector should own best-for cards');
  assert.match(examplesSource, /HomeExamplePreviewRow|HomeExampleProviders|examples\.map/, 'examples preview should own preview rows and providers');
  assert.match(startupSource, /startupfa\.me/, 'startup link should own external attribution link');
});

test('home redesign section modules stay focused', () => {
  const facadeSource = readSource(facadePath);
  const heroSource = readSource(heroPath);
  const shotTypeSource = readSource(shotTypePath);
  const examplesSource = readSource(examplesPath);
  const startupSource = readSource(startupPath);

  assert.ok(lineCount(facadeSource) <= 50, `HomeRedesignSections facade should stay below 50 lines, got ${lineCount(facadeSource)}`);
  assert.ok(lineCount(heroSource) <= 290, `HomeHeroSection should stay below 290 lines, got ${lineCount(heroSource)}`);
  assert.ok(lineCount(shotTypeSource) <= 180, `HomeShotTypeEngineSelector should stay below 180 lines, got ${lineCount(shotTypeSource)}`);
  assert.ok(lineCount(examplesSource) <= 230, `HomeRealExamplesPreview should stay below 230 lines, got ${lineCount(examplesSource)}`);
  assert.ok(lineCount(startupSource) <= 40, `HomeStartupFameLink should stay below 40 lines, got ${lineCount(startupSource)}`);
});
