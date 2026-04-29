import type Stripe from 'stripe';
import { ensureBillingSchema } from '@/lib/schema';
import { type QueryExecutor, withDbTransaction } from '@/lib/db';
import { getUserIdentity } from '@/server/supabase-admin';

type StripeCustomerClient = {
  customers: {
    retrieve: (id: string) => Promise<Stripe.Customer | Stripe.DeletedCustomer | { id: string; deleted?: boolean | null }>;
    create: (
      params: Stripe.CustomerCreateParams,
      options?: Stripe.RequestOptions
    ) => Promise<Stripe.Customer | { id: string; deleted?: boolean | null }>;
  };
};

export type StripeCustomerIdentity = {
  email: string | null;
  fullName: string | null;
};

type GetOrCreateWithExecutorArgs = {
  stripe: StripeCustomerClient;
  executor: QueryExecutor;
  userId: string;
  identity?: StripeCustomerIdentity | null;
  preferredLocale?: string | null;
};

type StoredStripeCustomerRow = {
  stripe_customer_id: string | null;
};

const STRIPE_CUSTOMER_SOURCE = 'maxvideoai';

function normalizeOptionalString(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

function normalizePreferredLocale(value: string | null | undefined): string | null {
  const locale = normalizeOptionalString(value);
  if (!locale || locale.toLowerCase() === 'auto') return null;
  if (!/^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(locale)) return null;
  return locale;
}

function isDeletedCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer | { deleted?: boolean | null }): boolean {
  return Boolean((customer as { deleted?: boolean | null }).deleted);
}

function isMissingStripeCustomerError(error: unknown): boolean {
  const candidate = error as {
    statusCode?: number;
    code?: string;
    raw?: { statusCode?: number; code?: string };
  };
  return (
    candidate?.statusCode === 404 ||
    candidate?.raw?.statusCode === 404 ||
    candidate?.code === 'resource_missing' ||
    candidate?.raw?.code === 'resource_missing'
  );
}

function buildCustomerCreateParams(
  userId: string,
  identity: StripeCustomerIdentity | null | undefined,
  preferredLocale: string | null | undefined
): Stripe.CustomerCreateParams {
  const params: Stripe.CustomerCreateParams = {
    metadata: {
      app_user_id: userId,
      source: STRIPE_CUSTOMER_SOURCE,
    },
  };
  const email = normalizeOptionalString(identity?.email);
  const name = normalizeOptionalString(identity?.fullName);
  const locale = normalizePreferredLocale(preferredLocale);
  if (email) params.email = email;
  if (name) params.name = name;
  if (locale) params.preferred_locales = [locale];
  return params;
}

export function stripeCustomerIdempotencyKey(userId: string): string {
  return `maxvideoai:user:${userId}:stripe-customer`;
}

export async function getOrCreateStripeCustomerForUserWithExecutor({
  stripe,
  executor,
  userId,
  identity = null,
  preferredLocale = null,
}: GetOrCreateWithExecutorArgs): Promise<string> {
  await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [`stripe-customer:${userId}`]);
  await executor.query(
    `INSERT INTO profiles (id, synced_from_supabase)
     VALUES ($1, TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [userId]
  );

  const rows = await executor.query<StoredStripeCustomerRow>(
    `SELECT stripe_customer_id
     FROM profiles
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  );
  const storedCustomerId = normalizeOptionalString(rows[0]?.stripe_customer_id);

  if (storedCustomerId) {
    try {
      const storedCustomer = await stripe.customers.retrieve(storedCustomerId);
      if (!isDeletedCustomer(storedCustomer)) {
        return storedCustomer.id;
      }
    } catch (error) {
      if (!isMissingStripeCustomerError(error)) {
        throw new Error('Unable to verify existing Stripe Customer before Checkout');
      }
    }
  }

  const customer = await stripe.customers.create(buildCustomerCreateParams(userId, identity, preferredLocale), {
    idempotencyKey: stripeCustomerIdempotencyKey(userId),
  });
  if (isDeletedCustomer(customer)) {
    throw new Error('Stripe returned a deleted Customer during creation');
  }

  const updatedRows = await executor.query<StoredStripeCustomerRow>(
    `UPDATE profiles
     SET stripe_customer_id = $2,
         synced_from_supabase = TRUE,
         updated_at = NOW()
     WHERE id = $1
     RETURNING stripe_customer_id`,
    [userId, customer.id]
  );
  const savedCustomerId = normalizeOptionalString(updatedRows[0]?.stripe_customer_id);
  if (!savedCustomerId) {
    throw new Error('Unable to save Stripe Customer on profile');
  }
  return savedCustomerId;
}

export async function getOrCreateStripeCustomerForUser(
  stripe: StripeCustomerClient,
  userId: string,
  options: { preferredLocale?: string | null } = {}
): Promise<string> {
  await ensureBillingSchema();
  const identity = await getUserIdentity(userId);
  return withDbTransaction((executor) =>
    getOrCreateStripeCustomerForUserWithExecutor({
      stripe,
      executor,
      userId,
      identity: identity ? { email: identity.email, fullName: identity.fullName } : null,
      preferredLocale: options.preferredLocale ?? null,
    })
  );
}
