import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { ADMIN_NAV_GROUPS } from '../frontend/lib/admin/navigation.ts';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/admin/mcp/page.tsx');
const viewPath = join(root, 'frontend/app/(core)/admin/mcp/_components/AdminMcpView.tsx');
const helpersPath = join(root, 'frontend/app/(core)/admin/mcp/_lib/admin-mcp-helpers.ts');
const serverPath = join(root, 'frontend/server/admin-mcp-metrics.ts');
const queriesPath = join(root, 'frontend/server/admin-mcp-metrics-queries.ts');
const publicationPath = join(root, 'frontend/config/mcp-publication.json');

test('admin MCP route remains a thin authenticated server orchestrator', () => {
  for (const path of [pagePath, viewPath, helpersPath, serverPath, queriesPath]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }
  const page = readFileSync(pagePath, 'utf8');
  assert.ok(page.split('\n').length < 200, 'page orchestrator must remain below 200 lines');
  assert.match(page, /requireAdmin\(/);
  assert.match(page, /loadAdminMcpMetrics\(/);
  assert.match(page, /AdminMcpView/);
  assert.match(page, /dynamic = 'force-dynamic'/);
  assert.match(page, /runtime = 'nodejs'/);
  assert.doesNotMatch(page, /AdminMetricGrid|AdminStatTable|<table|function Funnel/);
});

test('admin MCP view owns decision surfaces and explicit unavailable, empty, and alert states', () => {
  const view = readFileSync(viewPath, 'utf8');
  assert.match(view, /export function AdminMcpView/);
  assert.doesNotMatch(view, /['"]use client['"]/);
  for (const owner of ['AdminPageHeader', 'AdminMetricGrid', 'AdminSection', 'AdminNotice', 'AdminEmptyState']) {
    assert.match(view, new RegExp(owner));
  }
  for (const label of ['Funnel', 'Cohort conversion', 'Client split', 'Errors', 'Cost guardrails', 'Publication flags', 'Operations alerts']) {
    assert.match(view, new RegExp(label, 'i'));
  }
  assert.match(view, /Unavailable/i);
  assert.match(view, /No MCP/i);
});

test('route helpers own UTC range parsing, display formatting, and view-model builders', () => {
  const helpers = readFileSync(helpersPath, 'utf8');
  for (const exportName of [
    'resolveAdminMcpRange',
    'buildAdminMcpHref',
    'formatMcpNumber',
    'formatMcpMoney',
    'formatMcpPercent',
    'buildMcpOverviewCards',
  ]) {
    assert.match(helpers, new RegExp(`export function ${exportName}\\(`));
  }
});

test('server metrics stay privacy-safe, read-only, and externally inert', () => {
  const server = readFileSync(serverPath, 'utf8');
  const queries = readFileSync(queriesPath, 'utf8');
  assert.match(server, /export async function loadAdminMcpMetrics/);
  assert.match(server, /export function evaluateMcpOperationsAlerts/);
  assert.match(server, /export async function routeMcpOperationsAlerts/);
  assert.match(server, /MCP_METRIC_PRODUCER_CAPABILITIES/);
  assert.match(server, /recommendationToQuote: MetricAvailability/);
  assert.match(server, /to_regclass/);
  assert.match(server, /from '@\/server\/admin-mcp-metrics-queries'/);
  assert.match(queries, /provider_attempts/);
  assert.match(queries, /app_receipts/);
  assert.match(queries, /mcp_audit_events/);
  assert.doesNotMatch(server, /postSlackMessage|getMailer|sendMail|SLACK_WEBHOOK_URL/);
  assert.doesNotMatch(server, /INSERT\s+INTO|UPDATE\s+\w+|DELETE\s+FROM/i);
  assert.doesNotMatch(server, /\b(prompt|access_token|reference_url|private_media|payment_method|request_snapshot|response_snapshot)\b/i);
  assert.doesNotMatch(queries, /\b(prompt|email|access_token|reference_url|private_media|payment_method|request_snapshot|response_snapshot)\b/i);
  assert.ok(server.split('\n').length <= 500, 'focused server owner should stay below 500 lines');
  assert.ok(queries.split('\n').length <= 500, 'focused query owner should stay below 500 lines');
});

test('MCP acquisition is in Analytics navigation and every publication flag remains false', () => {
  const analytics = ADMIN_NAV_GROUPS.find((group) => group.id === 'analytics');
  assert.deepEqual(analytics?.items.find((item) => item.id === 'mcp'), {
    id: 'mcp',
    label: 'MCP acquisition',
    href: '/admin/mcp',
    icon: 'insights',
  });

  const publication = JSON.parse(readFileSync(publicationPath, 'utf8')) as Record<string, boolean>;
  assert.ok(Object.values(publication).every((value) => value === false));
});
