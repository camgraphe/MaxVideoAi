#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const errors = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
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

function relativeFromRoot(absolutePath) {
  return path.relative(ROOT, absolutePath).replaceAll(path.sep, '/');
}

const footerPath = 'frontend/components/marketing/MarketingFooter.tsx';
const navPath = 'frontend/components/marketing/MarketingNav.tsx';
const appHeaderPath = 'frontend/components/HeaderBar.tsx';
const obfuscatedEmailPath = 'frontend/components/marketing/ObfuscatedEmailLink.tsx';
const dictionariesPath = 'frontend/lib/i18n/dictionaries.ts';
const companyPagePath = 'frontend/app/(localized)/[locale]/(marketing)/company/page.tsx';

const footerSource = read(footerPath);
const navSource = read(navPath);
const appHeaderSource = read(appHeaderPath);
const obfuscatedEmailSource = read(obfuscatedEmailPath);
const dictionariesSource = read(dictionariesPath);
const companyPageSource = read(companyPagePath);

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
assert(/MARKETING_TOP_NAV_HREF_BY_KEY/.test(appHeaderSource), 'App header must normalize nav links with top-nav allowlist.');

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
  assert(!pattern.test(companyPageSource), `Company trust hub must not link to strategic destination (${pattern}).`);
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
  assert(
    footerLinks.length === 1 && footerLinks[0]?.href === '/legal',
    `${localeFile}: footer.links must contain exactly one /legal entry.`
  );
  assert(!Object.prototype.hasOwnProperty.call(productItems, 'workflows'), `${localeFile}: footer product links must not include workflows.`);
  assert(!Object.prototype.hasOwnProperty.call(companyItems, 'about'), `${localeFile}: footer company links must not include about.`);
  assert(!Object.prototype.hasOwnProperty.call(companyItems, 'contact'), `${localeFile}: footer company links must not include contact.`);
  assert(Object.prototype.hasOwnProperty.call(companyItems, 'companyHub'), `${localeFile}: footer company links must include companyHub.`);
}

const companyAllowedFiles = new Set([
  'frontend/components/marketing/MarketingFooter.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/company/page.tsx',
  'frontend/app/company/page.tsx',
  'frontend/config/localized-slugs.json',
  'frontend/i18n/routing.ts',
  'frontend/lib/seo/hreflang.ts',
  'frontend/next-sitemap.config.js',
  'frontend/middleware.ts',
]);

const frontendRoot = path.join(ROOT, 'frontend');
for (const file of walk(frontendRoot)) {
  const relativePath = relativeFromRoot(file);
  if (companyAllowedFiles.has(relativePath)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const hasInternalCompanyReference =
    /href\s*=\s*['"]\/company(?:[/"#?]|['"])/.test(source) ||
    /pathname\s*:\s*['"]\/company['"]/.test(source) ||
    /['"]\/company['"]/.test(source);
  if (hasInternalCompanyReference) {
    errors.push(`Found unexpected /company reference outside allowed files: ${relativePath}`);
  }
}

if (errors.length) {
  console.error('internal-link-guard: FAILED');
  for (const item of errors) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log('internal-link-guard: OK');
