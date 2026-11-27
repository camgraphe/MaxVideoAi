import { z } from 'zod';
import {
  isTransactionQueryExecutor,
  query,
  type QueryExecutor,
  type TransactionQueryExecutor,
} from '@/lib/db';
import type { ToolAssetRef } from '@/lib/toolbox/contract';
import type { LibraryMediaKind } from '@/lib/media-library-organization';
import { organizationHash, organizationSourceRevision } from '@/server/media-library/organization-identity';
import { resolveLibraryOrganizationReferences } from '@/server/media-library/organization-resolver';
import { COMPLETED_GENERATION_STATUSES } from '@/server/generations/agent-generation-policy';
import type { CanonicalAnyGenerationRequest } from '@/server/agent-api/audio-quote-repository';
import { AgentApiError } from '@/server/agent-api/errors';
import type { LockedOwnedQuote } from '@/server/agent-api/quote-repository';

const evidenceSchema = z.array(z.object({ asset: z.string(), sources: z.array(z.string()) }));
export type SourceEvidence = z.infer<typeof evidenceSchema>;

function sourceUnavailable(): never {
  throw new AgentApiError('REFERENCE_INVALID', 'Source media changed or is unavailable. Choose it again.');
}

function assetIdsFromRequest(request: CanonicalAnyGenerationRequest): string[] {
  return request.surface === 'audio'
    ? request.references.map(({ asset }) => (asset.type === 'asset' ? asset.assetId : sourceUnavailable()))
    : request.references.map((ref) => (ref.kind === 'asset' ? ref.assetId : sourceUnavailable()));
}

/** Use the same organization identity and locked source rows as Library trash/restore. */
export async function mobileSourceEvidence(
  userId: string,
  assetIds: readonly string[],
  executor: QueryExecutor = { query },
): Promise<SourceEvidence> {
  const ids = [...new Set(assetIds)].sort();
  if (!ids.length) return [];
  const assets = await executor.query<{ public_id: string; kind: LibraryMediaKind }>(
    'SELECT public_id,kind FROM media_assets WHERE user_id=$1 AND public_id=ANY($2::text[]) ORDER BY public_id',
    [userId, ids],
  );
  if (assets.length !== ids.length)
    throw new AgentApiError('REFERENCE_NOT_FOUND', 'Source media unavailable.');
  return mobileToolSourceEvidence(
    userId,
    assets.map((asset) => ({ type: 'asset', assetId: asset.public_id, kind: asset.kind })),
    executor,
  );
}

export async function mobileToolSourceEvidence(
  userId: string,
  refs: readonly ToolAssetRef[],
  executor: QueryExecutor = { query },
): Promise<SourceEvidence> {
  const transaction = isTransactionQueryExecutor(executor) ? executor : undefined;
  const rows = await resolveLibraryOrganizationReferences(userId, refs, transaction);
  const jobs = new Set<string>();
  const evidence = rows.map((row) => {
    if (row.error || !row.identity || row.state?.trashedAt) return sourceUnavailable();
    const ref = row.reference;
    const id = ref.type === 'job-output' ? ref.outputId : ref.assetId;
    const seed = row.identity.sources.find((s) =>
      ref.type === 'job-output'
        ? s.type === 'job-output' && s.id === id && s.jobId === ref.jobId
        : s.type === 'asset' && s.publicId === id,
    );
    if (!seed) return sourceUnavailable();
    if (seed.jobId) jobs.add(seed.jobId);
    if (
      seed.outputId &&
      !row.identity.sources.some(
        (s) =>
          s.type === 'job-output' &&
          s.id === seed.outputId &&
          s.jobId === seed.jobId &&
          s.original === seed.original,
      )
    )
      return sourceUnavailable();
    return {
      asset: organizationHash([
        id,
        seed.kind,
        seed.createdAt,
        seed.url,
        seed.jobId,
        seed.outputId,
        organizationSourceRevision(seed),
      ]),
      sources: row.identity.sources
        .filter((s) => s.type !== 'asset')
        .map((s) =>
          organizationHash([
            s.type,
            s.id,
            s.kind,
            s.createdAt,
            s.jobId,
            s.outputId,
            s.url,
            organizationSourceRevision(s),
          ]),
        )
        .sort(),
    };
  });
  if (jobs.size) {
    const live = await executor.query(
      `SELECT job_id FROM app_jobs WHERE user_id=$1 AND job_id=ANY($2::text[]) AND hidden IS NOT TRUE AND lower(trim(status))=ANY($3::text[]) ORDER BY job_id${transaction ? ' FOR SHARE' : ''}`,
      [userId, [...jobs], COMPLETED_GENERATION_STATUSES],
    );
    if (live.length !== jobs.size) return sourceUnavailable();
  }
  return evidence;
}

export function verifyEvidence(expected: unknown, actual: SourceEvidence) {
  const parsed = evidenceSchema.safeParse(expected);
  if (
    !parsed.success ||
    actual.length !== parsed.data.length ||
    parsed.data.some(
      (item, i) =>
        item.asset !== actual[i].asset || item.sources.some((source) => !actual[i].sources.includes(source)),
    )
  )
    sourceUnavailable();
}

export async function checkMobileToolSources(
  userId: string,
  refs: readonly ToolAssetRef[],
  expected: SourceEvidence | undefined,
  tx: TransactionQueryExecutor,
) {
  const current = await mobileToolSourceEvidence(userId, refs, tx);
  if (expected !== undefined) verifyEvidence(expected, current);
}

export async function bindMobileQuoteSources(
  userId: string,
  request: CanonicalAnyGenerationRequest,
  pricing: Record<string, unknown>,
  initial: SourceEvidence,
  executor: QueryExecutor,
) {
  if (!request.references.length) return pricing;
  if (!isTransactionQueryExecutor(executor)) throw Error('TRANSACTION_REQUIRED');
  const current = await mobileSourceEvidence(userId, assetIdsFromRequest(request), executor);
  verifyEvidence(initial, current);
  return { ...pricing, mobileLibrarySources: current };
}

export async function checkLockedMobileQuoteSources<Request extends CanonicalAnyGenerationRequest>(
  locked: LockedOwnedQuote<Request> | null,
  executor: TransactionQueryExecutor,
) {
  if (
    !locked ||
    locked.quote.state !== 'prepared' ||
    locked.quote.expiresAt <= locked.databaseNow ||
    !locked.quote.request.references.length
  )
    return locked;
  const { quote } = locked;
  const current = await mobileSourceEvidence(quote.userId, assetIdsFromRequest(quote.request), executor);
  const { mobileLibrarySources, ...pricingSnapshot } = quote.pricingSnapshot;
  // Earlier app builds have only the canonical media and price fingerprints.
  if (mobileLibrarySources !== undefined) verifyEvidence(mobileLibrarySources, current);
  return { ...locked, quote: { ...quote, pricingSnapshot } };
}
