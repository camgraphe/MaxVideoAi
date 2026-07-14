import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildPricingPolicyProposal,
  createPricingPolicyDraft,
  filterPricingPolicyRows,
  pricingPolicyProposalSelectorKey,
  pricingPolicyRowKey,
  reconcilePricingPolicySelection,
  type PricingPolicyInventoryRow,
} from '../frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model';
import { ADMIN_NAV_GROUPS } from '../frontend/lib/admin/navigation';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/admin/pricing/page.tsx');
const cockpitPath = join(root, 'frontend/app/(core)/admin/pricing/_components/AdminPricingCockpit.tsx');
const tablePath = join(root, 'frontend/app/(core)/admin/pricing/_components/PricingPolicyTable.tsx');
const inspectorPath = join(root, 'frontend/app/(core)/admin/pricing/_components/PricingPolicyInspector.tsx');
const controllerPath = join(root, 'frontend/app/(core)/admin/pricing/_hooks/useAdminPricingCockpitController.ts');
const viewModelPath = join(root, 'frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model.ts');
const previewDialogPath = join(root, 'frontend/components/admin-system/pricing/AdminPricingChangePreviewDialog.tsx');
const historyPath = join(root, 'frontend/components/admin-system/pricing/AdminPricingHistory.tsx');
const e2ePath = join(root, 'tests/e2e/admin-critical-flows.spec.ts');
const cockpitPaths = [cockpitPath, tablePath, inspectorPath, controllerPath, viewModelPath, previewDialogPath, historyPath];
const obsoletePaths = [
  'frontend/app/api/admin/membership-tiers/route.ts',
  'frontend/app/api/admin/pricing/rules/route.ts',
  'frontend/app/api/admin/pricing/rules/[ruleId]/route.ts',
  'frontend/app/(core)/admin/pricing/_components/BillingProductCard.tsx',
  'frontend/app/(core)/admin/pricing/_components/NewPricingRuleCard.tsx',
  'frontend/app/(core)/admin/pricing/_components/PricingRuleCard.tsx',
  'frontend/app/(core)/admin/pricing/_components/PricingAdminField.tsx',
  'frontend/app/(core)/admin/pricing/_lib/pricing-admin-helpers.ts',
  'frontend/app/(core)/admin/pricing/_lib/pricing-admin-types.ts',
].map((path) => join(root, path));

