import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { isMcpApiHost } from '@/lib/mcp-host-routing';
import { AgentApiError } from '@/server/agent-api/errors';
import { recordMcpEvent, type McpAuditEvent } from '@/server/agent-api/audit-events';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import { resolveMcpConfig, type McpConfig } from '@/server/mcp/config';
import { resolveAgentPrincipal } from '@/server/mcp/oauth-adapter';
import { createMaxVideoAiMcpServer } from '@/server/mcp/server';
import { isMcpFoundationFeatureEnabled } from '@/server/mcp/feature-access';

const MAX_BODY_BYTES = 128 * 1024;
const PRIVATE_CACHE_CONTROL = 'private, no-store';
const SUPPORTED_METHODS = new Set(['GET', 'POST', 'DELETE']);

export type McpHttpHandlerDeps = {
  enabled: boolean;
  config: McpConfig;
  resolvePrincipal(request: Request): Promise<AgentPrincipal>;
  recordEvent?(event: McpAuditEvent): Promise<boolean>;
};

function jsonRpcError(status: number, code: number, message: string, headers?: HeadersInit): Response {
  return Response.json(
    { jsonrpc: '2.0', error: { code, message }, id: null },
    {
      status,
      headers: {
        'Cache-Control': PRIVATE_CACHE_CONTROL,
        ...headers,
      },
    }
  );
}

function notFound(): Response {
  return Response.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

function requestHost(request: Request): string {
  return request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host;
}

function rejectsHtmlNegotiation(request: Request): boolean {
  const accept = request.headers.get('accept')?.toLowerCase() ?? '';
  return accept.includes('text/html') && !accept.includes('application/json') && !accept.includes('text/event-stream');
}

async function readBoundedJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return { ok: false, response: jsonRpcError(413, -32600, 'Request body is too large.') };
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { ok: false, response: jsonRpcError(413, -32600, 'Request body is too large.') };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: jsonRpcError(400, -32700, 'Invalid JSON.') };
  }
}

function protocolMethod(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const method = (body as { method?: unknown }).method;
  return typeof method === 'string' ? method : null;
}

async function recordProtocolDiscovery(
  body: unknown,
  principal: AgentPrincipal,
  recorder: ((event: McpAuditEvent) => Promise<boolean>) | undefined
): Promise<void> {
  if (!recorder) return;
  const method = protocolMethod(body);
  const eventType = method === 'initialize' ? 'connection_initialized' : method === 'tools/list' ? 'tool_discovery' : null;
  if (!eventType) return;
  await recorder({
    eventType,
    userId: principal.userId,
    oauthClientId: principal.clientId,
    tool: null,
    outcome: 'success',
    surface: null,
    engineId: null,
    errorCode: null,
  });
}

function withPrivateCaching(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function unauthorized(config: McpConfig): Response {
  return jsonRpcError(401, -32001, 'Authentication required.', {
    'WWW-Authenticate': `Bearer resource_metadata="${config.protectedResourceMetadataUrl}"`,
  });
}

export async function handleMcpHttpRequest(
  request: Request,
  injectedDeps?: McpHttpHandlerDeps
): Promise<Response> {
  const enabled =
    injectedDeps?.enabled ??
    (isMcpFoundationFeatureEnabled('transport') && isMcpFoundationFeatureEnabled('oauth'));
  if (!enabled) return notFound();

  const config = injectedDeps?.config ?? resolveMcpConfig();
  if (!isMcpApiHost(requestHost(request), config.apiHost)) return notFound();
  if (!SUPPORTED_METHODS.has(request.method)) {
    return jsonRpcError(405, -32600, 'Unsupported HTTP method.', { Allow: 'GET, POST, DELETE' });
  }
  if (rejectsHtmlNegotiation(request)) {
    return jsonRpcError(406, -32600, 'MCP requires JSON or event-stream response negotiation.');
  }

  let principal: AgentPrincipal;
  try {
    principal = await (injectedDeps?.resolvePrincipal ?? resolveAgentPrincipal)(request);
  } catch (error) {
    if (error instanceof AgentApiError && error.code === 'AUTH_REQUIRED') return unauthorized(config);
    return jsonRpcError(500, -32603, 'Authentication could not be completed.');
  }

  let parsedBody: unknown;
  if (request.method === 'POST') {
    const parsed = await readBoundedJson(request);
    if (!parsed.ok) return parsed.response;
    parsedBody = parsed.value;
  }

  const recorder = injectedDeps ? injectedDeps.recordEvent : recordMcpEvent;
  await recordProtocolDiscovery(parsedBody, principal, recorder);

  const server = createMaxVideoAiMcpServer(principal);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody });
    return withPrivateCaching(response);
  } catch {
    return jsonRpcError(500, -32603, 'MCP request handling failed.');
  } finally {
    await server.close().catch(() => undefined);
  }
}
