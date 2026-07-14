import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const supportPath = join(root, 'docs/operations/mcp-support-runbook.md');
const directoryPath = join(root, 'docs/marketing/mcp-directory-submissions.md');
const claimsPath = join(root, 'docs/marketing/mcp-public-claims-matrix.md');
const compatibilityPath = join(root, 'docs/operations/mcp-host-compatibility-matrix.md');
const publicationPath = join(root, 'frontend/config/mcp-publication.json');
const statusPagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/status/page.tsx');
const changelogPagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/changelog/page.tsx');

function readIfPresent(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

const support = readIfPresent(supportPath);
const directory = readIfPresent(directoryPath);
const claims = readFileSync(claimsPath, 'utf8');
const compatibility = readFileSync(compatibilityPath, 'utf8');
const publication = JSON.parse(readFileSync(publicationPath, 'utf8')) as Record<string, boolean>;
const statusPage = readFileSync(statusPagePath, 'utf8');
const changelogPage = readFileSync(changelogPagePath, 'utf8');

test('Task 10 creates separate support and distribution readiness owners', () => {
  assert.ok(existsSync(supportPath), 'support runbook should exist');
  assert.ok(existsSync(directoryPath), 'directory package should exist');
  assert.match(support, /^# MaxVideoAI MCP support and disclosure readiness/m);
  assert.match(directory, /^# MaxVideoAI MCP distribution packages/m);
});

test('readiness remains fail closed and records every checked-false publication gate', () => {
  const expectedFlags = [
    'publicMarketing',
    'publicIndexing',
    'transport',
    'oauth',
    'discovery',
    'paidGeneration',
    'trial',
    'referenceUploads',
  ];

  assert.deepEqual(Object.keys(publication), expectedFlags);
  expectedFlags.forEach((flag) => {
    assert.equal(publication[flag], false, `${flag} must remain false`);
    assert.match(support, new RegExp('\\| `' + flag + '` \\| false \\|'));
    assert.match(directory, new RegExp(`\\b${flag}=false\\b`));
  });

  assert.match(support, /NOT READY FOR PUBLIC PROMOTION/);
  assert.match(directory, /NOT SUBMITTED/);
  assert.doesNotMatch(directory, /(?:Status|State):\s*(?:approved|listed|live|published)\b/i);
});

test('support runbook covers every requested current and gated decision tree', () => {
  const requiredTrees = [
    'OAuth connection and consent',
    'Email verification',
    'Quote expiry',
    'Insufficient funds',
    'Spending limit',
    'Upload handoff',
    'Reference validation',
    'Provider rejection or job failure',
    'Wallet refund',
    'Trial restoration',
    'Revoked connection',
  ];

  requiredTrees.forEach((heading) => {
    assert.match(support, new RegExp(`^### ${heading}$`, 'm'), `missing support tree: ${heading}`);
  });

  assert.match(support, /HTTP 401 \/ JSON-RPC `-32001`/);
  assert.match(support, /`INTERNAL_ERROR`/);
  for (const code of [
    'EMAIL_VERIFICATION_REQUIRED',
    'QUOTE_EXPIRED',
    'INSUFFICIENT_FUNDS',
    'SPENDING_LIMIT_EXCEEDED',
    'PARAMETER_INVALID',
    'REFERENCE_INVALID',
    'PROVIDER_REJECTED',
    'JOB_FAILED',
  ]) {
    assert.match(support, new RegExp('`' + code + '`'));
  }
  assert.match(support, /reserved contract code; not observable from the three-tool\s+registry/i);
});

test('privacy readiness separates service content from minimized MCP ledgers', () => {
  for (const concept of [
    'User-facing permissions',
    'Stored data categories',
    'Media and reference retention',
    'Trial abuse prevention',
    'Spending confirmation',
    'Provider processing',
    'Incident handling',
    'Escalation ownership',
  ]) {
    assert.match(support, new RegExp(`^### ${concept}$`, 'm'));
  }

  assert.match(support, /MCP funnel ledger excludes[^\n]*prompts/i);
  assert.match(support, /access tokens/i);
  assert.match(support, /raw reference URLs/i);
  assert.match(support, /payment (?:details|methods)/i);
  assert.match(support, /service still processes prompts,\s+inputs, outputs, and\s+uploads/i);
  assert.doesNotMatch(support, /MCP stores no user data/i);
  assert.doesNotMatch(support, /references are never stored/i);
  assert.doesNotMatch(`${support}\n${directory}`, /Bearer\s+[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(`${support}\n${directory}`, /(?:client_secret|access_token|refresh_token)\s*[:=]\s*\S+/i);
});

test('legal changes remain an explicit three-locale owner-review patch plan', () => {
  assert.match(support, /LEGAL OWNER REVIEW REQUIRED/);
  for (const file of [
    'PrivacyArticleEn.tsx',
    'PrivacyArticleFr.tsx',
    'PrivacyArticleEs.tsx',
    'legal\/acceptable-use\/page.tsx',
  ]) {
    assert.match(support, new RegExp(file));
  }
  assert.match(support, /No binding legal text was changed in Task 10/);

  for (const locale of ['English', 'French', 'Spanish']) {
    assert.match(support, new RegExp(`\\| ${locale} \\|`));
  }
  assert.match(support, /retention period.*owner decision/i);
  assert.match(support, /lawful basis[\s\S]{0,160}owner decision/i);
});

test('status and changelog stay unchanged without MCP operational evidence', () => {
  assert.doesNotMatch(statusPage, /\bMCP\b/);
  assert.doesNotMatch(changelogPage, /\bMCP\b/);
  assert.match(support, /No MCP status component was added/);
  assert.match(support, /No MCP changelog entry was added/);
  assert.match(support, /migrations 30–32 are absent/i);
  assert.match(support, /migration 33 is unapplied/i);
  assert.match(support, /That live MCP-specific\s+health source is currently absent/i);
});

test('distribution packages keep Codex, ChatGPT plugin, Claude, and neutral registry evidence separate', () => {
  for (const heading of [
    'OpenAI: direct Codex configuration',
    'OpenAI: public plugin containing an MCP-backed app',
    'Anthropic: direct Claude custom connector',
    'Anthropic Connectors Directory',
    'Official MCP Registry',
  ]) {
    assert.match(directory, new RegExp(`^## ${heading}$`, 'm'), `missing distribution package: ${heading}`);
  }

  assert.match(directory, /Codex MCP compatibility does not\s+establish plugin eligibility/);
  assert.match(directory, /Claude custom-connector compatibility does not establish directory eligibility/);
  assert.match(directory, /ChatGPT plugin approval is not a Codex host decision test/);
  assert.match(directory, /AI models to generate images, video, or audio[^\n]*not accepted/i);
  assert.match(directory, /do not submit MaxVideoAI to the Anthropic Connectors Directory/i);
  assert.match(directory, /metadata repository[^\n]*not a curated endorsement/i);
});

test('each distribution evidence record is sourced, dated, qualified, and owner-actionable', () => {
  assert.ok((directory.match(/\| Source URL \|/g) ?? []).length >= 5);
  assert.ok((directory.match(/\| Checked \| 2026-07-14 \|/g) ?? []).length >= 5);
  assert.ok((directory.match(/\| Evidence state \|/g) ?? []).length >= 5);
  assert.ok((directory.match(/\| Uncertainty \|/g) ?? []).length >= 5);

  const urls = Array.from(directory.matchAll(/https:\/\/[^\s)>|]+/g), (match) => match[0]);
  const openAiUrls = urls.filter((url) => /openai|chatgpt/i.test(url));
  const anthropicUrls = urls.filter((url) => /anthropic|claude/i.test(url));
  assert.ok(openAiUrls.length >= 3, 'expected direct OpenAI sources');
  assert.ok(
    openAiUrls.every((url) => /https:\/\/(?:developers\.openai\.com|learn\.chatgpt\.com|platform\.openai\.com)\//.test(url)),
    `OpenAI claims must use official sources: ${openAiUrls.join(', ')}`
  );
  assert.ok(anthropicUrls.length >= 3, 'expected direct Anthropic sources');
  assert.ok(
    anthropicUrls.every((url) => /https:\/\/(?:claude\.com|support\.claude\.com|www\.anthropic\.com)\//.test(url)),
    `Anthropic claims must use official sources: ${anthropicUrls.join(', ')}`
  );
});

test('listing payload is exact, localized, read-only, and contains negative cases', () => {
  for (const field of [
    'Product name',
    'Canonical landing page',
    'Canonical endpoint',
    'Domain ownership',
    'Concise description',
    'Requested scopes',
    'Privacy URLs',
    'Terms URLs',
    'Acceptable use URLs',
    'Support URLs',
    'Current tools',
    'Negative cases',
    'Screenshots and demo',
    'Changelog and status',
    'Owner checklist',
  ]) {
    assert.match(directory, new RegExp(`\\| ${field} \\|`), `missing listing field: ${field}`);
  }

  for (const url of [
    'https://maxvideoai.com/mcp',
    'https://maxvideoai.com/fr/mcp',
    'https://maxvideoai.com/es/mcp',
    'https://maxvideoai.com/legal/privacy',
    'https://maxvideoai.com/fr/legal/privacy',
    'https://maxvideoai.com/es/legal/privacy',
    'https://maxvideoai.com/legal/terms',
    'https://maxvideoai.com/fr/legal/terms',
    'https://maxvideoai.com/es/legal/terms',
    'https://maxvideoai.com/legal/acceptable-use',
    'https://maxvideoai.com/fr/legal/acceptable-use',
    'https://maxvideoai.com/es/legal/acceptable-use',
    'https://maxvideoai.com/contact',
    'https://maxvideoai.com/fr/contact',
    'https://maxvideoai.com/es/contact',
    'https://api.maxvideoai.com/mcp',
  ]) {
    assert.match(directory, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(directory, /`openid`, `email`, `profile`/);
  assert.match(directory, /`get_account_status`, `list_models`, `recommend_models`/);
  assert.match(directory, /No generation, quote, upload, trial, payment, or polling tool is currently public/);
  assert.match(directory, /real screenshots and end-to-end demo: NOT AVAILABLE/);
  assert.match(directory, /Owner checklist[\s\S]*Legal[\s\S]*Security[\s\S]*MCP engineering[\s\S]*Growth/);
});

test('directory facts do not outrun checked-in claims or host evidence', () => {
  assert.match(claims, /Codex app compatibility has not yet been validated/);
  assert.match(compatibility, /token-expiry refresh pending/);
  assert.match(directory, /no recorded real Codex, Claude, or other-host selection bundle/i);
  assert.match(directory, /Codex default[\s\S]{0,80}`phone`[\s\S]{0,80}blocker/i);
  assert.match(directory, /Claude Desktop[^\n]*token refresh[^\n]*pending/i);
  assert.match(directory, /migrations 30–32[^\n]*absent/i);
  assert.match(directory, /migration 33[^\n]*unapplied/i);
});
