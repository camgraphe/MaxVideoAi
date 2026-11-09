import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { ensureAssetSchema, ensureMediaLibraryOrganizationSchema } from '@/lib/schema';
import type { DbMediaAssetRow } from '../media-library-records';
import { resolveLibraryOrganizationReferences } from './organization-resolver';
import { materializeOrganizationIdentities } from './organization-identity';
/** Preserve materialized legacy aliases atomically with the canonical save, before anchors can disappear. */
export async function persistLibraryAssetWithOrganization(input: {
    userId: string;
    id: string;
    urls: string[];
    sourceJobId?: string | null;
    sourceOutputId?: string | null;
}, persist: (executor: TransactionQueryExecutor) => Promise<DbMediaAssetRow[]>): Promise<DbMediaAssetRow[]> {
    await ensureAssetSchema();
    await ensureMediaLibraryOrganizationSchema();
    return withDbTransaction(async (executor) => {
        await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,97))', [input.userId]);
        await executor.query('SELECT id FROM media_assets WHERE user_id=$1 AND id=$2 FOR UPDATE', [input.userId, input.id]);
        const legacy = await executor.query(`SELECT asset_id FROM user_assets WHERE user_id=$1 AND (asset_id=$2 OR ((url=ANY($3::text[]) OR metadata->>'originUrl'=ANY($3::text[])) AND ($4::text IS NULL OR metadata->>'sourceOutputId' IS NULL OR metadata->>'sourceOutputId'=$4) AND ($5::text IS NULL OR metadata->>'jobId' IS NULL OR metadata->>'jobId'=$5))) ORDER BY asset_id LIMIT 1001 FOR UPDATE`, [input.userId, input.id, input.urls, input.sourceOutputId ?? null, input.sourceJobId ?? null]);
        if (legacy.length > 1000)
            throw new Error('AMBIGUOUS_SOURCE');
        const rows = await persist(executor);
        const row = rows[0];
        if (!row?.public_id)
            throw new Error('PROMOTED_ASSET_ID_REQUIRED');
        const resolved = (await resolveLibraryOrganizationReferences(input.userId, [{ type: 'asset', assetId: row.public_id, kind: row.kind }], executor))[0];
        if (!resolved.identity)
            throw new Error(resolved.error ?? 'PROMOTED_ASSET_UNAVAILABLE');
        await materializeOrganizationIdentities(input.userId, [resolved.identity], executor);
        return rows;
    });
}
