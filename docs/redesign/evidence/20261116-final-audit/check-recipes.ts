import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { getImageEditorialPreset } from '../../../../frontend/lib/image/editorial-presets';
import { getVideoEditorialPreset } from '../../../../frontend/lib/video/editorial-presets';

const pages = JSON.parse(readFileSync('docs/redesign/evidence/20261116-final-audit/localized-journeys.json', 'utf8'));
let recipeLinks = 0;
for (const page of pages) for (const link of page.ctaLinks) {
  const url = new URL(link.href, 'https://maxvideoai.com');
  const id = url.searchParams.get('example') ?? url.searchParams.get('videoPrompt');
  if (!id) continue;
  const engine = url.searchParams.get('engine')!;
  const preset = url.pathname === '/app/image' ? getImageEditorialPreset(engine, id) : getVideoEditorialPreset(engine, id);
  assert.ok(preset, link.href);
  assert.ok(preset.snapshot.prompt.length > 20);
  recipeLinks++;
}
const result = { routes: pages.length, recipeLinks, allResolve: true };
writeFileSync('docs/redesign/evidence/20261116-final-audit/recipes.json', JSON.stringify(result, null, 2));
console.log(result);
