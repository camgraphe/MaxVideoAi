import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/admin/membership/page.tsx');
const viewPath = join(root, 'frontend/app/(core)/admin/membership/_components/AdminMembershipView.tsx');
const controllerPath = join(root, 'frontend/app/(core)/admin/membership/_hooks/useAdminMembershipController.ts');
const viewModelPath = join(root, 'frontend/app/(core)/admin/membership/_lib/membership-admin-view-model.ts');
const membershipServicePath = join(root, 'frontend/server/pricing-admin/membership-service.ts');
const routePaths = [
  join(root, 'frontend/app/api/admin/membership/route.ts'),
  join(root, 'frontend/app/api/admin/membership/preview/route.ts'),
  join(root, 'frontend/app/api/admin/membership/confirm/route.ts'),
  join(root, 'frontend/app/api/admin/membership/history/route.ts'),
];
const billingProductsPagePath = join(root, 'frontend/app/(core)/admin/billing-products/page.tsx');
const billingProductsViewPath = join(root, 'frontend/app/(core)/admin/billing-products/_components/AdminBillingProductsView.tsx');
const billingProductsControllerPath = join(root, 'frontend/app/(core)/admin/billing-products/_hooks/useAdminBillingProductsController.ts');
const billingProductsViewModelPath = join(root, 'frontend/app/(core)/admin/billing-products/_lib/billing-products-admin-view-model.ts');
const billingProductServicePath = join(root, 'frontend/server/pricing-admin/billing-product-service.ts');
const billingProductRoutePaths = [
  join(root, 'frontend/app/api/admin/billing-products/route.ts'),
  join(root, 'frontend/app/api/admin/billing-products/preview/route.ts'),
  join(root, 'frontend/app/api/admin/billing-products/confirm/route.ts'),
  join(root, 'frontend/app/api/admin/billing-products/history/route.ts'),
];

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

test('membership admin is a small authenticated route with dedicated controller and view', () => {
  const page = read(pagePath);
  assert.ok(existsSync(pagePath));
  assert.ok(existsSync(viewPath));
  assert.ok(existsSync(controllerPath));
  assert.ok(existsSync(viewModelPath));
  assert.doesNotMatch(page, /^'use client';/m);
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /<AdminMembershipView\s*\/>/);
  assert.ok(page.split('\n').length < 60);
});

test('membership routes are thin, node-only, authorized, and delegate all commercial work', () => {
  assert.ok(existsSync(membershipServicePath));
  for (const path of routePaths) {
    const source = read(path);
    assert.ok(source, `${path} should exist`);
    assert.match(source, /runtime\s*=\s*'nodejs'/);
    assert.match(source, /await requireAdmin\(req\)/);
    assert.doesNotMatch(source, /quoteCanonicalPricing|buildPricingPreviewFingerprint|withDbTransaction|INSERT INTO|UPDATE app_/);
    assert.ok(source.split('\n').length < 100, `${path} should stay thin`);
  }
});

test('membership controller enforces preview-fingerprint-confirm and refreshes only after commit', () => {
  const source = read(controllerPath);
  assert.match(source, /useSWR[^\n]*MEMBERSHIP_INVENTORY_ENDPOINT/);
  assert.match(source, /useSWR[^\n]*MEMBERSHIP_HISTORY_ENDPOINT/);
  assert.match(source, /postJson[^\n]*MEMBERSHIP_PREVIEW_ENDPOINT/);
  assert.match(source, /previewFingerprint:\s*preview\.previewFingerprint/);
  assert.match(source, /postJson[^\n]*MEMBERSHIP_CONFIRM_ENDPOINT/);
  assert.match(source, /if \(!confirmation\.committed\)/);
  assert.match(source, /await Promise\.all\(\[refreshInventory\(\), refreshHistory\(\)\]\)/);
  assert.match(source, /operation:\s*'rollback'/);
});

test('membership refresh replaces the draft from the resolved SWR inventory without exposing cached values', () => {
  const source = read(controllerPath);
  const refreshBlock = source.match(/const refresh = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[[^\]]+\]\);/)?.[0] ?? '';
  assert.doesNotMatch(refreshBlock, /setDraft\(\[\]\)/);
  assert.match(refreshBlock, /const \[refreshedInventory\][\s\S]*await Promise\.all\(\[refreshInventory\(\), refreshHistory\(\)\]\)/);
  assert.match(refreshBlock, /setDraft\(createMembershipDraft\(refreshedInventory\.inventory\.tiers\)\)/);
});

