import type { QueryExecutor } from '@/lib/db';
import { marketingSourceFingerprint } from '../snapshot';
import { importPreparedMarketingCopy, type MarketingImportDependencies } from '../import-copy';
import { parseBytePlusMarketingImport } from './contract';
import { assertBytePlusImportAdmin, loadBytePlusImportAssets, type BytePlusImportAsset } from './assets';
import { prepareBytePlusMarketingCopy, type BytePlusImportMeasurements } from './plan';

type VerifyMedia = (parsed: ReturnType<typeof parseBytePlusMarketingImport>, assets: BytePlusImportAsset[]) => Promise<BytePlusImportMeasurements>;
type Verified = ReturnType<typeof prepareBytePlusMarketingCopy> & {
  parsed: ReturnType<typeof parseBytePlusMarketingImport>; assets: BytePlusImportAsset[]; actorId: string; verifiedAt: number;
};
const verifiedCopies = new WeakSet<Verified>();
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Operator-only read phase. Its caller explicitly selects the target DB and GET-only evidence owner. */
export async function verifyBytePlusMarketingImport(value: unknown, options: { db: QueryExecutor; actorId: string; verifyMedia: VerifyMedia }): Promise<Verified> {
  const parsed = parseBytePlusMarketingImport(value);
  await assertBytePlusImportAdmin(options.db, options.actorId);
  const assets = await loadBytePlusImportAssets(parsed.input, options.db);
  const measurements = await options.verifyMedia(parsed, assets);
  const verified = freeze({ ...prepareBytePlusMarketingCopy(parsed, assets, measurements),
    parsed, assets, actorId: options.actorId, verifiedAt: Date.now() });
  verifiedCopies.add(verified);
  return verified;
}

/** No app job, output, receipt, wallet, provider submission or placement is created. */
export async function importBytePlusMarketingVideo(verified: Verified,
  input: { actorId: string; permissionConfirmed: boolean; approvedPlanSha256: string },
  dependencies?: MarketingImportDependencies,
) {
  if (!verifiedCopies.has(verified) || Date.now() - verified.verifiedAt > 5 * 60_000)
    throw new Error('BYTEPLUS_IMPORT_CURRENT_VERIFIED_PLAN_REQUIRED');
  if (input.actorId !== verified.actorId || input.approvedPlanSha256 !== verified.fingerprint)
    throw new Error('BYTEPLUS_IMPORT_PLAN_APPROVAL_REQUIRED');
  return importPreparedMarketingCopy({ ...input, prepared: verified, validateSource: async db => {
    await assertBytePlusImportAdmin(db, input.actorId, true);
    const assets = await loadBytePlusImportAssets(verified.parsed.input, db, true);
    if (marketingSourceFingerprint(assets) !== marketingSourceFingerprint(verified.assets))
      throw new Error('BYTEPLUS_IMPORT_ASSET_CHANGED');
  } }, dependencies);
}
