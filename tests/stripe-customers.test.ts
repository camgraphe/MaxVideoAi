import assert from 'node:assert/strict';
import test from 'node:test';

import { getOrCreateStripeCustomerForUserWithExecutor } from '../frontend/src/server/stripe-customers.ts';
import type { QueryExecutor } from '../frontend/src/lib/db.ts';

type QueryCall = {
  text: string;
  params?: ReadonlyArray<unknown>;
};

function buildExecutor(existingCustomerId: string | null, calls: QueryCall[] = []): QueryExecutor {
  return {
    async query<TRecord = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<TRecord[]> {
      calls.push({ text, params });
      if (text.includes('SELECT stripe_customer_id')) {
        return [{ stripe_customer_id: existingCustomerId }] as TRecord[];
      }
      if (text.includes('UPDATE profiles')) {
        return [{ stripe_customer_id: params?.[1] }] as TRecord[];
      }
      return [] as TRecord[];
    },
  };
}

test('getOrCreateStripeCustomerForUserWithExecutor reuses an active stored Customer', async () => {
  let createCalls = 0;
  const stripe = {
    customers: {
      retrieve: async (id: string) => ({ id, deleted: false }),
      create: async () => {
        createCalls += 1;
        return { id: 'cus_new' };
      },
    },
  };

  const customerId = await getOrCreateStripeCustomerForUserWithExecutor({
    stripe,
    executor: buildExecutor('cus_existing'),
    userId: '8cc5f4f4-1111-4444-9999-cdb2b7a2d6f1',
    identity: { email: 'user@example.com', fullName: 'Ada Lovelace' },
    preferredLocale: 'fr',
  });

  assert.equal(customerId, 'cus_existing');
  assert.equal(createCalls, 0);
});

test('getOrCreateStripeCustomerForUserWithExecutor fails safely when stored Customer lookup has a temporary error', async () => {
  let createCalls = 0;
  const stripe = {
    customers: {
      retrieve: async () => {
        const error = new Error('Stripe unavailable') as Error & { statusCode?: number };
        error.statusCode = 500;
        throw error;
      },
      create: async () => {
        createCalls += 1;
        return { id: 'cus_new' };
      },
    },
  };

  await assert.rejects(
    () =>
      getOrCreateStripeCustomerForUserWithExecutor({
        stripe,
        executor: buildExecutor('cus_existing'),
        userId: '8cc5f4f4-1111-4444-9999-cdb2b7a2d6f1',
        identity: { email: 'user@example.com', fullName: 'Ada Lovelace' },
        preferredLocale: 'fr',
      }),
    /Unable to verify existing Stripe Customer/
  );
  assert.equal(createCalls, 0);
});

test('getOrCreateStripeCustomerForUserWithExecutor creates a replacement for a confirmed deleted Customer with idempotency', async () => {
  const calls: QueryCall[] = [];
  const createCalls: Array<{ params: unknown; options: unknown }> = [];
  const stripe = {
    customers: {
      retrieve: async (id: string) => ({ id, deleted: true }),
      create: async (params: unknown, options: unknown) => {
        createCalls.push({ params, options });
        return { id: 'cus_new' };
      },
    },
  };
  const userId = '8cc5f4f4-1111-4444-9999-cdb2b7a2d6f1';

  const customerId = await getOrCreateStripeCustomerForUserWithExecutor({
    stripe,
    executor: buildExecutor('cus_deleted', calls),
    userId,
    identity: { email: 'user@example.com', fullName: 'Ada Lovelace' },
    preferredLocale: 'fr',
  });

  assert.equal(customerId, 'cus_new');
  assert.deepEqual(createCalls, [
    {
      params: {
        email: 'user@example.com',
        name: 'Ada Lovelace',
        preferred_locales: ['fr'],
        metadata: {
          app_user_id: userId,
          source: 'maxvideoai',
        },
      },
      options: {
        idempotencyKey: `maxvideoai:user:${userId}:stripe-customer`,
      },
    },
  ]);
  assert.ok(calls.some((call) => call.text.includes('SELECT pg_advisory_xact_lock')));
  assert.ok(calls.some((call) => call.text.includes('UPDATE profiles')));
});
