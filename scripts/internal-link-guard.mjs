#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const ROOT = path.resolve(SCRIPT_DIR, '..');
const CANONICAL_FRONTEND_ROOT = path.join(ROOT, 'frontend');

const footerPath = 'frontend/components/marketing/MarketingFooter.tsx';
const navPath = 'frontend/components/marketing/MarketingNav.tsx';
const appHeaderPath = 'frontend/components/HeaderBar.tsx';
const appHeaderNavHelpersPath = 'frontend/components/header/header-nav-helpers.ts';
const obfuscatedEmailPath = 'frontend/components/marketing/ObfuscatedEmailLink.tsx';
const dictionariesPath = 'frontend/lib/i18n/dictionaries.ts';
const companySourcePaths = [
  'frontend/app/(localized)/[locale]/(marketing)/company/page.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/company/_lib/company-copy.ts',
  'frontend/app/(localized)/[locale]/(marketing)/company/_components/CompanyTrustView.tsx',
];

const companyAllowedFiles = new Set([
  'frontend/components/marketing/MarketingFooter.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/about/_components/AboutView.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/company/page.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/company/_lib/company-copy.ts',
  'frontend/app/(localized)/[locale]/(marketing)/company/_components/CompanyTrustView.tsx',
  'frontend/app/company/page.tsx',
  'frontend/config/localized-slugs.json',
  'frontend/i18n/routing.ts',
  'frontend/lib/seo/hreflang.ts',
  'frontend/next-sitemap.config.js',
  'frontend/middleware.ts',
  'frontend/lib/middleware/routing-query.ts',
  'frontend/scripts/qa/hreflang-check.ts',
  'frontend/scripts/qa/locale-surface-check.ts',
]);

export const ALLOWED_NON_LINK_ROUTE_CLASSIFIERS = new Set([
  'frontend/lib/analytics/journey.ts',
]);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      walk(absolutePath, output);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|json|md|mdx)$/.test(entry.name)) continue;
    output.push(absolutePath);
  }
  return output;
}

function resolveScanRoot(scanRoot) {
  if (scanRoot === undefined) {
    return fs.realpathSync(CANONICAL_FRONTEND_ROOT);
  }
  if (typeof scanRoot !== 'string' || scanRoot.trim() === '') {
    throw new Error('--scan-root must name an absolute directory.');
  }
  if (!path.isAbsolute(scanRoot)) {
    throw new Error('--scan-root must be an absolute directory.');
  }

  let resolvedScanRoot;
  try {
    resolvedScanRoot = fs.realpathSync(scanRoot);
  } catch {
    throw new Error(`--scan-root must name an existing directory: ${scanRoot}`);
  }
  if (!fs.statSync(resolvedScanRoot).isDirectory()) {
    throw new Error(`--scan-root must name a directory: ${scanRoot}`);
  }
  return resolvedScanRoot;
}

function formatScannedPath(scanRoot, absolutePath) {
  const relativePath = path.relative(scanRoot, absolutePath).replaceAll(path.sep, '/');
  return `frontend/${relativePath}`;
}

