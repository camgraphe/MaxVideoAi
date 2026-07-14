import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from 'pg';
import type Stripe from 'stripe';

import type { QueryExecutor } from '../frontend/src/lib/db';

type CommandResult = ReturnType<typeof spawnSync>;

function commandExists(command: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

function commandFailure(result: CommandResult): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

test('migration 33 and funnel helpers enforce constraints, canonical receipt replay, and OAuth races in real PostgreSQL', async (t) => {
  for (const command of ['initdb', 'pg_ctl', 'psql']) {
    if (!commandExists(command)) {
      t.skip(`${command} is unavailable`);
      return;
    }
  }

  const root = process.cwd();
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'mcp-funnel-postgres-'));
  const dataDirectory = join(temporaryRoot, 'data');
  const socketDirectory = join(temporaryRoot, 'socket');
  mkdirSync(socketDirectory);

  const init = spawnSync('initdb', [
    '-A', 'trust', '-U', 'postgres', '-D', dataDirectory, '--no-locale', '--encoding=UTF8',
  ], { encoding: 'utf8' });
  assert.equal(init.status, 0, commandFailure(init));

  const serverOptions = `-F -k ${socketDirectory} -c listen_addresses=''`;
  const start = spawnSync('pg_ctl', [
    '-D', dataDirectory, '-o', serverOptions, '-w', 'start',
  ], { encoding: 'utf8', stdio: 'ignore' });
  assert.equal(start.status, 0, commandFailure(start));

  t.after(() => {
    spawnSync('pg_ctl', ['-D', dataDirectory, '-m', 'immediate', '-w', 'stop'], {
      encoding: 'utf8', stdio: 'ignore',
    });
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  const psql = (...args: string[]) => spawnSync('psql', [
    '-X', '-h', socketDirectory, '-U', 'postgres', '-d', 'postgres', ...args,
  ], { encoding: 'utf8' });

  const prerequisites = psql(
    '-v', 'ON_ERROR_STOP=1',
    '-c', [
      'CREATE TABLE public.mcp_generation_quotes (id uuid PRIMARY KEY)',
      'CREATE TABLE public.mcp_trial_entitlements (id bigint PRIMARY KEY)',
      'CREATE TABLE public.mcp_reference_upload_sessions (id bigint PRIMARY KEY)',
    ].join('; '),
  );
  assert.equal(prerequisites.status, 0, commandFailure(prerequisites));

  const migration = psql(
    '--single-transaction',
    '-v', 'ON_ERROR_STOP=1',
    '-f', join(root, 'neon/migrations/33_mcp_acquisition_funnel.sql'),
  );
  assert.equal(migration.status, 0, commandFailure(migration));

  const valid = psql('-v', 'ON_ERROR_STOP=1', '-c', `
    INSERT INTO mcp_funnel_events (
      event_type, stage, user_id, oauth_client_id, source, medium, campaign,
      acquisition_client, acquisition_id, amount_cents, currency, idempotency_key, receipt_hash
    ) VALUES (
      'wallet_funded', 'wallet_funded', 'user-valid', 'client-valid',
      'direct_mcp', 'mcp', 'none', 'other', NULL, 2500, 'USD',
      'valid-wallet-funded', repeat('a', 64)
    )
  `);
  assert.equal(valid.status, 0, commandFailure(valid));

  const invalidStatements = new Map<string, string>([
    ['required completion stage', `
      INSERT INTO mcp_funnel_events (
        event_type, stage, user_id, source, medium, campaign, acquisition_client, idempotency_key
      ) VALUES (
        'oauth_connection_completed', NULL, 'user-stage',
        'direct_mcp', 'mcp', 'none', 'other', 'invalid-null-stage'
      )
    `],
    ['required user', `
      INSERT INTO mcp_funnel_events (
        event_type, stage, user_id, source, medium, campaign, acquisition_client, idempotency_key
      ) VALUES (
        'tool_called', NULL, NULL,
        'direct_mcp', 'mcp', 'none', 'other', 'invalid-null-user'
      )
    `],
    ['required OAuth client on pending start', `
      INSERT INTO mcp_funnel_events (
        event_type, stage, user_id, oauth_client_id, source, medium, campaign,
        acquisition_client, acquisition_id, idempotency_key
      ) VALUES (
        'oauth_connection_started', NULL, 'user-client', NULL,
        'mcp_landing', 'owned', 'mcp_connect', 'claude',
        'acq_ABCDEFGHIJKLMNOPQRSTUVWX', 'invalid-null-oauth-client'
      )
    `],
    ['required landing acquisition', `
      INSERT INTO mcp_funnel_events (
        event_type, stage, user_id, source, medium, campaign,
        acquisition_client, acquisition_id, idempotency_key
      ) VALUES (
        'landing_cta_clicked', NULL, NULL,
        'mcp_landing', 'owned', 'mcp_connect', 'claude', NULL,
        'invalid-null-acquisition'
      )
    `],
    ['required wallet amount', `
      INSERT INTO mcp_funnel_events (
        event_type, stage, user_id, source, medium, campaign, acquisition_client,
        amount_cents, currency, idempotency_key, receipt_hash
      ) VALUES (
        'wallet_funded', 'wallet_funded', 'user-wallet-amount',
        'direct_mcp', 'mcp', 'none', 'other', NULL, NULL,
        'invalid-null-wallet-amount', NULL
      )
    `],
    ['required wallet currency', `
      INSERT INTO mcp_funnel_events (
        event_type, stage, user_id, source, medium, campaign, acquisition_client,
        amount_cents, currency, idempotency_key, receipt_hash
      ) VALUES (
        'wallet_funded', 'wallet_funded', 'user-wallet-currency',
        'direct_mcp', 'mcp', 'none', 'other', 2500, NULL,
        'invalid-null-wallet-currency', repeat('b', 64)
      )
    `],
    ['required wallet receipt hash', `
      INSERT INTO mcp_funnel_events (
        event_type, stage, user_id, source, medium, campaign, acquisition_client,
        amount_cents, currency, idempotency_key, receipt_hash
      ) VALUES (
        'wallet_funded', 'wallet_funded', 'user-wallet-receipt',
        'direct_mcp', 'mcp', 'none', 'other', 2500, 'USD',
        'invalid-null-wallet-receipt', NULL
      )
    `],
    ['paired quote currency', `
      INSERT INTO mcp_funnel_events (
        event_type, stage, user_id, source, medium, campaign, acquisition_client,
        amount_cents, currency, idempotency_key
      ) VALUES (
        'trial_quote_prepared', 'trial_prepared', 'user-quote-currency',
        'direct_mcp', 'mcp', 'none', 'other', 100, NULL,
        'invalid-null-quote-currency'
      )
    `],
    ['paired quote amount', `
      INSERT INTO mcp_funnel_events (
        event_type, stage, user_id, source, medium, campaign, acquisition_client,
        amount_cents, currency, idempotency_key
      ) VALUES (
        'trial_quote_prepared', 'trial_prepared', 'user-quote-amount',
        'direct_mcp', 'mcp', 'none', 'other', NULL, 'USD',
        'invalid-null-quote-amount'
      )
    `],
  ]);

  for (const [label, sql] of invalidStatements) {
    const result = psql('-v', 'ON_ERROR_STOP=1', '-c', sql);
    assert.notEqual(result.status, 0, `${label} unexpectedly inserted`);
    assert.match(commandFailure(result), /violates (?:check|not-null) constraint/i, label);
  }

  const migrationSource = readFileSync(
    join(root, 'neon/migrations/33_mcp_acquisition_funnel.sql'),
    'utf8',
  );
  assert.match(migrationSource, /mcp_funnel_events_stage_mapping CHECK[\s\S]*CASE[\s\S]*IS TRUE/i);
  assert.match(migrationSource, /mcp_funnel_events_financial_shape CHECK[\s\S]*CASE[\s\S]*IS TRUE/i);

  const client = new Client({
    host: socketDirectory,
    user: 'postgres',
    database: 'postgres',
  });
  await client.connect();
  try {
    const parsed = await client.query<{ id: string }>(
      'SELECT 9223372036854775807::bigint AS id',
    );
    assert.equal(parsed.rows[0].id, '9223372036854775807');
    assert.equal(typeof parsed.rows[0].id, 'string');

    await client.query(`
      INSERT INTO mcp_funnel_events (
        occurred_at, event_type, stage, user_id, source, medium, campaign,
        acquisition_client, idempotency_key
      ) VALUES (
        '2026-07-14T09:00:00.000Z', 'trial_generation_completed', 'trial_completed',
        'pg-int8-user', 'direct_mcp', 'mcp', 'none', 'other', 'pg-int8-trial'
      )
    `);
    const executor: QueryExecutor = {
      async query<TRecord>(sql, params) {
        return (await client.query<TRecord>(sql, params as unknown[] | undefined)).rows;
      },
    };
    const {
      approveMcpOAuthConnectionBinding,
      bindAuthenticatedMcpConnection,
      createMcpOAuthApprovalBinding,
      recordConfirmedMcpWalletFunding,
    } = await import(
      '../frontend/src/server/agent-api/mcp-funnel'
    );
    const canonicalReceipt = {
      receiptId: parsed.rows[0].id as never,
      userId: 'pg-int8-user',
      amountCents: 2500,
      currency: 'USD',
      occurredAt: new Date('2026-07-14T10:00:00.000Z'),
    };
    let failFirstFunnelWrite = true;
    const transientExecutor: QueryExecutor = {
      async query<TRecord>(sql, params) {
        if (failFirstFunnelWrite) {
          failFirstFunnelWrite = false;
          throw new Error('simulated transient funnel outage after receipt commit');
        }
        return executor.query<TRecord>(sql, params);
      },
    };
    assert.equal(await recordConfirmedMcpWalletFunding(
      canonicalReceipt,
      { executor: transientExecutor, conversionWindowSeconds: 3600 },
    ), false);
    const recorded = await recordConfirmedMcpWalletFunding(
      canonicalReceipt,
      { executor: transientExecutor, conversionWindowSeconds: 3600 },
    );
    assert.equal(recorded, true);

    const walletEvent = await client.query<{
      amount_cents: number;
      currency: string;
      receipt_hash: string;
    }>(`
      SELECT amount_cents, currency, receipt_hash
        FROM mcp_funnel_events
       WHERE event_type = 'wallet_funded'
         AND user_id = 'pg-int8-user'
    `);
    assert.deepEqual(walletEvent.rows, [{
      amount_cents: 2500,
      currency: 'USD',
      receipt_hash: '4333adeed0bfcf534edfd61bc0b428cd6496c97e12c15cc6025db79f952bb4ff',
    }]);

    const replayModulePath = join(
      root,
      'frontend/app/api/stripe/webhook/_lib/stripe-webhook-mcp-attribution.ts',
    );
    assert.equal(
      existsSync(replayModulePath),
      true,
      'processed Stripe events need a measurement-only canonical receipt replay owner',
    );
    const { replayMcpTopupAttributionForProcessedEvent } = await import(
      '../frontend/app/api/stripe/webhook/_lib/stripe-webhook-mcp-attribution'
    );
    const { createStripeWebhookEventProcessor } = await import(
      '../frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-processor'
    );

    await client.query(`
      CREATE TABLE app_receipts (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        stripe_payment_intent_id TEXT UNIQUE,
        stripe_charge_id TEXT UNIQUE,
        stripe_checkout_session_id TEXT UNIQUE,
        stripe_invoice_id TEXT UNIQUE
      );
      CREATE TABLE stripe_webhook_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        processed_at TIMESTAMPTZ
      );
      INSERT INTO mcp_funnel_events (
        occurred_at, event_type, stage, user_id, source, medium, campaign,
        acquisition_client, idempotency_key
      ) VALUES (
        '2026-07-14T12:00:00.000Z', 'trial_generation_completed', 'trial_completed',
        'pg-stripe-replay-user', 'direct_mcp', 'mcp', 'none', 'other',
        'pg-stripe-replay-trial'
      );
    `);

    const stripeReplayEvent = {
      id: 'evt_mcp_receipt_replay',
      object: 'event',
      api_version: '2023-10-16',
      created: 1_784_035_200,
      data: {
        object: {
          id: 'pi_mcp_receipt_replay',
          object: 'payment_intent',
          metadata: { kind: 'topup', user_id: 'pg-stripe-replay-user' },
          latest_charge: 'ch_mcp_receipt_replay',
          invoice: null,
        },
      },
      livemode: false,
      pending_webhooks: 0,
      request: null,
      type: 'payment_intent.succeeded',
    } as Stripe.Event;
    let failInitialFunnelWrite = true;
    const initialFunnelExecutor: QueryExecutor = {
      async query<TRecord>(sql, params) {
        if (failInitialFunnelWrite) {
          failInitialFunnelWrite = false;
          throw new Error('simulated funnel outage after canonical receipt commit');
        }
        return executor.query<TRecord>(sql, params);
      },
    };
    const stripeProcessor = createStripeWebhookEventProcessor({
      async beginStripeEvent(event) {
        const rows = await executor.query<{ event_id: string }>(
          `INSERT INTO stripe_webhook_events (event_id, event_type)
           VALUES ($1, $2)
           ON CONFLICT (event_id) DO NOTHING
           RETURNING event_id`,
          [event.id, event.type],
        );
        return rows.length === 1;
      },
      async markStripeEventProcessed(eventId) {
        await executor.query(
          'UPDATE stripe_webhook_events SET processed_at = NOW() WHERE event_id = $1',
          [eventId],
        );
      },
      async rollbackStripeEvent(eventId) {
        await executor.query('DELETE FROM stripe_webhook_events WHERE event_id = $1', [eventId]);
      },
      async replayMcpTopupAttribution(event) {
        return replayMcpTopupAttributionForProcessedEvent(event, {
          executor,
          conversionWindowSeconds: 3600,
        });
      },
      async handleCheckoutSessionCompleted() {
        throw new Error('unexpected checkout handler');
      },
      async handlePaymentIntentSucceeded() {
        const inserted = await executor.query<{
          id: string;
          user_id: string;
          amount_cents: number;
          currency: string;
          created_at: Date;
        }>(
          `INSERT INTO app_receipts (
             user_id, type, amount_cents, currency, created_at,
             stripe_payment_intent_id, stripe_charge_id
           ) VALUES ($1, 'topup', $2, $3, $4, $5, $6)
           RETURNING id::text AS id, user_id, amount_cents, currency, created_at`,
          [
            'pg-stripe-replay-user',
            2500,
            'USD',
            new Date('2026-07-14T13:00:00.000Z'),
            'pi_mcp_receipt_replay',
            'ch_mcp_receipt_replay',
          ],
        );
        assert.equal(await recordConfirmedMcpWalletFunding({
          receiptId: inserted[0].id,
          userId: inserted[0].user_id,
          amountCents: inserted[0].amount_cents,
          currency: inserted[0].currency,
          occurredAt: inserted[0].created_at,
        }, { executor: initialFunnelExecutor, conversionWindowSeconds: 3600 }), false);
      },
      async handlePaymentIntentFailed() {
        throw new Error('unexpected failed-payment handler');
      },
      async handleChargeRefunded() {
        throw new Error('unexpected refund handler');
      },
      async handleChargeFailed() {
        throw new Error('unexpected failed-charge handler');
      },
    });
    const stripeProcessorOptions = { stripe: {} as Stripe, receiptsPriceOnly: false };

    assert.equal(
      await stripeProcessor(stripeReplayEvent, stripeProcessorOptions),
      'handled',
    );
    const initialReplayState = await client.query<{
      processed: boolean;
      receipt_count: number;
      credited_cents: number;
      funnel_count: number;
    }>(`
      SELECT
        (SELECT processed_at IS NOT NULL FROM stripe_webhook_events
          WHERE event_id = 'evt_mcp_receipt_replay') AS processed,
        (SELECT count(*)::int FROM app_receipts
          WHERE stripe_payment_intent_id = 'pi_mcp_receipt_replay') AS receipt_count,
        (SELECT coalesce(sum(amount_cents), 0)::int FROM app_receipts
          WHERE stripe_payment_intent_id = 'pi_mcp_receipt_replay') AS credited_cents,
        (SELECT count(*)::int FROM mcp_funnel_events
          WHERE event_type = 'wallet_funded' AND user_id = 'pg-stripe-replay-user') AS funnel_count
    `);
    assert.deepEqual(initialReplayState.rows, [{
      processed: true,
      receipt_count: 1,
      credited_cents: 2500,
      funnel_count: 0,
    }]);

    assert.equal(
      await stripeProcessor(stripeReplayEvent, stripeProcessorOptions),
      'duplicate',
    );
    assert.equal(
      await stripeProcessor(stripeReplayEvent, stripeProcessorOptions),
      'duplicate',
    );
    const replayedState = await client.query<{
      receipt_count: number;
      credited_cents: number;
      funnel_count: number;
    }>(`
      SELECT
        (SELECT count(*)::int FROM app_receipts
          WHERE stripe_payment_intent_id = 'pi_mcp_receipt_replay') AS receipt_count,
        (SELECT coalesce(sum(amount_cents), 0)::int FROM app_receipts
          WHERE stripe_payment_intent_id = 'pi_mcp_receipt_replay') AS credited_cents,
        (SELECT count(*)::int FROM mcp_funnel_events
          WHERE event_type = 'wallet_funded' AND user_id = 'pg-stripe-replay-user') AS funnel_count
    `);
    assert.deepEqual(replayedState.rows, [{
      receipt_count: 1,
      credited_cents: 2500,
      funnel_count: 1,
    }]);
    assert.equal(await replayMcpTopupAttributionForProcessedEvent(stripeReplayEvent, {
      executor: { async query() { throw new Error('relation does not exist'); } },
      conversionWindowSeconds: 3600,
    }), false);

    const bindingSecret = 'real-postgres-approval-binding-secret-32-bytes';
    const createAcquisition = (acquisitionId: string) => ({
      version: 1 as const,
      acquisitionId,
      source: 'mcp_landing' as const,
      medium: 'owned' as const,
      campaign: 'mcp_connect' as const,
      client: 'claude' as const,
      issuedAt: 1_784_022_000,
      expiresAt: 1_784_022_600,
    });
    const approvedToken = await createMcpOAuthApprovalBinding({
      authorizationId: 'authz_pg_approved_grant_001',
      userId: 'pg-oauth-race-user',
      oauthClientId: 'pg-oauth-race-client',
      acquisition: createAcquisition('acq_1234567890ABCDEFGHIJKLMN'),
    }, {
      executor,
      secret: bindingSecret,
      now: new Date('2026-07-14T10:00:00.000Z'),
      bindingId: 'mcpb_1234567890ABCDEFGHIJKLMN',
    });
    assert.ok(approvedToken);
    assert.equal(await approveMcpOAuthConnectionBinding({
      token: approvedToken,
      authorizationId: 'authz_pg_approved_grant_001',
      userId: 'pg-oauth-race-user',
      oauthClientId: 'pg-oauth-race-client',
      approvedAt: new Date('2026-07-14T10:01:00.000Z'),
    }, { executor, secret: bindingSecret }), true);

    const unapprovedToken = await createMcpOAuthApprovalBinding({
      authorizationId: 'authz_pg_unapproved_grant_002',
      userId: 'pg-oauth-race-user',
      oauthClientId: 'pg-oauth-race-client',
      acquisition: createAcquisition('acq_abcdefghijABCDEFGHIJKLMN'),
    }, {
      executor,
      secret: bindingSecret,
      now: new Date('2026-07-14T10:02:00.000Z'),
      bindingId: 'mcpb_abcdefghijABCDEFGHIJKLMN',
    });
    assert.ok(unapprovedToken);

    const concurrentClients = [
      new Client({ host: socketDirectory, user: 'postgres', database: 'postgres' }),
      new Client({ host: socketDirectory, user: 'postgres', database: 'postgres' }),
    ];
    await Promise.all(concurrentClients.map((concurrentClient) => concurrentClient.connect()));
    try {
      const concurrentExecutors = concurrentClients.map<QueryExecutor>((concurrentClient) => ({
        async query<TRecord>(sql, params) {
          return (await concurrentClient.query<TRecord>(sql, params as unknown[] | undefined)).rows;
        },
      }));
      const outcomes = await Promise.all(concurrentExecutors.map((concurrentExecutor) => (
        bindAuthenticatedMcpConnection({
          userId: 'pg-oauth-race-user',
          clientId: 'pg-oauth-race-client',
          emailVerified: true,
          authMethod: 'oauth',
        }, {
          executor: concurrentExecutor,
          now: new Date('2026-07-14T10:03:00.000Z'),
          bindingWindowSeconds: 900,
        })
      )));
      assert.deepEqual(outcomes.sort(), ['attributed', 'duplicate']);
    } finally {
      await Promise.all(concurrentClients.map((concurrentClient) => concurrentClient.end()));
    }

    const raceCompletions = await client.query<{
      acquisition_id: string | null;
      source: string;
    }>(`
      SELECT acquisition_id, source
        FROM mcp_funnel_events
       WHERE event_type = 'oauth_connection_completed'
         AND user_id = 'pg-oauth-race-user'
    `);
    assert.deepEqual(raceCompletions.rows, [{
      acquisition_id: 'acq_1234567890ABCDEFGHIJKLMN',
      source: 'mcp_landing',
    }]);
    const raceBindings = await client.query<{
      binding_id: string;
      approved: boolean;
      consumed: boolean;
    }>(`
      SELECT binding_id, approved_at IS NOT NULL AS approved, consumed_at IS NOT NULL AS consumed
        FROM mcp_oauth_connection_bindings
       WHERE user_id = 'pg-oauth-race-user'
       ORDER BY binding_id
    `);
    assert.deepEqual(raceBindings.rows, [
      { binding_id: 'mcpb_1234567890ABCDEFGHIJKLMN', approved: true, consumed: true },
      { binding_id: 'mcpb_abcdefghijABCDEFGHIJKLMN', approved: false, consumed: false },
    ]);

    const directPrincipal = {
      userId: 'pg-direct-first-user',
      clientId: 'pg-direct-first-client',
      emailVerified: true,
      authMethod: 'oauth' as const,
    };
    assert.equal(await bindAuthenticatedMcpConnection(directPrincipal, {
      executor,
      now: new Date('2026-07-14T11:00:00.000Z'),
      bindingWindowSeconds: 900,
    }), 'direct');
    const lateToken = await createMcpOAuthApprovalBinding({
      authorizationId: 'authz_pg_late_grant_003',
      userId: directPrincipal.userId,
      oauthClientId: directPrincipal.clientId,
      acquisition: createAcquisition('acq_ZYXWVUTSRQPONMLKJIHGFEDC'),
    }, {
      executor,
      secret: bindingSecret,
      now: new Date('2026-07-14T11:01:00.000Z'),
      bindingId: 'mcpb_ZYXWVUTSRQPONMLKJIHGFEDC',
    });
    assert.ok(lateToken);
    assert.equal(await approveMcpOAuthConnectionBinding({
      token: lateToken,
      authorizationId: 'authz_pg_late_grant_003',
      userId: directPrincipal.userId,
      oauthClientId: directPrincipal.clientId,
      approvedAt: new Date('2026-07-14T11:02:00.000Z'),
    }, { executor, secret: bindingSecret }), true);
    assert.equal(await bindAuthenticatedMcpConnection(directPrincipal, {
      executor,
      now: new Date('2026-07-14T11:03:00.000Z'),
      bindingWindowSeconds: 900,
    }), 'duplicate');

    const directFirstState = await client.query<{
      completion_count: number;
      direct_count: number;
      consumed_count: number;
    }>(`
      SELECT
        count(*) FILTER (WHERE event_type = 'oauth_connection_completed')::int AS completion_count,
        count(*) FILTER (
          WHERE event_type = 'oauth_connection_completed' AND source = 'direct_mcp'
        )::int AS direct_count,
        (
          SELECT count(*)::int
            FROM mcp_oauth_connection_bindings
           WHERE user_id = 'pg-direct-first-user' AND consumed_at IS NOT NULL
        ) AS consumed_count
        FROM mcp_funnel_events
       WHERE user_id = 'pg-direct-first-user'
    `);
    assert.deepEqual(directFirstState.rows, [{
      completion_count: 1,
      direct_count: 1,
      consumed_count: 0,
    }]);
  } finally {
    await client.end();
  }
});
