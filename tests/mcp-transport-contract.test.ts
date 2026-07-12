import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { McpAuditEvent } from '../frontend/src/server/agent-api/audit-events';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import {
  handleMcpHttpRequest,
  type McpHttpHandlerDeps,
} from '../frontend/src/server/mcp/http-handler';

const principal: AgentPrincipal = {
  userId: 'user-1',
  clientId: 'client-1',
  emailVerified: true,
  authMethod: 'oauth',
};

function deps(overrides: Partial<McpHttpHandlerDeps> = {}): McpHttpHandlerDeps {
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

function protocolRequest(body: object, extraHeaders: Record<string, string> = {}): Request {
  return new Request('https://api.maxvideoai.com/mcp', {
    method: 'POST',
    headers: {
      authorization: 'Bearer access-token',
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      host: 'api.maxvideoai.com',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

const initializeRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'contract-host', version: '1.0.0' },
  },
};

test('disabled transport is indistinguishable from an absent endpoint', async () => {
  const response = await handleMcpHttpRequest(protocolRequest(initializeRequest), deps({ enabled: false }));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('www-authenticate'), null);
});

test('unauthenticated requests receive RFC 9728 resource metadata guidance', async () => {
  const response = await handleMcpHttpRequest(
    protocolRequest(initializeRequest),
    deps({
      async resolvePrincipal() {
        throw new AgentApiError('AUTH_REQUIRED', 'Bearer authentication is required.');
      },
    })
  );

  assert.equal(response.status, 401);
  assert.equal(
    response.headers.get('www-authenticate'),
    'Bearer resource_metadata="https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp"'
  );
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.doesNotMatch(await response.text(), /access-token|Bearer authentication is required/);
});

test('authenticated initialize uses stateless Streamable HTTP and private caching', async () => {
  const response = await handleMcpHttpRequest(protocolRequest(initializeRequest), deps());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('mcp-session-id'), null);
  assert.equal(payload.jsonrpc, '2.0');
  assert.equal(payload.id, 1);
  assert.equal(payload.result.serverInfo.name, 'maxvideoai');
});

test('successful initialize and tools/list responses are audited after SDK handling', async () => {
  const events: McpAuditEvent[] = [];
  const recordEvent = async (event: McpAuditEvent) => {
    events.push(event);
    return true;
  };

  const initializeResponse = await handleMcpHttpRequest(
    protocolRequest(initializeRequest),
    deps({ recordEvent }),
  );
  const toolsListResponse = await handleMcpHttpRequest(
    protocolRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    deps({ recordEvent }),
  );

  assert.equal(initializeResponse.status, 200);
  assert.equal(toolsListResponse.status, 200);
  assert.equal((await initializeResponse.json()).error, undefined);
  assert.equal((await toolsListResponse.json()).error, undefined);
  assert.deepEqual(events.map((event) => event.eventType), [
    'connection_initialized',
    'tool_discovery',
  ]);
});

test('rejected initialize responses never create success audit events', async () => {
  const events: McpAuditEvent[] = [];
  const response = await handleMcpHttpRequest(
    protocolRequest({ jsonrpc: '2.0', id: 3, method: 'initialize', params: {} }),
    deps({
      async recordEvent(event) {
        events.push(event);
        return true;
      },
    }),
  );
  const payload = await response.json();

  assert.ok(response.status >= 400 || payload.error, 'the malformed initialize request must be rejected');
  assert.deepEqual(events, []);
});

test('transport rejects a production Host even when forwarded-host names staging', async () => {
  const response = await handleMcpHttpRequest(
    protocolRequest(initializeRequest, {
      host: 'maxvideoai.com',
      'x-forwarded-host': 'api.maxvideoai.com',
    }),
    deps(),
  );
  assert.equal(response.status, 404);
});

test('authenticated account tool uses the resolved staging account URL through default services', async () => {
  const stagingOrigin = 'https://maxvideoai-mcp-staging.vercel.app';
  const response = await handleMcpHttpRequest(
    new Request(`${stagingOrigin}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer access-token',
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        host: 'maxvideoai-mcp-staging.vercel.app',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'get_account_status', arguments: {} },
      }),
    }),
    deps({
      config: {
        apiHost: 'maxvideoai-mcp-staging.vercel.app',
        resourceUrl: `${stagingOrigin}/mcp`,
        protectedResourceMetadataUrl:
          `${stagingOrigin}/.well-known/oauth-protected-resource/mcp`,
        accountUrl: `${stagingOrigin}/account/connections`,
      },
      accountStatusDeps: {
        async getWalletSummary() {
          return {
            balanceCents: 0,
            currency: 'USD',
            pendingCents: 0,
            hasCompletedTopUp: false,
          };
        },
      },
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(
    payload.result.structuredContent.accountUrl,
    `${stagingOrigin}/account/connections`,
  );
  assert.deepEqual(payload.result.structuredContent.wallet, {
    amountCents: 0,
    currency: 'USD',
    pendingCents: 0,
  });
});

test('browser HTML negotiation, oversized bodies, wrong hosts, and unsupported methods are rejected safely', async () => {
  const browserRequest = protocolRequest(initializeRequest, { accept: 'text/html' });
  const oversizedRequest = protocolRequest(initializeRequest, { 'content-length': '200000' });
  const wrongHostRequest = new Request('https://maxvideoai.com/api/mcp', {
    method: 'POST',
    headers: {
      authorization: 'Bearer access-token',
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      host: 'maxvideoai.com',
    },
    body: JSON.stringify(initializeRequest),
  });
  const unsupportedRequest = new Request('https://api.maxvideoai.com/mcp', {
    method: 'PUT',
    headers: {
      authorization: 'Bearer access-token',
      accept: 'application/json',
      host: 'api.maxvideoai.com',
    },
  });

  const [browser, oversized, wrongHost, unsupported] = await Promise.all([
    handleMcpHttpRequest(browserRequest, deps()),
    handleMcpHttpRequest(oversizedRequest, deps()),
    handleMcpHttpRequest(wrongHostRequest, deps()),
    handleMcpHttpRequest(unsupportedRequest, deps()),
  ]);

  assert.equal(browser.status, 406);
  assert.equal(oversized.status, 413);
  assert.equal(wrongHost.status, 404);
  assert.equal(unsupported.status, 405);
  assert.equal((await unsupported.json()).error.code, -32600);
});