export function runInternalLinkGuard({ scanRoot: requestedScanRoot } = {}) {
  const scanRoot = resolveScanRoot(requestedScanRoot);
  const errors = [];
  const assert = (condition, message) => {
    if (!condition) errors.push(message);
  };

  // These fixed ownership contracts always read the canonical repository files.
  // The explicit scan override only isolates the broad semantic walk used by tests.
  const footerSource = read(footerPath);
  const navSource = read(navPath);
  const appHeaderSource = read(appHeaderPath);
  const appHeaderNavHelpersSource = read(appHeaderNavHelpersPath);
  const obfuscatedEmailSource = read(obfuscatedEmailPath);
  const dictionariesSource = read(dictionariesPath);
  const companySources = companySourcePaths.map(read).join('\n');

  assert(/pathname:\s*'\/company'/.test(footerSource), 'Footer must include /company as trust hub entry.');
  assert(!/pathname:\s*'\/about'/.test(footerSource), 'Footer must not link directly to /about.');
  assert(!/pathname:\s*'\/contact'/.test(footerSource), 'Footer must not link directly to /contact.');
  assert(!/pathname:\s*'\/workflows'/.test(footerSource), 'Footer must not link directly to /workflows.');
  assert(!/\/legal\/takedown/.test(footerSource), 'Footer policies must not include /legal/takedown.');

  assert(!/\/contact/.test(obfuscatedEmailSource), 'ObfuscatedEmailLink must not include /contact fallback links.');
  assert(!/fallbackHref/.test(obfuscatedEmailSource), 'ObfuscatedEmailLink must not expose fallbackHref.');
  assert(/mailto:/.test(obfuscatedEmailSource), 'ObfuscatedEmailLink must render mailto links after hydration.');

  assert(!/\{ key: 'workflows', href: '\/workflows' \}/.test(navSource), 'Top nav default links must not include /workflows.');
  assert(!/\{ key: 'docs', href: '\/docs' \}/.test(navSource), 'Top nav default links must not include /docs.');
  assert(
    !/\{ key: 'workflows', href: '\/workflows' \}/.test(dictionariesSource),
    'Dictionary fallback nav links must not include /workflows.'
  );
  assert(
    !/\{ key: 'docs', href: '\/docs' \}/.test(dictionariesSource),
    'Dictionary fallback nav links must not include /docs.'
  );

  assert(!/\{ key: 'workflows', href: '\/workflows' \}/.test(appHeaderSource), 'App header top nav must not include /workflows.');
  assert(!/\{ key: 'docs', href: '\/docs' \}/.test(appHeaderSource), 'App header top nav must not include /docs.');
  assert(/MARKETING_TOP_NAV_LINKS/.test(appHeaderSource), 'App header must use shared MARKETING_TOP_NAV_LINKS.');
  assert(/normalizeMarketingLinks/.test(appHeaderSource), 'App header must normalize nav links with the header nav helper.');
  assert(
    /MARKETING_TOP_NAV_HREF_BY_KEY/.test(appHeaderNavHelpersSource),
    'Header nav helper must normalize nav links with top-nav allowlist.'
  );

  const strategicHrefPatterns = [
    /\/models\b/,
    /\/examples\b/,
    /\/ai-video-engines\b/,
    /kling-3-pro-vs-veo-3-1/,
    /seedance-2-0-vs-sora-2/,
    /veo-3-1-fast/,
    /seedance-2-0/,
  ];

  for (const pattern of strategicHrefPatterns) {
    assert(!pattern.test(companySources), `Company trust hub must not link to strategic destination (${pattern}).`);
  }

  for (const localeFile of ['frontend/messages/en.json', 'frontend/messages/fr.json', 'frontend/messages/es.json']) {
    const payload = JSON.parse(read(localeFile));
    const navLinks = Array.isArray(payload?.nav?.links) ? payload.nav.links : [];
    const footerLinks = Array.isArray(payload?.footer?.links) ? payload.footer.links : [];
    const productItems = payload?.footer?.sections?.product?.items ?? {};
    const companyItems = payload?.footer?.sections?.company?.items ?? {};

    assert(
      !navLinks.some(
        (entry) =>
          entry?.key === 'workflows' ||
          entry?.href === '/workflows' ||
          entry?.key === 'docs' ||
          entry?.href === '/docs'
      ),
      `${localeFile}: nav.links must not include workflows or docs.`
    );
    const legalLinks = footerLinks.filter((entry) => entry?.href === '/legal');
    const returnPolicyLinks = footerLinks.filter((entry) => entry?.href === '/return-policy');
    assert(
      legalLinks.length === 1,
      `${localeFile}: footer.links must contain exactly one /legal entry.`
    );
    assert(
      returnPolicyLinks.length === 1,
      `${localeFile}: footer.links must contain exactly one /return-policy entry.`
    );
    assert(!Object.prototype.hasOwnProperty.call(productItems, 'workflows'), `${localeFile}: footer product links must not include workflows.`);
    assert(!Object.prototype.hasOwnProperty.call(companyItems, 'about'), `${localeFile}: footer company links must not include about.`);
    assert(!Object.prototype.hasOwnProperty.call(companyItems, 'contact'), `${localeFile}: footer company links must not include contact.`);
    assert(Object.prototype.hasOwnProperty.call(companyItems, 'companyHub'), `${localeFile}: footer company links must include companyHub.`);
  }

  const files = walk(scanRoot);
  for (const file of files) {
    const relativePath = formatScannedPath(scanRoot, file);
    if (companyAllowedFiles.has(relativePath) || ALLOWED_NON_LINK_ROUTE_CLASSIFIERS.has(relativePath)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const hasInternalCompanyReference =
      /href\s*=\s*['"]\/company(?:[/"#?]|['"])/.test(source) ||
      /pathname\s*:\s*['"]\/company['"]/.test(source) ||
      /['"]\/company['"]/.test(source);
    if (hasInternalCompanyReference) {
      errors.push(`Found unexpected /company reference outside allowed files: ${relativePath}`);
    }
  }

  return {
    errors,
    scannedFileCount: files.length,
    scanRoot,
  };
}

function parseCliArgs(args) {
  if (args.length === 0) return {};
  if (args.length === 2 && args[0] === '--scan-root') {
    return { scanRoot: args[1] };
  }
  throw new Error('Usage: internal-link-guard.mjs [--scan-root /absolute/frontend/root]');
}

function printReport(report) {
  if (report.errors.length > 0) {
    console.error('internal-link-guard: FAILED');
    for (const item of report.errors) {
      console.error(`- ${item}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('internal-link-guard: OK');
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    printReport(runInternalLinkGuard(parseCliArgs(process.argv.slice(2))));
  } catch (error) {
    console.error('internal-link-guard: FAILED');
    console.error(`- ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
