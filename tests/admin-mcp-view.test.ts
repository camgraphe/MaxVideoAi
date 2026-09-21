import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AdminMcpView } from '../frontend/app/(core)/admin/mcp/_components/AdminMcpView.tsx';
import { McpGenerationOverview } from '../frontend/app/(core)/admin/mcp/_components/McpGenerationOverview.tsx';
import type { AdminMcpMetrics } from '../frontend/server/admin-mcp-metrics.ts';

const unavailable = (reason: string) => ({ status: 'unavailable' as const, reason });

test('a failed recent-generation read never claims that no jobs exist', () => {
  const totals = { accounts: 1, newSignups: 0, generators: 0, submitted: 0, videos: 0, failed: 0, pending: 0, imageGenerators: 1, imagesSubmitted: 1, images: 1, imageFailed: 0, imagePending: 0 };
  const render = (generations: null | []) => renderToStaticMarkup(createElement(McpGenerationOverview, {
    outcomes: { totals, clients: [], generations, notices: [] },
  }));
  const failed = render(null);
  assert.match(failed, /Recent MCP generations are unavailable/);
  assert.doesNotMatch(failed, /No MCP generation job was recorded/);
  assert.match(render([]), /No MCP generation job was recorded/);
});

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
    outcomes: { totals: null, clients: [], generations: [], notices: ['Outcome statistics unavailable.'] },
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

test('the acquisition split remains distinct from self-reported application attribution', () => {
  const metrics = activityMetrics();
  metrics.clientSplit = [
    { client: 'chatgpt', connections: 5 },
    { client: 'claude', connections: 3 },
    { client: 'codex', connections: 2 },
    { client: 'other', connections: 1 },
  ];
  const html = renderToStaticMarkup(createElement(AdminMcpView, {
    metrics,
    outcomes: { totals: null, clients: [], generations: [], notices: [] },
    selectedRange: '7d',
  }));

  assert.match(html, /Acquisition source split/);
  assert.match(html, /acquisition-enabled landing pages/i);
  assert.match(html, /direct.*Other \/ unidentified/i);
  for (const label of ['ChatGPT', 'Claude', 'Codex', 'Other / unidentified']) {
    assert.ok(html.includes(`>${label}<`), label);
  }
});


test('account and completed-video metrics precede tool activity and explain attribution limits', () => {
  const counts = { accounts: 12, newSignups: 3, generators: 4, submitted: 9, videos: 6, failed: 2, pending: 1, imageGenerators: 0, imagesSubmitted: 0, images: 0, imageFailed: 0, imagePending: 0 };
  const html = renderToStaticMarkup(createElement(AdminMcpView, {
    metrics: activityMetrics(), selectedRange: '7d',
    outcomes: { totals: counts, generations: [
      { jobId: 'image-job', surface: 'image', engineId: 'gpt-image-2', engineLabel: 'GPT Image 2', status: 'completed', createdAt: '2026-07-01T12:00:00.000Z', client: 'chatgpt' },
      { jobId: 'video-job', surface: 'video', engineId: 'veo-3', engineLabel: 'Veo 3', status: 'running', createdAt: '2026-07-01T11:00:00.000Z', client: 'codex' },
    ], clients: [
      { ...counts, client: 'chatgpt' }, { ...counts, client: 'claude' },
      { ...counts, client: 'codex' }, { ...counts, client: 'openclaw' },
      { ...counts, client: 'n8n' }, { ...counts, client: 'glama' }, { ...counts, client: 'cursor' },
      { ...counts, client: 'githubCopilot' }, { ...counts, client: 'geminiCli' },
      { ...counts, client: 'microsoftCopilot' }, { ...counts, client: 'other' },
    ], notices: [] },
  }));
  for (const label of [
    'MCP accounts (total)', 'New signups using MCP', 'Users who generated videos',
    'Videos generated', 'ChatGPT', 'Claude', 'Codex', 'OpenClaw', 'n8n', 'Cursor',
    'Glama', 'GitHub Copilot', 'Gemini CLI', 'Microsoft Copilot', 'Other / unidentified',
  ]) {
    assert.ok(html.includes(label), label);
  }
  assert.match(html, /9 video jobs submitted · 1 in progress · 2 failed or cancelled/);
  assert.match(html, /this does not establish the signup source/);
  assert.match(html, /self-reported/);
  assert.match(html, /Glama.*not a verified directory referral/i);
  assert.ok(html.indexOf('MCP accounts and generations') < html.indexOf('Decision overview'));
  assert.match(html, /Users who generated images/);
  assert.match(html, /Images generated/);
  assert.match(html, /Recent MCP generations/);
  for (const value of ['image', 'GPT Image 2', 'gpt-image-2', 'completed', 'video', 'Veo 3', 'veo-3', 'running', '/admin/jobs?jobId=image-job', '/admin/jobs?jobId=video-job']) {
    assert.ok(html.includes(value), value);
  }
});