test('membership client stays browser-safe, membership-only, and contains no commercial formulas', () => {
  const source = [viewPath, controllerPath, viewModelPath].map(read).join('\n');
  assert.doesNotMatch(source, /@\/server\/|@maxvideoai\/pricing|quoteCanonicalPricing|resolvePricingPolicy/);
  assert.doesNotMatch(source, /\/api\/admin\/pricing|\/api\/admin\/billing-products|marginPercent|surchargeAudioPercent/);
  assert.doesNotMatch(source, /discountPercent\s*[+*/-]|customerTotalCents\s*[+*/-]/);
  assert.match(read(viewPath), /AdminPricingChangePreviewDialog/);
  for (const tier of ['member', 'plus', 'pro']) assert.match(read(viewModelPath), new RegExp(`'${tier}'`));
});

test('membership service owns only membership state and uses canonical scenario projection', () => {
  const source = read(membershipServicePath);
  assert.match(source, /quoteCanonicalAdminScenarios/);
  assert.match(source, /compareCanonicalAdminScenarios/);
  assert.match(source, /domain:\s*'membership'/);
  assert.match(source, /upsertMembershipTiersWithExecutor/);
  assert.doesNotMatch(source, /upsertPricingRule|deletePricingRule|upsertBillingProduct/);
});

test('billing products admin is a small authenticated route with dedicated controller and view', () => {
  const page = read(billingProductsPagePath);
  for (const path of [billingProductsPagePath, billingProductsViewPath, billingProductsControllerPath, billingProductsViewModelPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }
  assert.doesNotMatch(page, /^'use client';/m);
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /<AdminBillingProductsView\s*\/>/);
  assert.ok(page.split('\n').length < 60);
});

test('billing product routes are thin, node-only, authorized, and inventory is GET-only', () => {
  assert.ok(existsSync(billingProductServicePath));
  for (const path of billingProductRoutePaths) {
    const source = read(path);
    assert.ok(source, `${path} should exist`);
    assert.match(source, /runtime\s*=\s*'nodejs'/);
    assert.match(source, /await requireAdmin\(req\)/);
    assert.doesNotMatch(source, /quoteCanonicalPricing|buildPricingPreviewFingerprint|withDbTransaction|INSERT INTO|UPDATE app_/);
    assert.ok(source.split('\n').length < 100, `${path} should stay thin`);
  }
  assert.doesNotMatch(read(billingProductRoutePaths[0]!), /export async function PUT/);
});

test('billing product controller requires preview fingerprint before confirm and refreshes after commit', () => {
  const source = read(billingProductsControllerPath);
  assert.match(source, /useSWR[^\n]*BILLING_PRODUCTS_INVENTORY_ENDPOINT/);
  assert.match(source, /useSWR[^\n]*BILLING_PRODUCTS_HISTORY_ENDPOINT/);
  assert.match(source, /postJson[^\n]*BILLING_PRODUCTS_PREVIEW_ENDPOINT/);
  assert.match(source, /previewFingerprint:\s*preview\.previewFingerprint/);
  assert.match(source, /postJson[^\n]*BILLING_PRODUCTS_CONFIRM_ENDPOINT/);
  assert.match(source, /if \(!confirmation\.committed\)/);
  assert.match(source, /await Promise\.all\(\[refreshInventory\(\), refreshHistory\(\)\]\)/);
  assert.match(source, /operation:\s*'rollback'/);
});

test('billing product client stays browser-safe and contains no commercial calculations', () => {
  const source = [billingProductsViewPath, billingProductsControllerPath, billingProductsViewModelPath].map(read).join('\n');
  assert.doesNotMatch(source, /@\/server\/|@maxvideoai\/pricing|quoteCanonicalPricing|resolvePricingPolicy|@\/lib\/billing-products/);
  assert.doesNotMatch(source, /unitPriceCents\s*[+*/-]|customerTotalCents\s*[+*/-]/);
  assert.match(read(billingProductsViewPath), /AdminPricingChangePreviewDialog/);
});

test('billing product service owns fixed-product projection and transactional persistence only', () => {
  const source = read(billingProductServicePath);
  assert.match(source, /buildCanonicalFixedProductSnapshot/);
  assert.match(source, /domain:\s*'billing_product'/);
  assert.match(source, /updateBillingProductWithExecutor/);
  assert.doesNotMatch(source, /upsertPricingRule|upsertMembershipTier/);
});