function readOrEmpty(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const pageSource = readOrEmpty(pagePath);
const pricingPolicyServicePath = join(root, 'frontend/server/pricing-admin/policy-service.ts');
const pricingPolicyContractPath = join(root, 'frontend/server/pricing-admin/policy-contract.ts');
const pricingPolicyDependenciesPath = join(root, 'frontend/server/pricing-admin/policy-dependencies.ts');
const pricingPolicyPreviewPath = join(root, 'frontend/server/pricing-admin/policy-preview.ts');
const pricingPolicyRulesPath = join(root, 'frontend/server/pricing-admin/policy-rules.ts');
const pricingPolicyRoutePaths = [
  join(root, 'frontend/app/api/admin/pricing/inventory/route.ts'),
  join(root, 'frontend/app/api/admin/pricing/preview/route.ts'),
  join(root, 'frontend/app/api/admin/pricing/confirm/route.ts'),
  join(root, 'frontend/app/api/admin/pricing/history/route.ts'),
];

test('admin pricing route is an authenticated server orchestrator under 60 lines', () => {
  assert.doesNotMatch(pageSource, /^'use client';/m, 'pricing route must stay server-rendered');
  assert.match(pageSource, /await requireAdmin\(\)/, 'pricing route should explicitly require admin');
  assert.match(pageSource, /<AdminPricingCockpit\s*\/>/, 'pricing route should delegate to the canonical cockpit');
  assert.ok(pageSource.split('\n').length < 60, 'pricing route should stay below 60 lines');
});

test('canonical pricing cockpit modules exist and compose shared admin-system surfaces', () => {
  cockpitPaths.forEach((path) => assert.ok(existsSync(path), `${path} should exist`));
  const cockpitSource = readOrEmpty(cockpitPath);
  const tableSource = readOrEmpty(tablePath);
  const inspectorSource = readOrEmpty(inspectorPath);

  for (const component of ['AdminMetricGrid', 'AdminNotice', 'AdminEmptyState']) {
    assert.match(cockpitSource, new RegExp(component), `cockpit should use ${component}`);
  }
  assert.match(tableSource, /AdminDataTable/, 'policy inventory should use AdminDataTable');
  assert.match(tableSource, /AdminFilterBar/, 'policy inventory should use AdminFilterBar');
  assert.match(inspectorSource, /AdminInspectorPanel/, 'policy editor should use AdminInspectorPanel');
});

test('admin navigation exposes exactly the three canonical commercial surfaces', () => {
  const commercialItems = ADMIN_NAV_GROUPS
    .flatMap((group) => group.items)
    .filter((item) => ['/admin/pricing', '/admin/membership', '/admin/billing-products'].includes(item.href));

  assert.deepEqual(commercialItems, [
    { id: 'pricing', label: 'Pricing policy', href: '/admin/pricing', icon: 'pricing' },
    { id: 'membership', label: 'Membership', href: '/admin/membership', icon: 'membership' },
    { id: 'billing-products', label: 'Billing products', href: '/admin/billing-products', icon: 'billing-products' },
  ]);
});

test('obsolete mixed pricing components and direct mutation routes are deleted', () => {
  for (const path of obsoletePaths) {
    assert.equal(existsSync(path), false, `${path} must be permanently removed`);
  }
});

test('shared immutable history renders operation, actor, time, target, and preview delta', () => {
  const source = readOrEmpty(historyPath);
  assert.match(source, /events:\s*PricingChangeEvent\[\]/);
  assert.match(source, /event\.operation/);
  assert.match(source, /event\.actorId/);
  assert.match(source, /event\.createdAt/);
  assert.match(source, /event\.targetId/);
  assert.match(source, /event\.previewSummary/);
  assert.match(source, /deltaCents/);
  assert.match(source, /minimumDeltaCents/);
  assert.match(source, /maximumDeltaCents/);
  assert.match(source, /loading:\s*boolean/);
  assert.match(source, /AdminLoadingPanel/);
  assert.match(source, /event\.domain\s*===\s*'policy_rule'/);
  assert.match(source, /event\.operation\s*===\s*'create'/);
  assert.doesNotMatch(source, /event\.previousState\s*\?/);
  assert.match(source, /aria-label=\{`Preview rollback for \$\{event\.targetId\} \(\$\{event\.operation\}, event \$\{event\.id\}\)`\}/);
  assert.match(source, /Preview rollback/);
});

test('policy cockpit uses shared history and rollback sends identifiers only', () => {
  const cockpitSource = readOrEmpty(cockpitPath);
  const controllerSource = readOrEmpty(controllerPath);
  assert.match(cockpitSource, /AdminPricingHistory/);
  assert.match(cockpitSource, /onPreviewRollback=\{controller\.previewRollback\}/);
  assert.match(cockpitSource, /loading=\{controller\.historyLoading\}/);
  assert.match(controllerSource, /operation:\s*'rollback',\s*targetId:\s*event\.targetId,\s*eventId:\s*event\.id/);
  assert.doesNotMatch(controllerSource, /previousState|nextState/);
});

test('policy inspector owns every canonical field and keeps vendor routing read-only', () => {
  const inspectorSource = readOrEmpty(inspectorPath);
  for (const field of [
    'engineId',
    'mode',
    'resolution',
    'marginPercent',
    'marginFlatCents',
    'surchargeAudioPercent',
    'surchargeUpscalePercent',
    'currency',
    'compatibilityProfile',
  ]) {
    assert.match(inspectorSource, new RegExp(field), `policy inspector should expose ${field}`);
  }
  assert.match(inspectorSource, /Vendor account/, 'policy inspector should expose routing context');
  assert.doesNotMatch(
    inspectorSource,
    /name=["']vendorAccountId["']|onChange[^\n]*vendorAccountId/,
    'vendor account must never be editable'
  );
  for (const context of [
    'Supplier subtotal',
    'Effective provenance',
    'Matched versioned rule',
    'Database override',
    'Last mutation',
  ]) {
    assert.match(inspectorSource, new RegExp(context), `policy inspector should expose ${context}`);
  }
  assert.match(inspectorSource, /vendorSubtotalCents/);
  assert.match(inspectorSource, /representativeQuotes\.map/);
  assert.match(inspectorSource, /effectiveProvenance\?\.source/);
  assert.match(inspectorSource, /effectiveProvenance\?\.matchedBy/);
  assert.match(inspectorSource, /effectiveProvenance\?\.sourceRuleId/);
  assert.match(inspectorSource, /lastEvent\?\.actorId/);
  assert.match(inspectorSource, /lastEvent\?\.createdAt/);
});

test('client cockpit stays browser-safe and policy-domain-only', () => {
  const clientSources = cockpitPaths.map(readOrEmpty).join('\n');
  assert.doesNotMatch(clientSources, /@\/server\/|@maxvideoai\/pricing|quoteCanonicalPricing|resolvePricingPolicy/);
  assert.doesNotMatch(clientSources, /membership-tiers|billing-products|\/api\/admin\/pricing\/rules/);
  assert.doesNotMatch(clientSources, /marginPercent\s*[+*/-]|surcharge(?:Audio|Upscale)Percent\s*[+*/-]/);
});

test('controller enforces preview then fingerprint confirmation and refreshes only after success', () => {
  const controllerSource = readOrEmpty(controllerPath);
  assert.match(controllerSource, /useSWR[^\n]*PRICING_INVENTORY_ENDPOINT/);
  assert.match(controllerSource, /useSWR[^\n]*PRICING_HISTORY_ENDPOINT/);
  assert.match(controllerSource, /postJson<PricingPreviewApiResponse>\(\s*PRICING_PREVIEW_ENDPOINT/);
  assert.match(controllerSource, /previewFingerprint:\s*preview\.previewFingerprint/);
  assert.match(controllerSource, /postJson<PricingConfirmApiResponse>\(\s*PRICING_CONFIRM_ENDPOINT/);
  assert.match(controllerSource, /draftSelectionKey/);
  assert.match(controllerSource, /reconcilePricingPolicySelection\(filteredRows, selectedKey\)/);
  assert.match(
    controllerSource,
    /filteredRows\.find\(\(row\) => pricingPolicyRowKey\(row\) === selectedKey\)/,
    'selected row must come from the visible filtered inventory'
  );
  assert.match(controllerSource, /refreshLocked\s*=\s*previewing \|\| confirming \|\| Boolean\(preview\)/);
  assert.match(controllerSource, /interactionLocked\s*=\s*refreshLocked \|\| Boolean\(postCommitWarning\)/);
  assert.match(
    controllerSource,
    /if \(interactionLocked\) return;\s*const nextSelection = reconcilePricingPolicySelection/,
    'background inventory refreshes must not move selection while a preview snapshot is locked'
  );
  assert.match(controllerSource, /activeDraft\s*=\s*selectedKey === draftSelectionKey \? draft : null/);
  assert.match(controllerSource, /if \(!selectedRow \|\| !activeDraft\) return/);
  assert.match(controllerSource, /draft:\s*activeDraft/);
  assert.match(controllerSource, /if \(interactionLocked\) return/);
  assert.match(controllerSource, /pricingPolicyProposalSelectorKey\(previewProposal\)/);
  assert.match(
    controllerSource,
    /await Promise\.all\(\[refreshInventory\(\), refreshHistory\(\)\]\)[\s\S]*?refreshedRows\.some[\s\S]*?setSelectedKey\(desiredKey\)/,
    'selector-changing confirmations should select the refreshed proposed selector'
  );
  assert.match(
    controllerSource,
    /if \(!selectedRow \|\| selectedKey === draftSelectionKey\) return/,
    'background SWR refreshes must not erase an in-progress draft for the same selector'
  );
  assert.match(
    controllerSource,
    /if \(!confirmation\.committed\)[\s\S]*?throw[\s\S]*?await Promise\.all\(\[refreshInventory\(\), refreshHistory\(\)\]\)/,
    'inventory and history may refresh only after committed confirmation'
  );
});

test('policy post-commit refresh recovery is durable and blocks stale cockpit state', () => {
  const controllerSource = readOrEmpty(controllerPath);
  const cockpitSource = readOrEmpty(cockpitPath);

  assert.match(controllerSource, /post_commit_refresh_failed/);
  assert.match(controllerSource, /interactionLocked\s*=\s*[^;]*Boolean\(postCommitWarning\)/);
  assert.match(controllerSource, /refreshLocked\s*=\s*previewing\s*\|\|\s*confirming\s*\|\|\s*Boolean\(preview\)/);
  assert.match(controllerSource, /if \(refreshLocked\) return;/);
  assert.match(controllerSource, /setSelectedKey\(null\)/);
  assert.match(controllerSource, /setDraft\(null\)/);
  assert.match(controllerSource, /setDraftSelectionKey\(null\)/);
  assert.equal(controllerSource.match(/setPostCommitWarning\(null\)/g)?.length, 1);
  assert.match(cockpitSource, /controller\.postCommitWarning[\s\S]*tone="warning"[\s\S]*controller\.postCommitWarning\.message/);
  assert.match(cockpitSource, /disabled=\{controller\.refreshing \|\| controller\.refreshLocked\}/);
});

test('generic preview dialog is read-only and requires explicit confirmation', () => {
  const dialogSource = readOrEmpty(previewDialogPath);
  assert.match(dialogSource, /preview:\s*PricingChangePreview/);
  assert.match(dialogSource, /onConfirm:\s*\(\)\s*=>\s*void/);
  assert.match(dialogSource, /onCancel:\s*\(\)\s*=>\s*void/);
  assert.match(dialogSource, /Confirm and apply now/);
  assert.match(dialogSource, /currentTotalCents/);
  assert.match(dialogSource, /proposedTotalCents/);
  assert.match(dialogSource, /deltaCents/);
  assert.match(dialogSource, /affectedSurfaces/);
  assert.match(dialogSource, /currentProvenance/);
  assert.match(dialogSource, /proposedProvenance/);
  assert.match(dialogSource, /warnings/);
  assert.match(dialogSource, /error\?:\s*string\s*\|\s*null/);
  assert.match(dialogSource, /error\s*\?\s*<AdminNotice[^>]*tone="error"/);
  assert.match(dialogSource, /role="alert"/);
  assert.match(dialogSource, /aria-live="assertive"/);
  assert.doesNotMatch(dialogSource, /<input|<select|<textarea/);
});

test('selection reconciliation never leaves a hidden row editable', () => {
  const visible = buildInventoryRow('veo-3-1', '1080p');
  const hidden = buildInventoryRow('kling-3-pro', '720p');
  const filtered = filterPricingPolicyRows([hidden, visible], { query: 'veo', source: 'all', status: 'all' });

  assert.equal(reconcilePricingPolicySelection(filtered, pricingPolicyRowKey(hidden)), pricingPolicyRowKey(visible));
  assert.equal(reconcilePricingPolicySelection([], pricingPolicyRowKey(hidden)), null);
});

test('proposal selector keys follow canonical selector-changing create and update proposals', () => {
  const row = buildInventoryRow('kling-3-pro', '720p', true);
  const draft = { ...createPricingPolicyDraft(row), engineId: 'veo-3-1', mode: 't2v', resolution: '1080p' };

  assert.equal(pricingPolicyProposalSelectorKey(buildPricingPolicyProposal(row, draft)), 'veo-3-1|t2v|1080p');
});

test('preview and confirmation lock every mutable cockpit control', () => {
  const cockpitSource = readOrEmpty(cockpitPath);
  const tableSource = readOrEmpty(tablePath);
  const inspectorSource = readOrEmpty(inspectorPath);
  assert.match(cockpitSource, /locked=\{controller\.interactionLocked\}/);
  assert.match(tableSource, /disabled:\s*boolean/);
  assert.match(tableSource, /disabled=\{disabled\}/g);
  assert.match(inspectorSource, /locked:\s*boolean/);
  assert.match(inspectorSource, /disabled=\{locked\}/g);
});

test('pricing E2E treats render timeouts as failures, never empty inventory skips', () => {
  const e2eSource = readOrEmpty(e2ePath);
  assert.match(
    e2eSource,
    /async function waitForPricingPolicyState[\s\S]*?return 'timeout' as const\s*;\s*\}/
  );
  assert.match(e2eSource, /if \(pricingState === 'timeout'\) \{\s*throw new Error/);
  const flow = e2eSource.match(/test\('pricing policy filters[\s\S]*?assertNoClientErrors\(errors\);\s*\}\);/)?.[0] ?? '';
  const state = e2eSource.match(/async function waitForPricingPolicyState[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(flow, /getByTestId\('pricing-policy-inventory'\)/);
  assert.doesNotMatch(flow, /page\.locator\('tbody tr'\)/);
  assert.match(state, /getByTestId\('pricing-policy-inventory'\)/);
  assert.doesNotMatch(state, /page\.locator\('tbody tr'\)/);
});

test('cockpit view model preserves an inherited database override selector in update proposals', () => {
  const row: PricingPolicyInventoryRow = {
    selector: { engineId: 'kling-3-pro', mode: 't2v', resolution: '1080p' },
    versionedRule: null,
    databaseOverride: {
      id: 'database-global',
      marginPercent: 0.3,
      marginFlatCents: 0,
      surchargeAudioPercent: 0.2,
      surchargeUpscalePercent: 0.5,
      currency: 'USD',
      compatibilityProfile: 'standard',
    },
    effectiveProvenance: null,
    representativeQuotes: [],
    routingContext: null,
    lastEvent: null,
  };

  const draft = createPricingPolicyDraft(row);
  assert.equal(draft.engineId, '', 'editing an inherited global override must keep its global selector');
  const proposal = buildPricingPolicyProposal(row, draft);
  assert.deepEqual(proposal, {
    operation: 'update',
    targetId: 'database-global',
    rule: row.databaseOverride,
  });
});

test('cockpit view model creates selector-scoped drafts and filters inventory without pricing math', () => {
  const row: PricingPolicyInventoryRow = {
    selector: { engineId: 'kling-3-pro', mode: 't2v', resolution: '1080p' },
    versionedRule: {
      id: 'default',
      marginPercent: 0.3,
      marginFlatCents: 0,
      surchargeAudioPercent: 0.2,
      surchargeUpscalePercent: 0.5,
      currency: 'USD',
      compatibilityProfile: 'standard',
    },
    databaseOverride: null,
    effectiveProvenance: null,
    representativeQuotes: [],
    routingContext: null,
    lastEvent: null,
  };

  const draft = createPricingPolicyDraft(row);
  assert.equal(draft.id, 'admin-kling-3-pro-t2v-1080p');
  assert.equal(draft.marginPercent, '30');
  assert.deepEqual(filterPricingPolicyRows([row], { query: '1080P', source: 'versioned', status: 'all' }), [row]);
  assert.equal(filterPricingPolicyRows([row], { query: 'veo', source: 'all', status: 'all' }).length, 0);
  assert.deepEqual(
    filterPricingPolicyRows([row], { query: '', source: 'all', status: 'unavailable' }),
    [row]
  );
  assert.equal(filterPricingPolicyRows([row], { query: '', source: 'all', status: 'quoted' }).length, 0);
});

test('policy table exposes a canonical projection status filter', () => {
  const tableSource = readOrEmpty(tablePath);
  assert.match(tableSource, /aria-label="Projection status"/);
  assert.match(tableSource, /All statuses/);
  assert.match(tableSource, /Quoted projections/);
  assert.match(tableSource, /Unavailable projections/);
});

test('pricing policy contracts and production dependencies have focused owners', () => {
  assert.ok(existsSync(pricingPolicyContractPath), 'pricing policy contract module should exist');
  assert.ok(existsSync(pricingPolicyDependenciesPath), 'pricing policy dependency module should exist');

  const contractSource = readOrEmpty(pricingPolicyContractPath);
  const dependenciesSource = readOrEmpty(pricingPolicyDependenciesPath);

  assert.match(contractSource, /export type PricingPolicyChangeProposal/);
  assert.match(contractSource, /export type PricingPolicyServiceDependencies/);
  assert.doesNotMatch(contractSource, /^import (?!type)/m, 'contract module must have type-only imports');

  assert.match(dependenciesSource, /export const DEFAULT_POLICY_SERVICE_DEPENDENCIES/);
  assert.match(dependenciesSource, /withDbTransaction/);
  assert.match(dependenciesSource, /loadPricingPolicyOverridesWithExecutor\(executor, \{ lock: true \}\)/);
  assert.match(dependenciesSource, /insertPricingChangeEvent/);
  assert.match(dependenciesSource, /invalidatePricingRulesCache/);
  assert.match(dependenciesSource, /revalidatePricingChangeSurfaces/);
  assert.doesNotMatch(
    dependenciesSource,
    /resolvePricingPolicy|quoteCanonicalAdminScenarios|compareCanonicalAdminScenarios/,
    'dependency adapter must not own commercial policy decisions'
  );
});

test('pricing policy rule helpers are deterministic and side-effect free', () => {
  assert.ok(existsSync(pricingPolicyRulesPath), 'pricing policy rule helper module should exist');
  const source = readOrEmpty(pricingPolicyRulesPath);

  for (const helper of [
    'asRecord',
    'requiredText',
    'canonicalRule',
    'jsonRule',
    'selectorOf',
    'selectorKey',
    'scenarioSelectorKey',
    'validateOverrides',
    'projectionJson',
    'sortRules',
  ]) {
    assert.match(source, new RegExp(`export function ${helper}`), `${helper} should be exported`);
  }

  assert.doesNotMatch(
    source,
    /@\/lib\/db|event-store|revalidation|withDbTransaction|insertPricingChangeEvent/,
    'rule helper module must not own persistence or side effects'
  );
});

test('pricing policy preview owns canonical projection and fingerprinting without persistence', () => {
  assert.ok(existsSync(pricingPolicyPreviewPath), 'pricing policy preview module should exist');
  const source = readOrEmpty(pricingPolicyPreviewPath);

  assert.match(source, /export function deriveRequestedPricingSurcharges/);
  assert.match(source, /export async function previewPricingPolicyChange/);
  assert.match(source, /selectAffectedPricingScenarios/);
  assert.match(source, /quoteCanonicalAdminScenarios/);
  assert.match(source, /compareCanonicalAdminScenarios/);
  assert.match(source, /buildPricingPreviewFingerprint/);
  assert.doesNotMatch(
    source,
    /withDbTransaction|upsertPricingRuleWithExecutor|deletePricingRuleWithExecutor|insertPricingChangeEvent/,
    'preview must not own persistence'
  );
});

test('preview-required pricing policy routes exist and stay thin, authorized service adapters', () => {
  assert.ok(existsSync(pricingPolicyServicePath), 'canonical pricing policy service should exist');
  for (const routePath of pricingPolicyRoutePaths) {
    assert.ok(existsSync(routePath), `${routePath} should exist`);
    const source = readFileSync(routePath, 'utf8');
    assert.match(source, /requireAdmin\(req\)/, 'every pricing policy handler should require admin');
    assert.match(source, /@\/server\/pricing-admin\/policy-service/, 'route should delegate to the pricing policy service');
    assert.doesNotMatch(source, /quoteCanonicalPricing|resolvePricingPolicy|marginPercent\s*[+*/-]/, 'route must not own quote math');
    assert.doesNotMatch(source, /app_pricing_rules|INSERT INTO|UPDATE app_|DELETE FROM/, 'route must not own SQL');
    assert.ok(source.split('\n').length <= 100, `${routePath} should stay below 100 lines`);
  }

  const confirmSource = readFileSync(pricingPolicyRoutePaths[2]!, 'utf8');
  assert.match(confirmSource, /adminUserId\s*=\s*await requireAdmin\(req\)/, 'confirmation actor should come from requireAdmin');
  assert.match(
    confirmSource,
    /confirmPricingPolicyChange\([\s\S]*?adminUserId\s*\n\s*\)/,
    'confirmation should pass the server actor'
  );
  assert.doesNotMatch(confirmSource, /payload\.(actor|actorId|adminUserId)/, 'request actor fields must not be authoritative');
});

test('pricing confirmation performs a transaction-local locked preview check', () => {
  const serviceSource = readFileSync(pricingPolicyServicePath, 'utf8');
  const storeSource = readFileSync(join(root, 'frontend/src/lib/pricing-rule-store.ts'), 'utf8');

  assert.match(serviceSource, /loadOverrides:\s*\(\)\s*=>\s*dependencies\.loadOverrides\(executor\)/);
  assert.match(serviceSource, /transactionPreview\s*=\s*await previewPricingPolicyChange/);
  assert.match(storeSource, /LOCK TABLE app_pricing_rules IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(storeSource, /options\.lock \? 'FOR UPDATE'/);
});

test('admin route guide locks the one-owner commercial mutation workflow', () => {
  const guide = readFileSync(join(root, 'docs/engineering/admin-routes.md'), 'utf8');
  for (const route of ['/admin/pricing', '/admin/membership', '/admin/billing-products']) {
    assert.match(guide, new RegExp(route.replaceAll('/', '\\/')));
  }
  assert.match(guide, /preview → explicit confirmation → immediate apply/);
  assert.match(guide, /stale.*fingerprint/i);
  assert.match(guide, /immutable event/i);
  assert.match(guide, /rollback.*new mutation/i);
  assert.match(guide, /database.*unavailable.*must fail/i);
  assert.match(guide, /vendorAccountId.*read-only/i);
});

function buildInventoryRow(
  engineId: string,
  resolution: string,
  databaseOverride = false
): PricingPolicyInventoryRow {
  const rule = {
    id: `${engineId}-${resolution}`,
    engineId,
    mode: 't2v',
    resolution,
    marginPercent: 0.3,
    marginFlatCents: 0,
    surchargeAudioPercent: 0.2,
    surchargeUpscalePercent: 0.5,
    currency: 'USD',
    compatibilityProfile: 'standard',
  };
  return {
    selector: { engineId, mode: 't2v', resolution },
    versionedRule: databaseOverride ? null : rule,
    databaseOverride: databaseOverride ? rule : null,
    effectiveProvenance: null,
    representativeQuotes: [],
    routingContext: null,
    lastEvent: null,
  };
}
