import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import * as appSidebarModule from '../frontend/components/AppSidebar.tsx';

Object.assign(globalThis, { React });

test('the workspace promotion gives every supported assistant a direct branded setup link', () => {
  const AssistantConnectionsCard = (
    appSidebarModule as typeof appSidebarModule & {
      AssistantConnectionsCard?: React.ComponentType<{
        t: (path: string, fallback: string) => string;
      }>;
    }
  ).AssistantConnectionsCard;

  assert.equal(
    typeof AssistantConnectionsCard,
    'function',
    'the workspace should expose the assistant connection card',
  );

  const markup = renderToStaticMarkup(
    React.createElement(AssistantConnectionsCard, {
      t: (_path: string, fallback: string) => fallback,
    }),
  );

  for (const [client, href, mark] of [
    ['Claude', '/integrations/claude', '/brand/partners/anthropic/claude-mark-light.svg'],
    ['ChatGPT', '/integrations/chatgpt', '/brand/partners/openai/openai-mark-light.svg'],
    ['Codex', '/integrations/codex', '/brand/partners/openai/openai-mark-light.svg'],
  ]) {
    assert.match(markup, new RegExp(`href="${href}"`), `${client} should open its setup guide`);
    assert.match(markup, new RegExp(`>${client}<\/span>`), `${client} should remain fully visible in the narrow sidebar`);
    assert.match(markup, new RegExp(mark.replaceAll('/', '\\/')), `${client} should show its brand mark`);
  }
});

test('the workspace promotion explains the assistant workflow without a redundant product heading', () => {
  const AssistantConnectionsCard = (
    appSidebarModule as typeof appSidebarModule & {
      AssistantConnectionsCard?: React.ComponentType<{
        t: (path: string, fallback: string) => string;
      }>;
    }
  ).AssistantConnectionsCard;

  assert.equal(typeof AssistantConnectionsCard, 'function');

  const markup = renderToStaticMarkup(
    React.createElement(AssistantConnectionsCard, {
      t: (_path: string, fallback: string) => fallback,
    }),
  );

  assert.match(markup, />Connect<\/p>/);
  assert.doesNotMatch(markup, /AI assistants/);
  assert.doesNotMatch(markup, /Connect to (Claude|ChatGPT|Codex)/);
  assert.match(markup, /role="tooltip"/);
  assert.match(markup, /Connect your account to use MaxVideoAI directly from your AI assistant/);
});
