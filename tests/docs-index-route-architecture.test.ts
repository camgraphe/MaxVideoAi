import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(localized)/[locale]/(marketing)/docs/page.tsx';
const viewPath = 'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsIndexView.tsx';
const tocNavPath = 'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsTocNav.tsx';
const sectionsPath = 'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsSectionsGrid.tsx';
const libraryPath = 'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsLibrarySection.tsx';
const feedbackPath = 'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsFeedbackSection.tsx';
const jsonLdScriptsPath = 'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsJsonLdScripts.tsx';
const seeAlsoPath = 'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsSeeAlsoLinks.tsx';
const dataPath = 'frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-index-data.ts';
const jsonLdPath = 'frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-index-jsonld.ts';

test('localized docs index page stays a route orchestrator', () => {
  for (const file of [
    pagePath,
    viewPath,
    tocNavPath,
    sectionsPath,
    libraryPath,
    feedbackPath,
    jsonLdScriptsPath,
    seeAlsoPath,
    dataPath,
    jsonLdPath,
  ]) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.match(pageSource, /generateMetadata/);
  assert.match(pageSource, /buildSeoMetadata/);
  assert.match(pageSource, /buildMetadataUrls/);
  assert.match(pageSource, /getDocsEntries/);
  assert.match(pageSource, /DocsIndexView/);
  assert.match(pageSource, /export const revalidate = 600/);
  assert.doesNotMatch(pageSource, /getContentEntries/);
  assert.doesNotMatch(pageSource, /resolveDocsLastUpdated/);
  assert.doesNotMatch(pageSource, /FEATURES/);
  assert.doesNotMatch(pageSource, /FlagPill/);
  assert.doesNotMatch(pageSource, /Callout/);
  assert.doesNotMatch(pageSource, /DocsTocActive/);
  assert.doesNotMatch(pageSource, /sections\.map/);
  assert.doesNotMatch(pageSource, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(pageSource, /'@type': 'CollectionPage'/);
  assert.ok(pageLines <= 80, `expected docs index page below 80 lines, got ${pageLines}`);
});

test('localized docs index data and schema helpers own route logic', () => {
  const dataSource = readFileSync(dataPath, 'utf8');
  const jsonLdSource = readFileSync(jsonLdPath, 'utf8');

  for (const exportName of [
    'getDocsEntries',
    'resolveDocsLastUpdated',
    'buildDocsTocLinks',
    'buildDocsIndexViewModel',
  ]) {
    assert.match(dataSource, new RegExp(`export (?:async )?function ${exportName}\\(`), `${exportName} should be exported`);
  }

  assert.match(dataSource, /export const DOCS_SECTION_ORDER/);
  assert.match(dataSource, /getContentEntries/);
  assert.match(dataSource, /FEATURES\.docs/);
  assert.match(jsonLdSource, /export function buildDocsCollectionJsonLd/);
  assert.match(jsonLdSource, /export function buildDocsBreadcrumbJsonLd/);
  assert.match(jsonLdSource, /export function buildDocsFaqJsonLd/);
  assert.match(jsonLdSource, /'@type': 'CollectionPage'/);
  assert.match(jsonLdSource, /'@type': 'BreadcrumbList'/);
  assert.match(jsonLdSource, /'@type': 'FAQPage'/);
});

test('localized docs index components own rendering surfaces', () => {
  const viewSource = readFileSync(viewPath, 'utf8');
  const tocNavSource = readFileSync(tocNavPath, 'utf8');
  const sectionsSource = readFileSync(sectionsPath, 'utf8');
  const librarySource = readFileSync(libraryPath, 'utf8');
  const feedbackSource = readFileSync(feedbackPath, 'utf8');
  const jsonLdScriptsSource = readFileSync(jsonLdScriptsPath, 'utf8');
  const seeAlsoSource = readFileSync(seeAlsoPath, 'utf8');

  assert.match(viewSource, /export function DocsIndexView/);
  assert.match(viewSource, /buildDocsIndexViewModel/);
  assert.match(viewSource, /DocsTocNav/);
  assert.match(viewSource, /DocsSectionsGrid/);
  assert.match(viewSource, /DocsLibrarySection/);
  assert.match(viewSource, /DocsFeedbackSection/);
  assert.match(viewSource, /DocsJsonLdScripts/);
  assert.match(tocNavSource, /DocsTocActive/);
  assert.match(sectionsSource, /export function DocsSectionsGrid/);
  assert.match(sectionsSource, /function DocsSectionItem/);
  assert.match(sectionsSource, /Callout/);
  assert.match(librarySource, /export function DocsLibrarySection/);
  assert.match(librarySource, /FlagPill/);
  assert.match(feedbackSource, /export function DocsFeedbackSection/);
  assert.match(jsonLdScriptsSource, /dangerouslySetInnerHTML/);
  assert.match(seeAlsoSource, /export function DocsSeeAlsoLinks/);
});
