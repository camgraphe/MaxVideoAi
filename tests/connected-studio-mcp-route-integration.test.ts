import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { startStudioIntegrationRuntime } from './helpers/studio-integration-runtime';
import { STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';
import { postStudioMcpRequest, readStudioMcpResponse } from './helpers/studio-mcp-http-fixture';

test('real loopback MCP authenticates signed bearer, discovers gated tools and writes only local audit evidence', { timeout: 180_000 }, async () => {
  const runtime = await startStudioIntegrationRuntime({
    mcp: {},
    initializeDatabase: async (database) => {
      for (const migration of ['26_studio_projects.sql', '29_mcp_audit_events.sql', '41_mcp_client_family.sql']) {
        await database.pool.query(await readFile(`neon/migrations/${migration}`, 'utf8'));
      }
    },
  });
  try {
    const session = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0], { clientId: 'studio-mcp-local-fixture' });
    const request = (body: unknown, token?: string, cookie?: string) => postStudioMcpRequest(runtime, body, { token, cookie });
    const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'codex', version: 'fixture' },
    } };
    const anonymous = await request(initialize);
    assert.equal(anonymous.status, 401, (await anonymous.clone().text()).slice(0, 1000));
    assert.equal(anonymous.headers.get('www-authenticate'), `Bearer resource_metadata="http://${runtime.mcpHost}/.well-known/oauth-protected-resource/mcp"`);
    const cookie = runtime.auth.cookiesFor(session).map((item) => `${item.name}=${item.value}`).join('; ');
    assert.equal((await request(initialize, undefined, cookie)).status, 401, 'MCP requires bearer, not a Studio session cookie.');
    const forged = session.access_token.split('.');
    forged[2] = `${forged[2][0] === 'A' ? 'B' : 'A'}${forged[2].slice(1)}`;
    assert.equal((await request(initialize, forged.join('.'))).status, 401);
    const initialized = await readStudioMcpResponse(await request(initialize, session.access_token));
    assert.equal(initialized.id, 1);
    assert.equal(initialized.result.serverInfo.name, 'maxvideoai');
    const discovery = await readStudioMcpResponse(await request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, session.access_token));
    const names = discovery.result.tools.map((tool: { name: string }) => tool.name);
    assert.ok(names.includes('list_models'));
    assert.ok(!names.includes('prepare_montage'));
    assert.ok(!names.includes('create_studio_montage'));
    const events = await runtime.database.pool.query('SELECT event_type, user_id, oauth_client_id, client_family FROM mcp_audit_events ORDER BY id');
    assert.deepEqual(events.rows, [
      { event_type: 'connection_initialized', user_id: STUDIO_FIXTURE_OWNERS[0], oauth_client_id: 'studio-mcp-local-fixture', client_family: 'codex' },
      { event_type: 'tool_discovery', user_id: STUDIO_FIXTURE_OWNERS[0], oauth_client_id: 'studio-mcp-local-fixture', client_family: null },
    ]);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_projects')).rows[0].count, 0);
  } finally { await runtime.close(); }
});
