import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { getLocalizedUrl } from '../frontend/lib/metadataUrls';
import {
  handleMcpHttpRequest,
  type McpHttpHandlerDeps,
} from '../frontend/src/server/mcp/http-handler';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const root = process.cwd();
const supportPath = join(root, 'docs/operations/mcp-support-runbook.md');
const directoryPath = join(root, 'docs/marketing/mcp-directory-submissions.md');
const claimsPath = join(root, 'docs/marketing/mcp-public-claims-matrix.md');
const compatibilityPath = join(root, 'docs/operations/mcp-host-compatibility-matrix.md');
const stagingDeploymentPath = join(root, 'docs/operations/mcp-staging-deployment.md');
const paidRunbookPath = join(root, 'docs/operations/mcp-paid-generation-runbook.md');
const oauthRunbookPath = join(root, 'docs/operations/mcp-oauth-configuration.md');
const foundationSmokePath = join(root, 'docs/operations/mcp-foundation-smoke-test.md');
const launchEvidencePath = join(root, 'docs/marketing/mcp-launch-evidence.md');
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
const stagingDeployment = readFileSync(stagingDeploymentPath, 'utf8');
const paidRunbook = readFileSync(paidRunbookPath, 'utf8');
const oauthRunbook = readFileSync(oauthRunbookPath, 'utf8');
const foundationSmoke = readFileSync(foundationSmokePath, 'utf8');
const launchEvidence = readFileSync(launchEvidencePath, 'utf8');
const publication = JSON.parse(readFileSync(publicationPath, 'utf8')) as Record<string, boolean>;
const statusPage = readFileSync(statusPagePath, 'utf8');
const changelogPage = readFileSync(changelogPagePath, 'utf8');

const DEFAULT_DISCOVERY_TOOLS = [
  'get_account_status',
  'list_models',
  'get_model_details',
  'recommend_models',
  'calculate_project_budget',
];
const OPERATIONAL_TOOLS = [
  ...DEFAULT_DISCOVERY_TOOLS,
  'list_media',
  'create_reference_upload_link',
  'prepare_generation',
  'confirm_generation',
  'get_generation_status',
  'list_recent_generations',
  'present_generation',
  'create_topup_link',
];

const principal: AgentPrincipal = {
  userId: 'task-10-readiness-user',
  clientId: 'task-10-readiness-client',
  emailVerified: true,
  authMethod: 'oauth',
};

function handlerDeps(overrides: Partial<McpHttpHandlerDeps> = {}): McpHttpHandlerDeps {
  return {
    enabled: true,
    config: {
      apiHost: 'api.maxvideoai.com',
      resourceUrl: 'https://api.maxvideoai.com/mcp',
      protectedResourceMetadataUrl:
        'https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp',
      accountUrl: 'https://maxvideoai.com/account/connections',
    },
    async resolvePrincipal() {
      return principal;
    },
    ...overrides,
  };
}

function handlerRequest(body: string | object, init: { method?: string; contentLength?: string } = {}): Request {
  return new Request('https://api.maxvideoai.com/mcp', {
    method: init.method ?? 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer task-10-token',
      'content-type': 'application/json',
      host: 'api.maxvideoai.com',
      ...(init.contentLength ? { 'content-length': init.contentLength } : {}),
    },
    body: (init.method ?? 'POST') === 'POST'
      ? typeof body === 'string' ? body : JSON.stringify(body)
      : undefined,
  });
}

function markdownRow(markdown: string, field: string): string {
  const row = markdown.match(new RegExp(`^\\| ${field} \\|.*$`, 'm'))?.[0];
  assert.ok(row, `missing markdown row: ${field}`);
  return row;
}

