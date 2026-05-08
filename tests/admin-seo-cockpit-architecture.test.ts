import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/admin/seo/cockpit/page.tsx';
const viewPath = 'frontend/app/(core)/admin/seo/cockpit/_components/SeoCockpitView.tsx';
const commandDeckPath = 'frontend/app/(core)/admin/seo/cockpit/_components/SeoCockpitCommandDeck.tsx';
const actionCardsPath = 'frontend/app/(core)/admin/seo/cockpit/_components/SeoCockpitActionCards.tsx';

test('admin SEO cockpit page stays a route orchestrator', () => {
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(viewPath), true);
  assert.equal(existsSync(commandDeckPath), true);
  assert.equal(existsSync(actionCardsPath), true);

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.ok(pageLines < 90, `expected SEO cockpit page to stay under 90 lines, got ${pageLines}`);
  assert.match(pageSource, /from '\.\/_components\/SeoCockpitView';/);
  assert.match(pageSource, /fetchSeoCockpitData\(/);
  assert.match(pageSource, /fetchUrlInspectionDashboardData\(/);
  assert.match(pageSource, /buildUnifiedActionBriefs\(/);
  assert.doesNotMatch(pageSource, /<AdminPageHeader/);
  assert.doesNotMatch(pageSource, /function PageActionBriefCard/);
  assert.doesNotMatch(pageSource, /new Intl\./);
});

test('admin SEO cockpit view owns route-local rendering', () => {
  const viewSource = readFileSync(viewPath, 'utf8');

  assert.match(viewSource, /export function SeoCockpitView/);
  assert.match(viewSource, /from '\.\/SeoCockpitActionCards';/);
  assert.match(viewSource, /from '\.\/SeoCockpitCommandDeck';/);
  assert.match(viewSource, /function RangeTabs/);
  assert.match(viewSource, /const numberFormatter = new Intl\.NumberFormat/);
  assert.doesNotMatch(viewSource, /function CommandMetric/);
  assert.doesNotMatch(viewSource, /function PageActionBriefCard/);
});

test('admin SEO cockpit command deck owns summary metrics', () => {
  const commandDeckSource = readFileSync(commandDeckPath, 'utf8');

  assert.match(commandDeckSource, /export function SeoCommandDeck/);
  assert.match(commandDeckSource, /function CommandMetric/);
  assert.match(commandDeckSource, /function StatusTile/);
  assert.match(commandDeckSource, /function formatShare/);
});

test('admin SEO cockpit action cards own action-focused cards', () => {
  const actionCardsSource = readFileSync(actionCardsPath, 'utf8');

  assert.match(actionCardsSource, /export function PageActionBriefCard/);
  assert.match(actionCardsSource, /export function ActionCard/);
  assert.match(actionCardsSource, /export function FamilyStrategyCard/);
  assert.match(actionCardsSource, /export function OpportunityClusterGrid/);
  assert.match(actionCardsSource, /export function PriorityPill/);
});
