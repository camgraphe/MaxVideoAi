import assert from 'node:assert/strict';
import test from 'node:test';

import { getOrCreateStripeCheckoutCustomerForUserWithExecutor } from '../frontend/src/server/stripe-customers.ts';
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

test('getOrCreateStripeCheckoutCustomerForUserWithExecutor reuses an active stored Customer', async () => {
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

  const customerId = await getOrCreateStripeCheckoutCustomerForUserWithExecutor({
    stripe,
    executor: buildExecutor('cus_existing'),
    userId: '8cc5f4f4-1111-4444-9999-cdb2b7a2d6f1',
    identity: { email: 'user@example.com', fullName: 'Ada Lovelace' },
    preferredLocale: 'fr',
  });

  assert.deepEqual(customerId, { id: 'cus_existing', hasShippingAddress: false });
  assert.equal(createCalls, 0);
});

test('getOrCreateStripeCheckoutCustomerForUserWithExecutor fails safely when stored Customer lookup has a temporary error', async () => {
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
      getOrCreateStripeCheckoutCustomerForUserWithExecutor({
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

test('getOrCreateStripeCheckoutCustomerForUserWithExecutor creates a replacement for a confirmed deleted Customer with idempotency', async () => {
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

  const customerId = await getOrCreateStripeCheckoutCustomerForUserWithExecutor({
    stripe,
    executor: buildExecutor('cus_deleted', calls),
    userId,
    identity: { email: 'user@example.com', fullName: 'Ada Lovelace' },
    preferredLocale: 'fr',
  });

  assert.deepEqual(customerId, { id: 'cus_new', hasShippingAddress: false });
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


test('stored wallet tax address is returned with the customer without a second Stripe read', async () => {
  let reads = 0;
  const customer = await getOrCreateStripeCheckoutCustomerForUserWithExecutor({
    stripe: { customers: {
      retrieve: async (id: string) => { reads++; return { id, shipping: { name: 'Ada', address: { country: 'FR', city: 'Paris', line1: '1 rue Test', line2: null, postal_code: '75001', state: null } } }; },
      create: async () => { throw new Error('must reuse existing customer'); },
    } },
    executor: buildExecutor('cus_existing'),
    userId: '8cc5f4f4-1111-4444-9999-cdb2b7a2d6f1',
  });
  assert.deepEqual(customer, { id: 'cus_existing', hasShippingAddress: true });
  assert.equal(reads, 1);
});