function httpsUrls(value: string): string[] {
  return Array.from(value.matchAll(/https:\/\/[^`\s;|]+/g), (match) => match[0]).sort();
}

async function getLiveToolNames(): Promise<string[]> {
  const unavailable = async (): Promise<never> => {
    throw new Error('tool listing must not invoke a service');
  };
  const services: MaxVideoAiMcpServices = {
    getAccountStatus: unavailable,
    listModels: unavailable,
    recommendModels: unavailable,
  };
  const server = createMaxVideoAiMcpServer(principal, services, {
    paidGeneration: false,
    referenceUploads: false,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'task-10-readiness', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    return (await client.listTools()).tools
      .filter((tool) => {
        const ui = tool._meta?.ui;
        const visibility = ui && typeof ui === 'object' && !Array.isArray(ui)
          ? (ui as { visibility?: unknown }).visibility
          : null;
        return !Array.isArray(visibility)
          || !visibility.includes('app')
          || visibility.includes('model');
      })
      .map((tool) => tool.name)
      .sort();
  } finally {
    await client.close();
    await server.close();
  }
}

test('Task 10 creates separate support and distribution readiness owners', () => {
  assert.ok(existsSync(supportPath), 'support runbook should exist');
  assert.ok(existsSync(directoryPath), 'directory package should exist');
  assert.match(support, /^# MaxVideoAI MCP support and disclosure readiness/m);
  assert.match(directory, /^# MaxVideoAI MCP distribution packages/m);
});

test('readiness records the owner-approved direct production publication state', () => {
  const expected = {
    publicMarketing: true,
    publicIndexing: true,
    transport: true,
    oauth: true,
    discovery: true,
    paidGeneration: true,
    trial: false,
    referenceUploads: true,
  };

  assert.deepEqual(publication, expected);
  Object.entries(expected).forEach(([flag, value]) => {
    assert.match(support, new RegExp('\\| `' + flag + '` \\| ' + value + ' \\|'));
    assert.match(directory, new RegExp(`\\b${flag}=${value}\\b`));
  });

  assert.match(support, /DIRECT PRODUCTION RELEASE APPROVED/);
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
  assert.match(support, /contract code that is not\s+observable from the default five-tool discovery registry/i);
});

test('runbook protocol envelopes are produced by the real handler and stay separate from tool failures', async () => {
  const malformedJson = await handleMcpHttpRequest(handlerRequest('{'), handlerDeps());
  assert.equal(malformedJson.status, 400);
  assert.deepEqual(await malformedJson.json(), {
    jsonrpc: '2.0',
    error: { code: -32700, message: 'Invalid JSON.' },
    id: null,
  });

  const unsupportedHttp = await handleMcpHttpRequest(
    handlerRequest('', { method: 'PUT' }),
    handlerDeps(),
  );
  assert.equal(unsupportedHttp.status, 405);
  assert.deepEqual(await unsupportedHttp.json(), {
    jsonrpc: '2.0',
    error: { code: -32600, message: 'Unsupported HTTP method.' },
    id: null,
  });

  const authFailure = await handleMcpHttpRequest(
    handlerRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    handlerDeps({
      async resolvePrincipal() {
        throw new Error('private auth failure');
      },
    }),
  );
  assert.equal(authFailure.status, 500);
  assert.deepEqual(await authFailure.json(), {
    jsonrpc: '2.0',
    error: { code: -32603, message: 'Authentication could not be completed.' },
    id: null,
  });

  const unknownMethod = await handleMcpHttpRequest(
    handlerRequest({ jsonrpc: '2.0', id: 2, method: 'unknown/method', params: {} }),
    handlerDeps(),
  );
  assert.deepEqual(await unknownMethod.json(), {
    jsonrpc: '2.0',
    error: { code: -32601, message: 'Method not found' },
    id: 2,
  });

  const invalidToolParams = await handleMcpHttpRequest(
    handlerRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'list_models', arguments: { surface: 'document' } },
    }),
    handlerDeps(),
  );
  const invalidToolPayload = await invalidToolParams.json();
  assert.equal(invalidToolPayload.jsonrpc, '2.0');
  assert.equal(invalidToolPayload.id, 3);
  assert.equal(invalidToolPayload.result.isError, true);
  assert.match(invalidToolPayload.result.content[0].text, /Invalid arguments for tool list_models/);

  assert.match(support, /^### Transport and protocol errors$/m);
  assert.match(support, /`-32001`[\s\S]*`-32600`[\s\S]*`-32700`[\s\S]*`-32601`[\s\S]*`-32603`/);
  assert.match(support, /SDK validation[\s\S]*tool-level `isError` result/i);
  assert.match(support, /not an exhaustive catalogue of every private SDK message/i);
  assert.match(support, /^### Tool-level failures$/m);
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
    'TermsArticleEn.tsx',
    'TermsArticleFr.tsx',
    'TermsArticleEs.tsx',
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
  assert.match(support, /connected-agent authority and responsibility/i);
  assert.match(support, /agent actions/i);
  assert.match(support, /quote and confirmation/i);
  assert.match(support, /wallet spending/i);
  assert.match(support, /revocation/i);
  assert.match(support, /third-party host terms/i);
  assert.match(support, /approved sufficiency rationale/i);
});

test('status and changelog stay unchanged without a public MCP release or health feed', () => {
  assert.doesNotMatch(statusPage, /\bMCP\b/);
  assert.doesNotMatch(changelogPage, /\bMCP\b/);
  assert.match(support, /No MCP status component was added/);
  assert.match(support, /No MCP changelog entry was added/);
  assert.match(support, /migration files 30–37 are present locally/i);
  assert.match(support, /hosted application used quote,[\s\S]{0,120}media,[\s\S]{0,120}recovery,[\s\S]{0,120}handoff paths/i);
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

test('OpenAI and Anthropic directory blockers are explicit while direct MCP remains separate', () => {
  const directCodex = directory.match(
    /## OpenAI: direct Codex configuration[\s\S]*?(?=\n## OpenAI: public plugin)/,
  )?.[0] ?? '';
  const openAiPlugin = directory.match(
    /## OpenAI: public plugin containing an MCP-backed app[\s\S]*?(?=\n## Anthropic: direct Claude)/,
  )?.[0] ?? '';
  const anthropicDirectory = directory.match(
    /## Anthropic Connectors Directory[\s\S]*?(?=\n## Official MCP Registry)/,
  )?.[0] ?? '';

  assert.match(directCodex, /Package state: \*\*NOT SUBMITTED\*\*/);
  assert.doesNotMatch(directCodex, /commerce eligibility blocker/i);
  assert.match(openAiPlugin, /Package state: \*\*DO NOT SUBMIT — CURRENT COMMERCE ELIGIBILITY BLOCKER\*\*/);
  assert.match(openAiPlugin, /https:\/\/developers\.openai\.com\/apps-sdk\/app-guidelines/);
  assert.match(openAiPlugin, /digital products or services/i);
  assert.match(openAiPlugin, /digital content, tokens, or credits/i);
  assert.match(openAiPlugin, /directly or indirectly/i);
  assert.match(openAiPlugin, /wallet-funded media generation/i);
  assert.match(openAiPlugin, /top-ups/i);
  assert.match(openAiPlugin, /This is a MaxVideoAI eligibility inference/i);
  assert.match(openAiPlugin, /written OpenAI clarification or a policy change/i);
  assert.match(anthropicDirectory, /Package state: \*\*DO NOT SUBMIT — CURRENT POLICY BLOCKER\*\*/);
});

test('each distribution evidence record is sourced, dated, qualified, and owner-actionable', () => {
  assert.ok((directory.match(/\| Source URL \|/g) ?? []).length >= 5);
  assert.ok((directory.match(/\| Checked \| 2026-08-26 \|/g) ?? []).length >= 5);
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

test('owned-site launch payload is exact, localized, complete, and contains negative cases', () => {
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
  assert.match(
    directory,
    /`get_account_status`, `list_models`, `get_model_details`, `recommend_models`, `calculate_project_budget`/,
  );
  assert.match(directory, /Production publication is enabled for direct installation/);
  for (const tool of OPERATIONAL_TOOLS) assert.match(directory, new RegExp(`\\b${tool}\\b`));
  assert.match(directory, /real screenshots and end-to-end demo: NOT AVAILABLE/);
  assert.match(directory, /Owner checklist[\s\S]*Legal[\s\S]*Security[\s\S]*MCP engineering[\s\S]*Growth/);
});

test('readiness packages follow the live registry and canonical localized route owners', async () => {
  const liveTools = await getLiveToolNames();
  const supportRegistryBlock = markdownRow(support, 'Default discovery');
  const supportTools = Array.from(
    supportRegistryBlock.matchAll(/`([a-z][a-z0-9_]*)`/g),
    (match) => match[1],
  ).sort();
  const directoryTools = Array.from(
    markdownRow(directory, 'Current tools').matchAll(/`([a-z][a-z0-9_]*)`/g),
    (match) => match[1],
  ).sort();
  assert.deepEqual(supportTools, liveTools);
  assert.deepEqual(liveTools, [...DEFAULT_DISCOVERY_TOOLS].sort());
  assert.deepEqual(directoryTools, [...OPERATIONAL_TOOLS].sort());

  const localeUrls = (englishPath: string) =>
    (['en', 'fr', 'es'] as const).map((locale) => getLocalizedUrl(locale, englishPath)).sort();
  assert.deepEqual(httpsUrls(markdownRow(directory, 'Canonical landing page')), localeUrls('/mcp'));
  assert.deepEqual(httpsUrls(markdownRow(directory, 'Privacy URLs')), localeUrls('/legal/privacy'));
  assert.deepEqual(httpsUrls(markdownRow(directory, 'Terms URLs')), localeUrls('/legal/terms'));
  assert.deepEqual(
    httpsUrls(markdownRow(directory, 'Acceptable use URLs')),
    localeUrls('/legal/acceptable-use'),
  );
  assert.deepEqual(httpsUrls(markdownRow(directory, 'Support URLs')), localeUrls('/contact'));

  const toolNames = (value: string): string[] =>
    Array.from(value.matchAll(/`([a-z][a-z0-9_]+)`/g), (match) => match[1] as string);
  assert.deepEqual(toolNames(markdownRow(support, 'Default discovery')), DEFAULT_DISCOVERY_TOOLS);
  assert.deepEqual(toolNames(markdownRow(support, 'Operational staging')), OPERATIONAL_TOOLS);
  assert.deepEqual(toolNames(markdownRow(support, 'App-only helper')), ['get_generation_download']);

  const migrations = readdirSync(join(root, 'neon/migrations'));
  for (let id = 30; id <= 37; id += 1) {
    assert.ok(migrations.some((name) => name.startsWith(`${id}_`)), `migration ${id} should exist locally`);
  }
  assert.match(support, /migration files 30–37 are present locally/i);
  assert.match(support, /hosted application used quote,[\s\S]{0,120}media,[\s\S]{0,120}recovery,[\s\S]{0,120}handoff paths/i);
  assert.doesNotMatch(support, /migrations? 30–32 (?:are )?absent|migration 31 (?:is|are) absent/i);
  assert.doesNotMatch(support, /migration[^\n]*\b(?:applied|unapplied)\b/i);

  assert.match(support, /Claude Desktop 1\.37937\.1 and Codex CLI 0\.149\.0-alpha\.4\.3 have controlled\s+staging OAuth and tool-rendering evidence/i);
  assert.doesNotMatch(support, /revocation passed|recorded least-privilege path used|explicit login path[^\n]*passed/i);
  assert.match(support, /public claims matrix owns permissible and prohibited public claims/i);
  assert.match(support, /host compatibility matrix owns local-versus-real-host evidence/i);
  assert.match(support, /support runbook owns support procedures and\s+escalation/i);

  assert.match(paidRunbook, /registry returns to the five default\s+discovery tools/i);
  assert.doesNotMatch(paidRunbook, /three read-only tools|three-tool/i);
  assert.match(stagingDeployment, /Claude Desktop 1\.37937\.1 and Codex CLI 0\.149\.0-alpha\.4\.3 completed controlled\s+OAuth-backed staging sessions/i);
  assert.match(stagingDeployment, /migration files 30–37 are present locally/i);
  assert.match(stagingDeployment, /hosted checkpoint\s+exercised account, quote, media, recovery, upload-handoff, and top-up-handoff/i);
  assert.doesNotMatch(stagingDeployment, /already applied|remains unapplied|migrations? 30–32 (?:are )?absent/i);
  assert.doesNotMatch(stagingDeployment, /Revocation \|.*Authentication required|Reconnect \|.*succeeded/i);
  assert.match(oauthRunbook, /Codex and Claude OAuth, refresh, revocation, and requested-scope behavior remain unverified/i);
  assert.doesNotMatch(oauthRunbook, /Codex CLI \d|requested all four during local testing/i);
  const smokeInventory = foundationSmoke
    .split('\n')
    .find((line) => line.includes('List the five default discovery tools in canonical order:')) ?? '';
  assert.deepEqual(toolNames(smokeInventory), DEFAULT_DISCOVERY_TOOLS);
  const activeRunbooks = readdirSync(join(root, 'docs/operations'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => readFileSync(join(root, 'docs/operations', name), 'utf8'))
    .join('\n');
  assert.doesNotMatch(activeRunbooks, /three-tool|three tools|three read-only tools/i);
  assert.match(launchEvidence, /Neon migrations 29–38 were verified on the\s+Production branch/i);
  assert.match(launchEvidence, /Public smoke evidence returned HTTP 200/i);
  assert.doesNotMatch(launchEvidence, /migrations? 30–32 (?:are )?absent/i);
});

test('directory facts do not outrun checked-in claims or host evidence', () => {
  assert.match(claims, /graphical Codex\/ChatGPT directory install has not been recorded/i);
  assert.match(compatibility, /Last hosted checkpoint: 2026-08-27/);
  assert.match(compatibility, /Publication: transport, OAuth, discovery, paid generation, reference uploads,[\s\S]{0,100}enabled/i);
  assert.match(compatibility, /ChatGPT Apps directory[\s\S]+Not run/i);
  assert.match(
    directory,
    /launch product is a 13-tool[\s\S]{0,300}Claude Desktop\s+1\.37937\.1[\s\S]{0,180}Codex CLI/i,
  );
  assert.match(support, /graphical\s+ChatGPT\/Codex installation, Claude Code, and other hosts remain unverified/i);
  assert.match(support, /migration files 30–37 are present locally/i);
  assert.match(support, /hosted application used quote,[\s\S]{0,120}media,[\s\S]{0,120}recovery,[\s\S]{0,120}handoff paths/i);
  assert.match(directory, /https:\/\/modelcontextprotocol\.io\/registry\/moderation-policy/);
  assert.match(
    directory,
    /moderation policy[^\n]*status[^\n]*`"deleted"`[^\n]*metadata remains accessible/i,
  );
  assert.doesNotMatch(directory, /moderation may retain deleted metadata/i);
  assert.doesNotMatch(compatibility, /All eight flags[^\n]*remain `false`/i);
});
