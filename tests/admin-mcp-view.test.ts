import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AdminMcpView } from '../frontend/app/(core)/admin/mcp/_components/AdminMcpView.tsx';
import type { AdminMcpMetrics } from '../frontend/server/admin-mcp-metrics.ts';

const unavailable = (reason: string) => ({ status: 'unavailable' as const, reason });

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function activityMetrics(): AdminMcpMetrics {
  return {
    range: {
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-02T00:00:00.000Z',
      timeZone: 'UTC',
    },
    availability: {
      funnel: unavailable('Funnel pending.'),
      audit: { status: 'available' },
      recommendationToQuote: unavailable('Recommendation pending.'),
      receipts: unavailable('Receipts pending.'),
      providerCosts: unavailable('Costs pending.'),
      polling: { status: 'available' },
      uploads: unavailable('Uploads pending.'),
      restorations: unavailable('Restorations pending.'),
      revocation: unavailable('Revocation pending.'),
      authentication: unavailable('Authentication pending.'),
    },
    activity: {
      connectedUsers: 9,
      newConnectedUsers: 4,
      returningConnectedUsers: 5,
      connectionEvents: 14,
      activeToolUsers: 7,
      toolCalls: 20,
      successfulToolCalls: 17,
      failedToolCalls: 3,
      toolSuccessRate: 0.85,
    },
    toolUsage: [
      { tool: 'list_models', calls: 12, users: 6, failures: 1, successRate: 11 / 12 },
      { tool: 'recommend_models', calls: 8, users: 4, failures: 2, successRate: 0.75 },
    ],
    funnel: null,
    trialToWalletRate: null,
    clientSplit: null,
    quoteToConfirmRate: null,
    recommendationToQuoteRate: null,
    firstPaidUsers: null,
    repeatPaidUsers: null,
    revenueCents: null,
    providerCostCents: null,
    trialCostCents: null,
    refundsCents: null,
    refundRate: null,
    releaseRate: null,
    errors: [{ code: 'UNKNOWN', count: 41 }],
    pollingCalls: 6,
    pollingCallsPerMinute: 0.004,
    revocationRate: null,
    trialVolume: null,
    authErrors: null,
    uploadFailures: null,
    refundRestorationFailures: null,
    featureFlags: {},
    alerts: [],
  };
}

test('MCP admin renders live activity before a collapsed measurement coverage disclosure', () => {
  const html = renderToStaticMarkup(createElement(AdminMcpView, {
    metrics: activityMetrics(),
    selectedRange: '24h',
  }));

  assert.match(html, /Connected users/);
  assert.match(html, /Installs are not directly observable/);
  assert.match(html, /Authenticated activity/);
  assert.match(html, /Returning users/);
  assert.match(html, /Successful tool calls/);
  assert.match(html, /Status polling calls/);
  assert.match(html, /Tool usage/);
  assert.match(html, /list_models/);
  assert.match(html, /12 calls · 6 users · 1 failed/);
  assert.match(html, /41 tool failures lack a structured error code/);
  assert.doesNotMatch(html, />UNKNOWN</);
  assert.match(html, /<details/);
  assert.match(html, /8 measurements pending/);
  assert.ok(
    html.indexOf('Decision overview') < html.indexOf('8 measurements pending'),
    'live decision metrics should render before the pending measurement disclosure',
  );
});
