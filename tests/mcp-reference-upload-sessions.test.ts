import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import type { QueryExecutor, TransactionQueryExecutor } from '../frontend/src/lib/db';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
  MCP_REFERENCE_UPLOAD_LIFETIME_SECONDS,
  claimUploadSessionForUpload,
  completeUploadSession,
  createUploadSession,
  expireUploadSessions,
  getOwnedUploadSession,
} from '../frontend/src/server/agent-api/reference-upload-sessions';

type Call = { sql: string; params: ReadonlyArray<unknown> };

const now = new Date('2026-08-24T10:00:00.000Z');
const expiresAt = new Date('2026-08-24T10:15:00.000Z');
const sessionId = '00000000-0000-4000-8000-000000000032';
const claimId = '00000000-0000-4000-8000-000000000033';
const rawToken = `mru_${'A'.repeat(43)}`;
const tokenHash = createHash('sha256').update(rawToken).digest('hex');

function row(overrides: Record<string, unknown> = {}) {
  return {
    session_id: sessionId,
    token_hash: tokenHash,
    user_id: 'user-a',
    oauth_client_id: 'claude-client',
    media_kind: 'video',
    state: 'created',
    claim_id: null,
    asset_id: null,
    expires_at: expiresAt,
    claimed_at: null,
    uploaded_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

test('createUploadSession stores only a token hash and returns the random token once', async () => {
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      calls.push({ sql, params });
      return [row()] as T[];
    },
  };

  const created = await createUploadSession(
    { userId: 'user-a', oauthClientId: 'claude-client', mediaKind: 'video' },
    { executor, now: () => now, randomUUID: () => sessionId, randomToken: () => rawToken },
  );

  assert.equal(MCP_REFERENCE_UPLOAD_LIFETIME_SECONDS, 15 * 60);
  assert.equal(created.token, rawToken);
  assert.equal(created.session.sessionId, sessionId);
  assert.equal(created.session.mediaKind, 'video');
  assert.equal(created.session.expiresAt.toISOString(), expiresAt.toISOString());
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO mcp_reference_upload_sessions/i);
  assert.ok(calls[0].params.includes(tokenHash));
  assert.equal(calls[0].params.includes(rawToken), false);
  assert.equal(calls[0].sql.includes('token,'), false);
  assert.match(calls[0].sql, /media_kind/i);
  assert.ok(calls[0].params.includes('video'));
});

test('getOwnedUploadSession hashes the bearer token and scopes the read to the authenticated user', async () => {
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      calls.push({ sql, params });
      return [row()] as T[];
    },
  };

  const session = await getOwnedUploadSession({ token: rawToken, userId: 'user-a' }, { executor });
  assert.equal(session?.sessionId, sessionId);
  assert.equal(session?.mediaKind, 'video');
  assert.match(calls[0].sql, /token_hash\s*=\s*\$1[\s\S]*user_id\s*=\s*\$2/i);
  assert.deepEqual(calls[0].params, [tokenHash, 'user-a']);
  assert.doesNotMatch(calls[0].sql, /oauth_client_id\s+IS NOT DISTINCT/i);
});

test('claimUploadSessionForUpload row-locks and allows only a live owned unclaimed session', async () => {
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      calls.push({ sql, params });
      if (/SELECT[\s\S]*FOR UPDATE/i.test(sql)) return [row()] as T[];
      if (/clock_timestamp/i.test(sql)) return [{ current_time: now }] as T[];
      return [row({ claim_id: claimId, claimed_at: now })] as T[];
    },
  };

  const claimed = await claimUploadSessionForUpload(
    { token: rawToken, userId: 'user-a' },
    { executor: executor as TransactionQueryExecutor, randomUUID: () => claimId },
  );

  assert.equal(claimed.claimId, claimId);
  assert.equal(claimed.mediaKind, 'video');
  assert.match(calls[0].sql, /FOR UPDATE/i);
  assert.match(calls.at(-1)?.sql ?? '', /state\s*=\s*'created'[\s\S]*claim_id\s+IS NULL/i);
});

test('claim rejects another user, expiry, replay, and revocation with stable safe errors', async () => {
  async function rejectedWith(
    rows: Record<string, unknown>[],
    code: AgentApiError['code'],
    databaseNow = now,
  ) {
    const executor: QueryExecutor = {
      async query<T>(sql: string) {
        if (/SELECT[\s\S]*FOR UPDATE/i.test(sql)) return rows as T[];
        if (/clock_timestamp/i.test(sql)) return [{ current_time: databaseNow }] as T[];
        return [] as T[];
      },
    };
    await assert.rejects(
      claimUploadSessionForUpload(
        { token: rawToken, userId: 'user-a' },
        { executor: executor as TransactionQueryExecutor, randomUUID: () => claimId },
      ),
      (error: unknown) => error instanceof AgentApiError && error.code === code,
    );
  }

  await rejectedWith([], 'REFERENCE_NOT_FOUND');
  await rejectedWith([row()], 'UPLOAD_EXPIRED', new Date(expiresAt.getTime() + 1));
  await rejectedWith([row({ claim_id: claimId, claimed_at: now })], 'UPLOAD_ALREADY_USED');
  await rejectedWith([row({ state: 'revoked' })], 'UPLOAD_EXPIRED');
});

test('completeUploadSession binds one asset to the exact owner and claim', async () => {
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      calls.push({ sql, params });
      return [row({
        state: 'uploaded', claim_id: claimId, claimed_at: now,
        asset_id: 'asset-video-1', uploaded_at: now, updated_at: now,
      })] as T[];
    },
  };

  const completed = await completeUploadSession(
    { sessionId, userId: 'user-a', claimId, mediaKind: 'video', assetId: 'asset-video-1' },
    { executor: executor as TransactionQueryExecutor, uploadedAt: now },
  );

  assert.equal(completed.assetId, 'asset-video-1');
  assert.equal(completed.state, 'uploaded');
  assert.match(calls[0].sql, /session_id\s*=\s*\$1[\s\S]*user_id\s*=\s*\$2/i);
  assert.match(calls[0].sql, /claim_id\s*=\s*\$3[\s\S]*state\s*=\s*'created'/i);
  assert.match(calls[0].sql, /media_kind\s*=\s*\$4/i);
  assert.ok(calls[0].params.includes('video'));
});

test('session rows fail closed when the persisted media kind is missing or unsupported', async () => {
  for (const mediaKind of [undefined, 'document']) {
    const executor: QueryExecutor = {
      async query<T>() {
        return [row({ media_kind: mediaKind })] as T[];
      },
    };

    await assert.rejects(
      getOwnedUploadSession({ token: rawToken, userId: 'user-a' }, { executor }),
      /Invalid reference upload session row/i,
    );
  }
});

test('expireUploadSessions skips locks and validates the batch count', async () => {
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql: string, params: ReadonlyArray<unknown> = []) {
      calls.push({ sql, params });
      return [{ count: '2' }] as T[];
    },
  };

  assert.equal(await expireUploadSessions({ limit: 10 }, { executor, now: () => now }), 2);
  assert.match(calls[0].sql, /FOR UPDATE SKIP LOCKED/i);
  assert.match(calls[0].sql, /state\s*=\s*'created'[\s\S]*expires_at\s*<=/i);
  await assert.rejects(() => expireUploadSessions({ limit: 0 }, { executor }), /batch size/i);
});
