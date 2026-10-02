import { getRuntimeModelById } from '@/config/model-runtime';
import { customerTariffRevision } from '@/lib/customer-tariff-revision';
import { isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { customerTariffsEnabledByCode } from './customer-tariff-store';

export class CustomerTariffRevisionError extends Error {
  readonly code = 'PRICING_REFRESH_REQUIRED';
  readonly status = 409;
  constructor() { super('Pricing has changed. Review the current price before generating.'); this.name = 'CustomerTariffRevisionError'; }
}

function isManual(snapshot: unknown): boolean {
  return Boolean(snapshot && typeof snapshot === 'object' &&
    (snapshot as { meta?: { pricingMode?: unknown } }).meta?.pricingMode === 'manual_tariff');
}

export function assertDisplayedCustomerTariffRevision(header: string | null | undefined, snapshot: unknown): void {
  if (!isManual(snapshot)) return;
  const revision = customerTariffRevision(snapshot);
  if (revision == null || header !== String(revision)) throw new CustomerTariffRevisionError();
}

/** Held until debit/reservation commit, so an edit cannot pass between quote validation and debit. */
export async function lockQuotedCustomerTariffRevision(
  executor: TransactionQueryExecutor, engineId: string, snapshot: unknown,
): Promise<void> {
  const manual = isManual(snapshot);
  if (!manual && (!customerTariffsEnabledByCode() || !getRuntimeModelById(engineId)?.publication.app.published)) return;
  if (!isTransactionQueryExecutor(executor)) throw new Error('Customer price validation requires an active charge transaction');
  const [state] = await executor.query<{ revision: string | number; active: boolean }>(
    'SELECT revision, active FROM app_customer_tariff_state WHERE singleton = TRUE FOR SHARE'
  );
  if (!state || (state.active ? !manual || Number(state.revision) !== customerTariffRevision(snapshot) : manual)) {
    throw new CustomerTariffRevisionError();
  }
}
