import { query, type QueryExecutor } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { coerceNumber, normalizeCurrency } from './normalizers';
import type { ManualWalletTopUpParams, ManualWalletTopUpResult } from './types';

export type AdminTopUpDependencies = {
  databaseConfigured(): boolean;
  ensureSchema(): Promise<void>;
  executor: QueryExecutor;
  now(): string;
};

const DEFAULT_DEPENDENCIES: AdminTopUpDependencies = {
  databaseConfigured: () => Boolean(process.env.DATABASE_URL),
  ensureSchema: ensureBillingSchema,
  executor: { query },
  now: () => new Date().toISOString(),
};

export async function issueManualWalletTopUp(
  params: ManualWalletTopUpParams,
  dependencies: AdminTopUpDependencies = DEFAULT_DEPENDENCIES
): Promise<ManualWalletTopUpResult> {
  if (!dependencies.databaseConfigured()) throw new Error('Database unavailable');

  const targetUserId = params.userId.trim();
  if (!targetUserId) throw new Error('Missing userId');

  const normalizedAmount = Math.round(Number(params.amountCents ?? 0));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('Invalid amountCents');
  }

  await dependencies.ensureSchema();
  const currency = normalizeCurrency(params.currency ?? 'USD');
  const metadata: Record<string, unknown> = {
    reason: 'manual_admin_topup',
    admin_user_id: params.adminUserId,
    admin_email: params.adminEmail ?? null,
  };
  if (params.note && params.note.trim().length) metadata.note = params.note.trim();

  const description = params.description && params.description.trim().length
    ? params.description.trim()
    : `Manual wallet credit issued by ${params.adminEmail ?? params.adminUserId}`;

  const inserted = await dependencies.executor.query<{
    id: number;
    created_at: string;
    amount_cents: number | string | null;
    currency: string | null;
  }>(
    `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, metadata)
     VALUES ($1, 'topup', $2, $3, $4, $5::jsonb)
     RETURNING id, created_at, amount_cents, currency`,
    [targetUserId, normalizedAmount, currency, description, JSON.stringify(metadata)]
  );
  const row = inserted.at(0);
  return {
    receiptId: row?.id ?? 0,
    createdAt: row?.created_at ?? dependencies.now(),
    amountCents: coerceNumber(row?.amount_cents ?? normalizedAmount),
    currency: normalizeCurrency(row?.currency ?? currency),
  };
}
