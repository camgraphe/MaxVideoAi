import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';

const userId = '10000000-0000-4000-8000-000000000001';
const clientId = '20000000-0000-4000-8000-000000000001';
const sessionId = '30000000-0000-4000-8000-000000000001';
const otherId = '40000000-0000-4000-8000-000000000001';

test('service-only OAuth lookup enforces live consent, session/client ownership and scopes on PostgreSQL', async () => {
  const database = await startDisposablePostgres('mcp-oauth-grant');
  try {
    await database.pool.query(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE TABLE auth.oauth_clients (id uuid PRIMARY KEY, deleted_at timestamptz);
      CREATE TABLE auth.oauth_consents (user_id uuid, client_id uuid, scopes text, revoked_at timestamptz);
      CREATE TABLE auth.sessions (id uuid PRIMARY KEY, user_id uuid, oauth_client_id uuid, scopes text, not_after timestamptz);
    `);
    await database.pool.query(readFileSync('supabase/auth/mcp_oauth_grant_is_active.sql', 'utf8'));
    await database.pool.query('INSERT INTO auth.oauth_clients(id) VALUES ($1)', [clientId]);
    await database.pool.query("INSERT INTO auth.oauth_consents(user_id,client_id,scopes) VALUES ($1,$2,'openid email profile')", [userId, clientId]);
    await database.pool.query("INSERT INTO auth.sessions(id,user_id,oauth_client_id,scopes) VALUES ($1,$2,$3,'openid email profile')", [sessionId, userId, clientId]);

    const connection = await database.pool.connect();
    try {
      for (const role of ['anon', 'authenticated']) {
        await connection.query(`SET ROLE ${role}`);
        await assert.rejects(connection.query('SELECT public.mcp_oauth_grant_is_active($1,$2,$3,$4)', [userId, clientId, sessionId, []]), { code: '42501' });
        await connection.query('RESET ROLE');
      }
      await connection.query('SET ROLE service_role');
      const allowed = await connection.query('SELECT public.mcp_oauth_grant_is_active($1,$2,$3,$4) AS active', [userId, clientId, sessionId, ['openid']]);
      assert.equal(allowed.rows[0].active, true);
      await assert.rejects(connection.query('SELECT * FROM auth.sessions'), { code: '42501' });
      await connection.query('RESET ROLE');
    } finally { await connection.query('RESET ROLE'); connection.release(); }

    const active = async (user = userId, client = clientId, session = sessionId, scopes: string[] | null = ['openid']) => {
      const result = await database.pool.query('SELECT public.mcp_oauth_grant_is_active($1,$2,$3,$4) AS active', [user, client, session, scopes]);
      return result.rows[0].active;
    };
    assert.equal(await active(), true);
    assert.equal(await active(otherId), false);
    assert.equal(await active(userId, otherId), false);
    assert.equal(await active(userId, clientId, otherId), false);
    assert.equal(await active(userId, clientId, sessionId, ['unsupported']), false);
    assert.equal(await active(userId, clientId, sessionId, null), false);

    for (const [mutation, reset] of [
      ['UPDATE auth.oauth_consents SET revoked_at = now()', 'UPDATE auth.oauth_consents SET revoked_at = NULL'],
      ["UPDATE auth.oauth_consents SET scopes = 'email'", "UPDATE auth.oauth_consents SET scopes = 'openid email profile'"],
      ["UPDATE auth.sessions SET scopes = 'email'", "UPDATE auth.sessions SET scopes = 'openid email profile'"],
      ["UPDATE auth.sessions SET not_after = now() - interval '1 second'", 'UPDATE auth.sessions SET not_after = NULL'],
      ['UPDATE auth.oauth_clients SET deleted_at = now()', 'UPDATE auth.oauth_clients SET deleted_at = NULL'],
    ]) {
      await database.pool.query(mutation!);
      assert.equal(await active(), false, mutation);
      await database.pool.query(reset!);
      assert.equal(await active(), true, reset);
    }
    await database.pool.query('DELETE FROM auth.sessions');
    assert.equal(await active(), false, 'A newly reapproved consent cannot reactivate an old deleted session.');
  } finally { await database.cleanup(); }
});
