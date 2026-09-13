import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { getDb } from '../../frontend/src/lib/db';
import type { AgentPrincipal } from '../../frontend/src/server/agent-api/principal';
import { handleMcpHttpRequest } from '../../frontend/src/server/mcp/http-handler';
import type { McpConfig } from '../../frontend/src/server/mcp/config';
import type { MaxVideoAiMcpServices } from '../../frontend/src/server/mcp/server';
import {
  ProviderHarness,
  addTopup,
  createServices,
  principal,
  record,
  structured,
} from '../helpers/mcp-paid-e2e-harness';
import {
  createPaidGenerationTestSchema,
  missingDisposablePostgresCommand,
  startDisposablePostgres,
} from '../helpers/disposable-postgres';

const OPENCLAW_VERSION = '2026.9.4';
const OPENCLAW_COMMIT = '3a9d69db306cd7f081e06254cb89c4bcc14a7107';
const OPENCLAW_PACKAGE_ROOT = process.env.OPENCLAW_PACKAGE_ROOT ?? join(
  homedir(),
  '.openclaw/tools/node-v24.19.0/lib/node_modules/openclaw',
);

type OpenClawRuntime = {
  getCatalog(): Promise<{ servers: Record<string, unknown> }>;
  callTool(serverName: string, toolName: string, input: Record<string, unknown>): Promise<CallToolResult>;
  dispose(): Promise<void>;
  joinCleanup?(): Promise<void>;
};

type OpenClawRuntimeModule = {
  createSessionMcpRuntime(params: Record<string, unknown>): OpenClawRuntime;
};

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function isConfirmation(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const request = body as { method?: unknown; params?: { name?: unknown } };
  return request.method === 'tools/call' && request.params?.name === 'confirm_generation';
}

