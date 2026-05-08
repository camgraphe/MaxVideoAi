import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const angleWrapperPath = join(root, 'frontend/src/components/tools/AngleLandingPage.tsx');
const characterWrapperPath = join(root, 'frontend/src/components/tools/CharacterBuilderLandingPage.tsx');
const angleViewPath = join(root, 'frontend/src/components/tools/angle/landing/AngleLandingView.tsx');
const characterViewPath = join(root, 'frontend/src/components/tools/character-builder/landing/CharacterBuilderLandingView.tsx');
const jsonLdPath = join(root, 'frontend/src/components/tools/landing/tool-marketing-json-ld.ts');
const angleRoutePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/tools/angle/page.tsx');
const characterRoutePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/tools/character-builder/page.tsx');

const angleWrapperSource = readFileSync(angleWrapperPath, 'utf8');
const characterWrapperSource = readFileSync(characterWrapperPath, 'utf8');
const angleViewSource = readFileSync(angleViewPath, 'utf8');
const characterViewSource = readFileSync(characterViewPath, 'utf8');
const jsonLdSource = readFileSync(jsonLdPath, 'utf8');

test('tool marketing landing entry files stay thin wrappers', () => {
  assert.ok(existsSync(angleViewPath), 'angle landing view should live in the angle landing folder');
  assert.ok(existsSync(characterViewPath), 'character builder landing view should live in the character builder landing folder');

  assert.match(angleWrapperSource, /AngleLandingView/, 'angle wrapper should delegate to the colocated view');
  assert.match(characterWrapperSource, /CharacterBuilderLandingView/, 'character wrapper should delegate to the colocated view');

  for (const [label, source] of [
    ['AngleLandingPage', angleWrapperSource],
    ['CharacterBuilderLandingPage', characterWrapperSource],
  ] as const) {
    assert.ok(source.split('\n').length <= 12, `${label} should stay a thin route-facing wrapper`);
    assert.doesNotMatch(source, /FAQSchema|buildMarketingServiceJsonLd|dangerouslySetInnerHTML|next\/image/, `${label} should not own landing rendering or SEO scripts`);
  }
});

test('tool marketing landing views own feature rendering and shared JSON-LD helpers', () => {
  assert.match(angleViewSource, /export function AngleLandingView/, 'angle view should export the render surface');
  assert.match(characterViewSource, /export function CharacterBuilderLandingView/, 'character builder view should export the render surface');

  for (const [label, source] of [
    ['AngleLandingView', angleViewSource],
    ['CharacterBuilderLandingView', characterViewSource],
  ] as const) {
    assert.match(source, /buildToolBreadcrumbJsonLd/, `${label} should use the shared breadcrumb JSON-LD helper`);
    assert.match(source, /buildToolHowToJsonLd/, `${label} should use the shared HowTo JSON-LD helper`);
    assert.match(source, /FAQSchema/, `${label} should keep FAQ schema rendering`);
    assert.match(source, /data-analytics-event="tool_cta_click"/, `${label} should preserve CTA analytics attributes`);
    assert.doesNotMatch(source, /function serializeJsonLd/, `${label} should not define duplicate JSON-LD serializers`);
  }

  assert.match(jsonLdSource, /export function serializeJsonLd/, 'JSON-LD helper should expose safe serialization');
  assert.match(jsonLdSource, /export function buildToolBreadcrumbJsonLd/, 'JSON-LD helper should build breadcrumbs');
  assert.match(jsonLdSource, /export function buildToolHowToJsonLd/, 'JSON-LD helper should build HowTo schema');
  assert.match(jsonLdSource, /#step-\$\{index \+ 1\}/, 'HowTo helper should preserve step anchor URLs');
});

test('localized tool routes keep importing stable landing entry points', () => {
  const angleRouteSource = readFileSync(angleRoutePath, 'utf8');
  const characterRouteSource = readFileSync(characterRoutePath, 'utf8');

  assert.match(angleRouteSource, /@\/components\/tools\/AngleLandingPage/, 'angle route should keep the stable landing import');
  assert.match(characterRouteSource, /@\/components\/tools\/CharacterBuilderLandingPage/, 'character builder route should keep the stable landing import');
});
