import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isIP } from 'node:net';

import { getMcpRequestHost, isMcpApiHost } from '@/lib/mcp-host-routing';
import type { AgentAccountStatusWalletDeps } from '@/server/agent-api/account-status';
import { AgentApiError } from '@/server/agent-api/errors';
import { recordMcpEvent, type McpAuditEvent } from '@/server/agent-api/audit-events';
import {
  bindAuthenticatedMcpConnection,
  type McpConnectionBindingResult,
} from '@/server/agent-api/mcp-funnel';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import { resolveMcpConfig, type McpConfig } from '@/server/mcp/config';
import { resolveAgentPrincipal } from '@/server/mcp/oauth-adapter';
import {
  createDefaultMaxVideoAiMcpServices,
  createMaxVideoAiMcpServer,
} from '@/server/mcp/server';
import { isMcpFoundationFeatureEnabled } from '@/server/mcp/feature-access';
import { resolveMcpRuntimeCapabilities } from '@/server/mcp/operational-access';
import { withMcpNoindexHeaders } from '@/server/mcp/response-headers';
import type { TrialRiskRequestContext } from '@/server/agent-api/prepare-generation';

const MAX_BODY_BYTES = 128 * 1024;
const PRIVATE_CACHE_CONTROL = 'private, no-store';
const SUPPORTED_METHODS = new Set(['GET', 'POST', 'DELETE']);

export type McpHttpHandlerDeps = {
  enabled: boolean;
  config: McpConfig;
  resolvePrincipal(request: Request): Promise<AgentPrincipal>;
  recordEvent?(event: McpAuditEvent): Promise<boolean>;
  recordConnection?(principal: AgentPrincipal): Promise<McpConnectionBindingResult>;
  accountStatusDeps?: AgentAccountStatusWalletDeps;
};

function jsonRpcError(status: number, code: number, message: string, headers?: HeadersInit): Response {
  return Response.json(
    { jsonrpc: '2.0', error: { code, message }, id: null },
    {
      status,
      headers: withMcpNoindexHeaders({
        'Cache-Control': PRIVATE_CACHE_CONTROL,
        ...headers,
      }),
    }
  );
}

function notFound(): Response {
  return Response.json(
    { error: 'not_found' },
    { status: 404, headers: withMcpNoindexHeaders({ 'Cache-Control': 'no-store' }) },
  );
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

const AUDITABLE_TOOL_NAMES = new Set([
  'get_account_status',
  'list_models',
  'get_model_details',
  'recommend_models',
  'calculate_project_budget',
  'prepare_generation',
  'confirm_generation',
  'get_generation_download',
  'get_generation_status',
  'list_recent_generations',
  'present_generation',
  'create_topup_link',
  'list_media',
  'create_reference_upload_link',
  'import_reference_files',
]);

async function readJsonRpcResponse(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const payload = await response.clone().json();
    return response.ok
      && (
      payload != null &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      (payload as { jsonrpc?: unknown }).jsonrpc === '2.0'
      )
      ? payload as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function toolName(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const params = (body as { params?: unknown }).params;
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
  const name = (params as { name?: unknown }).name;
  return typeof name === 'string' && AUDITABLE_TOOL_NAMES.has(name) ? name : null;
}

function toolOutcome(payload: Record<string, unknown>): 'success' | 'failure' {
  if (Object.prototype.hasOwnProperty.call(payload, 'error')) return 'failure';
  const result = payload.result;
  return result && typeof result === 'object' && !Array.isArray(result)
    && (result as { isError?: unknown }).isError === true
    ? 'failure'
    : 'success';
}

async function recordProtocolActivity(
  body: unknown,
  response: Response,
  principal: AgentPrincipal,
  recorder: ((event: McpAuditEvent) => Promise<boolean>) | undefined,
  connectionRecorder: ((principal: AgentPrincipal) => Promise<McpConnectionBindingResult>) | undefined,
): Promise<void> {
  const method = protocolMethod(body);
  if (!method) return;
  const payload = await readJsonRpcResponse(response);
  if (!payload) return;

  if (method === 'initialize' || method === 'tools/list') {
    if (Object.prototype.hasOwnProperty.call(payload, 'error')
      || !Object.prototype.hasOwnProperty.call(payload, 'result')) return;
    const eventType = method === 'initialize' ? 'connection_initialized' : 'tool_discovery';
    await recorder?.({
      eventType,
      userId: principal.userId,
      oauthClientId: principal.clientId,
      tool: null,
      outcome: 'success',
      surface: null,
      engineId: null,
      errorCode: null,
    }).catch(() => false);
    await connectionRecorder?.(principal).catch(() => 'unavailable');
    return;
  }

  if (method === 'tools/call' && recorder) {
    const tool = toolName(body);
    if (!tool) return;
    await recorder({
      eventType: 'tool_call',
      userId: principal.userId,
      oauthClientId: principal.clientId,
      tool,
      outcome: toolOutcome(payload),
      surface: null,
      engineId: null,
      errorCode: null,
    }).catch(() => false);
  }
}

function withPrivateCaching(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
  const privateHeaders = withMcpNoindexHeaders(headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: privateHeaders,
  });
}

function unauthorized(config: McpConfig): Response {
  return jsonRpcError(401, -32001, 'Authentication required.', {
    'WWW-Authenticate': `Bearer resource_metadata="${config.protectedResourceMetadataUrl}"`,
  });
}

export function resolveTrialRiskRequestContext(headers: Headers): TrialRiskRequestContext {
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    headers.get('x-vercel-forwarded-for'),
    headers.get('x-forwarded-for')?.split(',')[0] ?? null,
  ];
  let clientIp: string | null = null;
  for (const candidate of candidates) {
    if (candidate === null) continue;
    const normalized = candidate.trim();
    clientIp = isIP(normalized) === 0 ? null : normalized;
    break;
  }
  const rawUserAgent = headers.get('user-agent');
  const userAgent = rawUserAgent !== null
    && rawUserAgent.length <= 2_048
    && !/[\u0000\r\n]/u.test(rawUserAgent)
    ? rawUserAgent
    : null;
  return Object.freeze({ clientIp, userAgent });
}

export async function handleMcpHttpRequest(
  request: Request,
  injectedDeps?: McpHttpHandlerDeps
): Promise<Response> {
  const requestHost = getMcpRequestHost(request.headers);
  const capabilities = resolveMcpRuntimeCapabilities(process.env, requestHost);
  const enabled =
    injectedDeps?.enabled ??
    (isMcpFoundationFeatureEnabled('transport', process.env, requestHost) &&
      isMcpFoundationFeatureEnabled('oauth', process.env, requestHost));
  if (!enabled) return notFound();

  const config = injectedDeps?.config ?? resolveMcpConfig();
  if (!requestHost || !isMcpApiHost(requestHost, config.apiHost)) return notFound();
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

  const server = createMaxVideoAiMcpServer(
    principal,
    createDefaultMaxVideoAiMcpServices(
      config,
      resolveTrialRiskRequestContext(request.headers),
      capabilities,
      injectedDeps?.accountStatusDeps,
    ),
    capabilities,
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody });
    const recorder = injectedDeps ? injectedDeps.recordEvent : recordMcpEvent;
    const connectionRecorder = injectedDeps
      ? injectedDeps.recordConnection
      : bindAuthenticatedMcpConnection;
    await recordProtocolActivity(parsedBody, response, principal, recorder, connectionRecorder);
    return withPrivateCaching(response);
  } catch {
    return jsonRpcError(500, -32603, 'MCP request handling failed.');
  } finally {
    await server.close().catch(() => undefined);
  }
}