async function writeResponse(response: Response, outgoing: ServerResponse): Promise<void> {
  const body = Buffer.from(await response.arrayBuffer());
  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  outgoing.end(body);
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function createFaultServer(params: {
  principal: AgentPrincipal;
  services: MaxVideoAiMcpServices;
  configForPort(port: number): McpConfig;
  onConfirmationRequest(): void;
}): Server {
  let port = 0;
  let confirmationDropped = false;
  const server = createServer(async (incoming, outgoing) => {
    try {
      const body = await readRequestBody(incoming);
      const parsedBody = body.length > 0 ? JSON.parse(body.toString('utf8')) : undefined;
      const url = `http://127.0.0.1:${port}${incoming.url ?? '/mcp'}`;
      const request = new Request(url, {
        method: incoming.method,
        headers: incoming.headers as HeadersInit,
        ...(body.length > 0 ? { body } : {}),
      });
      const response = await handleMcpHttpRequest(request, {
        enabled: true,
        config: params.configForPort(port),
        resolvePrincipal: async () => params.principal,
        services: params.services,
      });
      const confirmationRequest = isConfirmation(parsedBody);
      if (confirmationRequest) params.onConfirmationRequest();
      if (!confirmationDropped && confirmationRequest) {
        confirmationDropped = true;
        await response.arrayBuffer();
        outgoing.destroy();
        return;
      }
      await writeResponse(response, outgoing);
    } catch (error) {
      if (!outgoing.destroyed) outgoing.destroy(error as Error);
    }
  });
  server.on('listening', () => {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    port = address.port;
  });
  return server;
}

test('OpenClaw recovers an accepted confirmation after its HTTP response is interrupted without another charge or provider job', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) {
    t.skip(`${missing} is unavailable`);
    return;
  }

  let packageJson: { version?: string };
  let buildInfo: { version?: string; commit?: string };
  try {
    packageJson = JSON.parse(readFileSync(join(OPENCLAW_PACKAGE_ROOT, 'package.json'), 'utf8'));
    buildInfo = JSON.parse(readFileSync(join(OPENCLAW_PACKAGE_ROOT, 'dist/build-info.json'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      t.skip('the pinned local OpenClaw package is unavailable');
      return;
    }
    throw error;
  }
  assert.equal(packageJson.version, OPENCLAW_VERSION);
  assert.deepEqual(
    { version: buildInfo.version, commit: buildInfo.commit },
    { version: OPENCLAW_VERSION, commit: OPENCLAW_COMMIT },
  );

  const openClaw = await import(pathToFileURL(join(
    OPENCLAW_PACKAGE_ROOT,
    'dist/agents/agent-bundle-mcp-runtime.js',
  )).href) as OpenClawRuntimeModule;
  const postgres = await startDisposablePostgres('mcp-oc-drop');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = postgres.databaseUrl;
  t.after(async () => {
    await getDb().end().catch(() => undefined);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await postgres.cleanup();
  });
  await createPaidGenerationTestSchema(postgres.pool);

  const identity = principal('openclaw-interrupted-confirmation');
  await addTopup(postgres.pool, identity.userId, 10_000);
  const provider = new ProviderHarness(postgres.pool);
  const baseServices = createServices({ submitPaidGeneration: provider.submit });
  let injectedPrepareCalls = 0;
  const services: MaxVideoAiMcpServices = {
    ...baseServices,
    async prepareGeneration(input, requestPrincipal) {
      injectedPrepareCalls += 1;
      return baseServices.prepareGeneration!(input, requestPrincipal);
    },
    async listMedia() { throw new Error('not exercised by this fixture'); },
    async createReferenceUploadLink() { throw new Error('not exercised by this fixture'); },
    async importReferenceFiles() { throw new Error('not exercised by this fixture'); },
  };
  let confirmationRequests = 0;
  const configForPort = (port: number): McpConfig => ({
    apiHost: `127.0.0.1:${port}`,
    resourceUrl: `http://127.0.0.1:${port}/mcp`,
    protectedResourceMetadataUrl: `http://127.0.0.1:${port}/.well-known/oauth-protected-resource/mcp`,
    accountUrl: 'https://maxvideoai.com/account/connections',
  });
  const httpServer = createFaultServer({
    principal: identity,
    services,
    configForPort,
    onConfirmationRequest: () => { confirmationRequests += 1; },
  });
  const port = await listen(httpServer);
  t.after(() => closeServer(httpServer));

  const runtime = openClaw.createSessionMcpRuntime({
    sessionId: 'interrupted-confirmation-test',
    workspaceDir: process.cwd(),
    cfg: {
      mcp: {
        servers: {
          maxvideoai: {
            transport: 'streamable-http',
            url: configForPort(port).resourceUrl,
            connectionTimeoutMs: 5_000,
            requestTimeoutMs: 5_000,
          },
        },
      },
    },
    manifestRegistry: { plugins: [] },
  });
  t.after(async () => {
    await runtime.dispose();
    await runtime.joinCleanup?.();
  });

  const catalog = await runtime.getCatalog();
  assert.ok(catalog.servers.maxvideoai);
  const prepared = structured(await runtime.callTool('maxvideoai', 'prepare_generation', {
    surface: 'video',
    engineId: 'seedance-2-0-mini',
    mode: 't2v',
    prompt: 'deterministic local interruption fixture',
    settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: true },
    references: [],
    outputCount: 1,
  }));
  assert.equal(injectedPrepareCalls, 1, 'the real HTTP handler must use the injected test services');
  const quoteId = String(prepared.quoteId);

  await assert.rejects(runtime.callTool('maxvideoai', 'confirm_generation', {
    quoteId,
    confirmed: true,
  }));
  assert.equal(confirmationRequests, 1, 'OpenClaw must not retry an interrupted confirmation');

  const recent = structured(await runtime.callTool('maxvideoai', 'list_recent_generations', {
    surface: 'video',
    limit: 10,
  }));
  const recovered = (recent.items as unknown[]).map(record)
    .find((item) => item.jobId === quoteId);
  assert.ok(recovered);
  assert.equal(recovered.status, 'accepted');

  const status = structured(await runtime.callTool('maxvideoai', 'get_generation_status', {
    jobId: quoteId,
  }));
  assert.equal(status.jobId, quoteId);
  assert.equal(status.status, 'accepted');

  const presentation = structured(await runtime.callTool('maxvideoai', 'present_generation', {
    jobId: quoteId,
  }));
  assert.equal(presentation.jobId, quoteId);
  assert.equal(presentation.status, 'accepted');

  assert.equal(provider.calls(quoteId), 1);
  const persisted = await postgres.pool.query<{
    quote_state: string;
    quote_job_id: string;
    jobs: string;
    charges: string;
    refunds: string;
  }>(`
    SELECT q.state AS quote_state, q.job_id AS quote_job_id,
           (SELECT count(*) FROM app_jobs WHERE job_id = q.job_id::text)::text AS jobs,
           (SELECT count(*) FROM app_receipts WHERE job_id = q.job_id::text AND type = 'charge')::text AS charges,
           (SELECT count(*) FROM app_receipts WHERE job_id = q.job_id::text AND type = 'refund')::text AS refunds
      FROM mcp_generation_quotes q
     WHERE q.quote_id = $1::uuid`, [quoteId]);
  assert.deepEqual(persisted.rows[0], {
    quote_state: 'accepted',
    quote_job_id: quoteId,
    jobs: '1',
    charges: '1',
    refunds: '0',
  });
});
