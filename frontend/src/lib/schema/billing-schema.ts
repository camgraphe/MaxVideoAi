import { ensureBillingContentSchema } from './billing-content-schema';
import { ensureBillingCoreSchema } from './billing-core-schema';
import { ensureBillingProductsSchema } from './billing-products-schema';
import { ensureBillingProviderSchema } from './billing-provider-schema';
import { ensureBillingReceiptsSchema } from './billing-receipts-schema';
import { ensureBillingUserAdminSchema } from './billing-user-admin-schema';

let ensurePromise: Promise<void> | null = null;

export async function ensureBillingSchema(): Promise<void> {
  if (ensurePromise) return ensurePromise;

  const ensure = async () => {
    await ensureBillingCoreSchema();
    await ensureBillingProductsSchema();
    await ensureBillingReceiptsSchema();
    await ensureBillingUserAdminSchema();
    await ensureBillingContentSchema();
    await ensureBillingProviderSchema();
  };

  ensurePromise = ensure().catch((error) => {
    ensurePromise = null;
    console.error('[schema] Failed to ensure app schema', error);
    throw error;
  });

  await ensurePromise;
}
