import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/page.tsx';
const viewPath =
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForDetailView.tsx';
const componentBase =
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components';
const pageSource = readFileSync(routePath, 'utf8');
const viewSource = readFileSync(viewPath, 'utf8');
const topPicksSource = readFileSync(`${componentBase}/BestForTopPicksPanel.tsx`, 'utf8');
const shortlistSource = readFileSync(`${componentBase}/BestForShortlistSections.tsx`, 'utf8');
const examplesSource = readFileSync(`${componentBase}/BestForExamplesPreview.tsx`, 'utf8');
const editorialSource = readFileSync(`${componentBase}/BestForEditorialPanels.tsx`, 'utf8');
const sidebarSource = readFileSync(`${componentBase}/BestForSidebarCards.tsx`, 'utf8');
const configSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config.ts',
  'utf8'
);
const helperSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-helpers.ts',
  'utf8'
);
const helperBase = 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib';
const contentSource = readFileSync(`${helperBase}/best-for-detail-content.ts`, 'utf8');
const rankingSource = readFileSync(`${helperBase}/best-for-detail-ranking.ts`, 'utf8');
const previewSource = readFileSync(`${helperBase}/best-for-detail-previews.ts`, 'utf8');
const presentationSource = readFileSync(`${helperBase}/best-for-detail-presentation.ts`, 'utf8');
const relatedSource = readFileSync(`${helperBase}/best-for-detail-related.ts`, 'utf8');
const schemaSource = readFileSync(`${helperBase}/best-for-detail-schema.ts`, 'utf8');

test('best-for detail page delegates editorial config and data helpers', () => {
  const lineCount = pageSource.split('\n').length;

  assert.ok(lineCount < 300, `best-for detail page should stay under 300 lines after view split, got ${lineCount}`);
  assert.ok(pageSource.includes("from './_lib/best-for-detail-config'"));
  assert.ok(pageSource.includes("from './_lib/best-for-detail-helpers'"));
  assert.ok(pageSource.includes("from './_components/BestForDetailView'"));
  assert.doesNotMatch(pageSource, /const DETAIL_COPY/);
  assert.doesNotMatch(pageSource, /const USECASE_CRITERIA/);
  assert.doesNotMatch(pageSource, /async function loadEngineScores/);
  assert.doesNotMatch(pageSource, /function TopPicksPanel/);
  assert.doesNotMatch(pageSource, /function RankedShortlistCard/);
  assert.doesNotMatch(pageSource, /function ExamplesPreview/);
  assert.doesNotMatch(pageSource, /function BestForContent/);
});

test('best-for detail helper modules own config, rankings, related guides, and schema builders', () => {
  assert.match(configSource, /export const DETAIL_COPY/);
  assert.match(configSource, /export const USECASE_CRITERIA/);
  assert.ok(helperSource.split('\n').length <= 80, 'best-for detail helper facade should stay small');
  assert.match(helperSource, /from '\.\/best-for-detail-content'/);
  assert.match(helperSource, /from '\.\/best-for-detail-ranking'/);
  assert.match(helperSource, /from '\.\/best-for-detail-previews'/);
  assert.match(helperSource, /from '\.\/best-for-detail-presentation'/);
  assert.match(helperSource, /from '\.\/best-for-detail-related'/);
  assert.match(helperSource, /from '\.\/best-for-detail-schema'/);
  assert.match(contentSource, /export async function getBestForEntry/);
  assert.match(contentSource, /export async function resolveAvailableLocales/);
  assert.match(rankingSource, /const USECASE_WEIGHTS/);
  assert.match(rankingSource, /export function resolveTopPicks/);
  assert.match(rankingSource, /export function buildRankedPick/);
  assert.match(previewSource, /export async function resolveExamplePreviewPicks/);
  assert.match(presentationSource, /export function buildBestForMetaDescription/);
  assert.match(presentationSource, /export function buildUsecaseMistakes/);
  assert.match(relatedSource, /export async function resolveRelatedBestForGuides/);
  assert.match(relatedSource, /export function getAlsoAvailableModels/);
  assert.match(schemaSource, /export function buildBestForItemListJsonLd/);
});

test('best-for detail route-local view owns page sections and cards', () => {
  assert.ok(existsSync(viewPath), 'best-for detail view should live in a route-local component');
  assert.ok(viewSource.split('\n').length < 240, 'best-for detail view should stay an orchestrator');
  assert.match(viewSource, /export function BestForDetailView/);
  assert.match(viewSource, /TopPicksPanel/);
  assert.match(viewSource, /RankedShortlistCard/);
  assert.match(viewSource, /ExamplesPreview/);
  assert.match(viewSource, /EditorialReasonCard/);
  assert.match(viewSource, /BestForContent/);
  assert.match(topPicksSource, /export function TopPicksPanel/);
  assert.match(shortlistSource, /export function RankedShortlistCard/);
  assert.match(shortlistSource, /export function ChooseEngineStrip/);
  assert.match(examplesSource, /export function ExamplesPreview/);
  assert.match(examplesSource, /Image/);
  assert.match(editorialSource, /export function EditorialReasonCard/);
  assert.match(editorialSource, /export function BestForContent/);
  assert.match(sidebarSource, /export function CriteriaCard/);
  assert.match(sidebarSource, /export function RelatedGuidesCard/);
});
