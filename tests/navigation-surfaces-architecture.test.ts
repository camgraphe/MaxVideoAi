import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

const headerBarPath = join(root, 'frontend/components/HeaderBar.tsx');
const headerAccountMenuPath = join(root, 'frontend/components/header/HeaderAccountMenu.tsx');
const headerMobileMenuPath = join(root, 'frontend/components/header/HeaderMobileMenu.tsx');
const headerWalletStatusPath = join(root, 'frontend/components/header/HeaderWalletStatus.tsx');

const marketingNavPath = join(root, 'frontend/components/marketing/MarketingNav.tsx');
const marketingAccountMenuPath = join(root, 'frontend/components/marketing/MarketingAccountMenu.tsx');
const marketingDesktopNavPath = join(root, 'frontend/components/marketing/MarketingDesktopNav.tsx');
const marketingMobileMenuPath = join(root, 'frontend/components/marketing/MarketingMobileMenu.tsx');

const readSource = (path: string) => readFileSync(path, 'utf8');
const lineCount = (source: string) => source.split('\n').length;

test('navigation surfaces delegate account, wallet, and mobile ownership', () => {
  for (const path of [
    headerBarPath,
    headerAccountMenuPath,
    headerMobileMenuPath,
    headerWalletStatusPath,
    marketingNavPath,
    marketingAccountMenuPath,
    marketingDesktopNavPath,
    marketingMobileMenuPath,
  ]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const headerBarSource = readSource(headerBarPath);
  const headerAccountMenuSource = readSource(headerAccountMenuPath);
  const headerMobileMenuSource = readSource(headerMobileMenuPath);
  const headerWalletStatusSource = readSource(headerWalletStatusPath);

  assert.match(headerBarSource, /<HeaderAccountMenu/, 'HeaderBar should compose a focused account menu');
  assert.match(headerBarSource, /<HeaderMobileMenu/, 'HeaderBar should compose a focused mobile menu');
  assert.match(headerBarSource, /<HeaderWalletStatus/, 'HeaderBar should compose focused wallet status');
  assert.doesNotMatch(headerBarSource, /NAV_ITEMS\.map|walletTopUp\.copy|GUEST_MOBILE_NAV_ICONS/, 'HeaderBar should not own account, wallet prompt, or guest mobile internals');
  assert.match(headerAccountMenuSource, /NAV_ITEMS\.map/, 'HeaderAccountMenu should own authenticated menu items');
  assert.match(headerMobileMenuSource, /GUEST_MOBILE_NAV_ICONS|MARKETING_NAV_DROPDOWNS/, 'HeaderMobileMenu should own guest and marketing mobile items');
  assert.match(headerWalletStatusSource, /walletTopUp\.copy/, 'HeaderWalletStatus should own wallet prompt copy');
});

test('marketing nav delegates desktop, mobile, and account menu rendering', () => {
  const marketingNavSource = readSource(marketingNavPath);
  const accountMenuSource = readSource(marketingAccountMenuPath);
  const desktopNavSource = readSource(marketingDesktopNavPath);
  const mobileMenuSource = readSource(marketingMobileMenuPath);

  assert.match(marketingNavSource, /<MarketingDesktopNav/, 'MarketingNav should compose a focused desktop nav');
  assert.match(marketingNavSource, /<MarketingAccountMenu/, 'MarketingNav should compose a focused account menu');
  assert.match(marketingNavSource, /<MarketingMobileMenu/, 'MarketingNav should compose a focused mobile menu');
  assert.doesNotMatch(marketingNavSource, /MARKETING_NAV_DROPDOWNS|NAV_ITEMS\.map|mobileDropdownOpen\[item\.key\]|workspace\.header\.signedIn/, 'MarketingNav should not own dropdown, account, or mobile rendering internals');
  assert.match(accountMenuSource, /NAV_ITEMS\.map|workspace\.header\.signedIn/, 'MarketingAccountMenu should own workspace account menu copy');
  assert.match(desktopNavSource, /MARKETING_NAV_DROPDOWNS|export function MarketingDesktopNav/, 'MarketingDesktopNav should own desktop dropdown rendering');
  assert.match(mobileMenuSource, /MARKETING_NAV_DROPDOWNS|mobileDropdownOpen\[item\.key\]|export function MarketingMobileMenu/, 'MarketingMobileMenu should own mobile dropdown rendering');
});

test('navigation orchestrators stay below page-sized component thresholds', () => {
  const headerBarSource = readSource(headerBarPath);
  const headerAccountMenuSource = readSource(headerAccountMenuPath);
  const headerMobileMenuSource = readSource(headerMobileMenuPath);
  const headerWalletStatusSource = readSource(headerWalletStatusPath);
  const marketingNavSource = readSource(marketingNavPath);
  const marketingAccountMenuSource = readSource(marketingAccountMenuPath);
  const marketingDesktopNavSource = readSource(marketingDesktopNavPath);
  const marketingMobileMenuSource = readSource(marketingMobileMenuPath);

  assert.ok(lineCount(headerBarSource) <= 500, `HeaderBar should stay below 500 lines, got ${lineCount(headerBarSource)}`);
  assert.ok(lineCount(marketingNavSource) <= 450, `MarketingNav should stay below 450 lines, got ${lineCount(marketingNavSource)}`);
  assert.ok(lineCount(headerAccountMenuSource) <= 150, `HeaderAccountMenu should stay focused, got ${lineCount(headerAccountMenuSource)}`);
  assert.ok(lineCount(headerMobileMenuSource) <= 300, `HeaderMobileMenu should stay focused, got ${lineCount(headerMobileMenuSource)}`);
  assert.ok(lineCount(headerWalletStatusSource) <= 100, `HeaderWalletStatus should stay focused, got ${lineCount(headerWalletStatusSource)}`);
  assert.ok(lineCount(marketingAccountMenuSource) <= 140, `MarketingAccountMenu should stay focused, got ${lineCount(marketingAccountMenuSource)}`);
  assert.ok(lineCount(marketingDesktopNavSource) <= 220, `MarketingDesktopNav should stay focused, got ${lineCount(marketingDesktopNavSource)}`);
  assert.ok(lineCount(marketingMobileMenuSource) <= 260, `MarketingMobileMenu should stay focused, got ${lineCount(marketingMobileMenuSource)}`);
});
