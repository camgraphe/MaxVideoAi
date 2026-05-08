import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const layoutPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx');
const prepLinksPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prep-links.ts');
const schemaPayloadsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema-payloads.ts');
const prepLinksSectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPrepLinksSection.tsx');

const readSource = (path: string) => readFileSync(path, 'utf8');
const lineCount = (source: string) => source.split('\n').length;

test('model page layout delegates prep link copy and schema payload composition', () => {
  for (const path of [layoutPath, prepLinksPath, schemaPayloadsPath, prepLinksSectionPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const layoutSource = readSource(layoutPath);
  const prepLinksSource = readSource(prepLinksPath);
  const schemaSource = readSource(schemaPayloadsPath);
  const prepLinksSectionSource = readSource(prepLinksSectionPath);

  assert.match(layoutSource, /buildModelPrepLinksSection/, 'layout should delegate prep link copy selection');
  assert.match(layoutSource, /buildModelSchemaPayloads/, 'layout should delegate schema payload composition');
  assert.doesNotMatch(layoutSource, /NANO_BANANA_MODEL_SLUGS|VIDEO_PREP_MODEL_SLUGS|itemListElement/, 'layout should not own prep link copy tables or JSON-LD internals');
  assert.match(prepLinksSource, /NANO_BANANA_MODEL_SLUGS|VIDEO_PREP_MODEL_SLUGS|export function buildModelPrepLinksSection/, 'prep link helper should own localized prep link rules');
  assert.match(schemaSource, /buildProductSchema|BreadcrumbList|export function buildModelSchemaPayloads/, 'schema helper should own JSON-LD payloads');
  assert.match(prepLinksSectionSource, /export type PrepLinksSection/, 'prep links section should export its contract');
});

test('model page layout stays below the route orchestration threshold', () => {
  const layoutSource = readSource(layoutPath);
  const prepLinksSource = readSource(prepLinksPath);
  const schemaSource = readSource(schemaPayloadsPath);

  assert.ok(lineCount(layoutSource) <= 500, `MarketingModelPageLayout should stay below 500 lines, got ${lineCount(layoutSource)}`);
  assert.ok(lineCount(prepLinksSource) <= 120, `model-page-prep-links should stay below 120 lines, got ${lineCount(prepLinksSource)}`);
  assert.ok(lineCount(schemaSource) <= 100, `model-page-schema-payloads should stay below 100 lines, got ${lineCount(schemaSource)}`);
});
