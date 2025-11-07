import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

export const dynamic = 'force-dynamic';

type BalanceRow = {
  destination_acct: string;
  currency: string;
  pending_cents: string | number;
  updated_at: string;
};

type BatchRow = {
  id: number;
  destination_acct: string;
  currency: string;
  amount_cents: string | number;
  status: string;
  stripe_transfer_id: string | null;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};

function formatAmount(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default async function PayoutDashboard() {
  if ((process.env.PAYMENT_MODE ?? 'platform_only') !== 'connect') {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
        <section>
          <h1 className="text-2xl font-semibold">Batch Transfers</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vendor payouts are disabled while payments run in platform-only mode.
          </p>
        </section>
      </main>
    );
  }

  if (!process.env.DATABASE_URL) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
        <section>
          <h1 className="text-2xl font-semibold">Batch Transfers</h1>
          <p className="mt-2 text-sm text-muted-foreground">Database is not configured. Set DATABASE_URL to enable reporting.</p>
        </section>
      </main>
    );
  }

  await ensureBillingSchema();

  const balances = await query<BalanceRow>(
    `SELECT destination_acct, currency, pending_cents, updated_at
     FROM vendor_balances
     ORDER BY pending_cents DESC, updated_at DESC
     LIMIT 50`
  );

  const batches = await query<BatchRow>(
    `SELECT id, destination_acct, currency, amount_cents, status, stripe_transfer_id, error_message, created_at, sent_at
     FROM payout_batches
     ORDER BY created_at DESC
     LIMIT 50`
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
      <section>
        <h1 className="text-2xl font-semibold">Vendor Balances</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pending allocations awaiting batched Stripe transfers. Threshold: {process.env.BATCH_TRANSFER_THRESHOLD_CENTS ?? '5000'} cents (
          {(Number(process.env.BATCH_TRANSFER_THRESHOLD_CENTS ?? 5000) / 100).toFixed(2)}{' '}
          {(process.env.BATCH_TRANSFER_CURRENCY ?? 'usd').toUpperCase()}).
        </p>
        <div className="mt-4 overflow-x-auto rounded border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Destination</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Currency</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {balances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No vendor balances found.
                  </td>
                </tr>
              ) : (
                balances.map((row) => {
                  const pendingCents = Number(row.pending_cents ?? 0);
                  return (
                    <tr key={`${row.destination_acct}-${row.currency}`}>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-sm">{row.destination_acct}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        {formatAmount(pendingCents, row.currency ?? 'usd')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm uppercase">{(row.currency ?? 'usd').toUpperCase()}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-muted-foreground">{formatDate(row.updated_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Payout Batches</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Recent transfer attempts. Stripe transfers link to the dashboard when available.
        </p>
        <div className="mt-4 overflow-x-auto rounded border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Batch</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Destination</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Stripe Transfer</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No payout batches recorded yet.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => {
                  const amountCents = Number(batch.amount_cents ?? 0);
                  const status = batch.status ?? 'created';
                  const link = batch.stripe_transfer_id
                    ? `https://dashboard.stripe.com/connect/transfers/${batch.stripe_transfer_id}`
                    : null;
                  return (
                    <tr key={batch.id}>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-sm">#{batch.id}</td>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-sm">{batch.destination_acct}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        {formatAmount(amountCents, batch.currency ?? 'usd')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm uppercase">{status}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        {link ? (
                          <a className="text-primary underline-offset-2 hover:underline" href={link} target="_blank" rel="noreferrer">
                            {batch.stripe_transfer_id}
                          </a>
                        ) : (
                          '—'
                        )}
                        {batch.error_message ? (
                          <div className="mt-1 text-xs text-destructive">{batch.error_message}</div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-muted-foreground">{formatDate(batch.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-muted-foreground">{formatDate(batch.sent_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
