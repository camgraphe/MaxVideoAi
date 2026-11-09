import { randomUUID } from 'node:crypto';
import { withDbTransaction } from '@/lib/db';
import { ensureMediaLibraryOrganizationSchema } from '@/lib/schema';
import type { LibraryBrowseScope, LibrarySelectionSnapshot, LibrarySnapshotMutationResult } from '@/lib/library-browse';
import type { LibraryMediaReference, LibraryOrganizationOperation } from '@/lib/media-library-organization';
import { normalizeLibraryBrowseScope } from './browse-validation';
import { libraryBrowseCtes, browseOrder } from './browse-sql';
import { assertBrowseCollection, browseRowReference, type BrowseRow } from './browse-projection';
import { buildMediaLibrarySearchPattern } from './pagination';
import { resolveOrganizationBatch } from './organization-resolver';
import { materializeOrganizationIdentities, type OrganizationIdentity } from './organization-identity';
import { applyOrganizationOperation } from './organization';
import { LibraryOrganizationError, onlyFields, requireLibraryOwner, validateOrganizationOperation } from './organization-validation';
export async function createLibrarySelectionSnapshot(input: {
    userId: string;
    scope: LibraryBrowseScope;
}, policy: { toolsEnabled?: boolean } = {}): Promise<LibrarySelectionSnapshot> {
    onlyFields(input, ['userId', 'scope']);
    requireLibraryOwner(input.userId);
    const scope = normalizeLibraryBrowseScope(input.scope), userId = input.userId;
    await ensureMediaLibraryOrganizationSchema();
    return withDbTransaction(async (executor) => {
        await executor.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,97))', [userId]);
        await assertBrowseCollection(userId, scope, executor);
        const [selected] = await executor.query<{
            rows: BrowseRow[];
            error: string | null;
        }>(`WITH ${libraryBrowseCtes(policy.toolsEnabled)}, selected AS (
      SELECT id,public_id,kind,type,"jobId","outputId",revision,organization_key,created_at,sort_name FROM browse_filtered ORDER BY ${browseOrder(scope.sort)} LIMIT 10001)
      SELECT (SELECT min(identity_error) FROM browse_ranked WHERE matches_search) AS error,
        COALESCE((SELECT jsonb_agg(to_jsonb(selected) ORDER BY ${browseOrder(scope.sort)}) FROM selected),'[]'::jsonb) AS rows`, [userId, JSON.stringify(scope), buildMediaLibrarySearchPattern(scope.q)]);
        const rows = selected.rows;
        if (selected.error)
            throw new LibraryOrganizationError(selected.error, 409);
        if (rows.length > 10000)
            throw new LibraryOrganizationError('SELECTION_LIMIT');
        const error = rows.find(row => row.identity_error)?.identity_error;
        if (error)
            throw new LibraryOrganizationError(error, 409);
        const resolved = await resolveOrganizationBatch(userId, rows.map(browseRowReference), executor);
        const failed = resolved.find((row, i) => row.error || row.key !== rows[i].organization_key);
        if (failed)
            throw new LibraryOrganizationError(failed.error ?? 'ORGANIZATION_IDENTITY_CONFLICT', 409);
        // One bounded metadata retirement per accepted create; never media or organization state.
        await executor.query(`DELETE FROM library_selection_snapshots WHERE (user_id,id) IN (
          SELECT user_id,id FROM library_selection_snapshots WHERE user_id=$1 AND expires_at<=statement_timestamp()
          ORDER BY expires_at,id LIMIT 1 FOR UPDATE SKIP LOCKED)`, [userId]);
        await materializeOrganizationIdentities(userId, resolved.map(row => row.identity!), executor);
        const id = `ls_${randomUUID()}`;
        const [snapshot] = await executor.query<{
            expires_at: Date;
        }>(`INSERT INTO library_selection_snapshots(user_id,id,scope,total_count,expires_at)
      VALUES($1,$2,$3::jsonb,$4,now()+interval '10 minutes') RETURNING expires_at`, [userId, id, JSON.stringify(scope), rows.length]);
        const items = resolved.map((row, ordinal) => ({ key: row.key, ordinal, reference: { ...row.reference, sourceRevision: row.sourceRevision }, revision: row.sourceRevision }));
        if (items.length)
            await executor.query(`INSERT INTO library_selection_snapshot_items(user_id,snapshot_id,organization_key,ordinal,reference,source_revision)
      SELECT $1,$2,r.key,r.ordinal,r.reference,r.revision FROM jsonb_to_recordset($3::jsonb) AS r(key text,ordinal integer,reference jsonb,revision text)`, [userId, id, JSON.stringify(items)]);
        return { id, totalCount: rows.length, expiresAt: new Date(snapshot.expires_at).toISOString(), keys: rows.map(row => row.organization_key) };
    });
}
export type SnapshotMutationInput = {
    userId: string;
    snapshotId: string;
    excludedKeys?: string[];
    operation: LibraryOrganizationOperation;
    collectionId?: string;
};
export async function mutateLibrarySelectionSnapshot(input: SnapshotMutationInput): Promise<LibrarySnapshotMutationResult> {
    onlyFields(input, ['userId', 'snapshotId', 'excludedKeys', 'operation', 'collectionId']);
    requireLibraryOwner(input.userId);
    validateOrganizationOperation(input.operation);
    const { userId, snapshotId, operation, collectionId } = input, excluded = input.excludedKeys === undefined ? [] : input.excludedKeys;
    if (typeof snapshotId !== 'string' || !/^ls_[a-f0-9-]{36}$/.test(snapshotId))
        throw new LibraryOrganizationError('INVALID_SNAPSHOT');
    if (!Array.isArray(excluded) || excluded.length > 10000 || excluded.some(key => typeof key !== 'string' || !/^lo_[a-f0-9]{64}$/.test(key)) || new Set(excluded).size !== excluded.length)
        throw new LibraryOrganizationError('INVALID_EXCLUSIONS');
    const membership = operation === 'add-to-collection' || operation === 'remove-from-collection';
    if (membership ? (typeof collectionId !== 'string' || !collectionId || collectionId.trim() !== collectionId) : collectionId !== undefined)
        throw new LibraryOrganizationError('INVALID_COLLECTION');
    let selected: {
        organization_key: string;
        reference: LibraryMediaReference;
        source_revision: string;
    }[] = [];
    const common = { operation, ...(collectionId ? { collectionId } : {}) };
    try {
        return await withDbTransaction(async (executor) => {
            await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,97))', [userId]);
            const [snapshot] = await executor.query<{
                expired: boolean;
                total_count: number;
            }>('SELECT expires_at<=statement_timestamp() AS expired,total_count FROM library_selection_snapshots WHERE user_id=$1 AND id=$2 FOR SHARE', [userId, snapshotId]);
            if (!snapshot)
                throw new LibraryOrganizationError('SNAPSHOT_NOT_FOUND', 404);
            if (snapshot.expired)
                throw new LibraryOrganizationError('SNAPSHOT_EXPIRED', 410);
            if (membership && !(await executor.query('SELECT id FROM library_collections WHERE user_id=$1 AND id=$2 FOR KEY SHARE', [userId, collectionId])).length)
                throw new LibraryOrganizationError('COLLECTION_NOT_FOUND', 404);
            const items = await executor.query<typeof selected[number]>('SELECT organization_key,reference,source_revision FROM library_selection_snapshot_items WHERE user_id=$1 AND snapshot_id=$2 ORDER BY ordinal', [userId, snapshotId]);
            if (items.length !== snapshot.total_count || items.length > 10000)
                throw new LibraryOrganizationError('INVALID_SNAPSHOT', 409);
            const keys = new Set(items.map(row => row.organization_key));
            if (excluded.some(key => !keys.has(key)))
                throw new LibraryOrganizationError('INVALID_EXCLUSIONS');
            const exclusions = new Set(excluded);
            selected = items.filter(row => !exclusions.has(row.organization_key));
            const resolved = await resolveOrganizationBatch(userId, selected.map(row => ({ ...row.reference, sourceRevision: row.source_revision })), executor);
            const failed: LibrarySnapshotMutationResult['failed'] = [], identities: OrganizationIdentity[] = [];
            resolved.forEach((row, i) => {
                const key = selected[i].organization_key;
                if (row.error || row.key !== key)
                    failed.push({ key, errorCode: row.error ?? 'ORGANIZATION_IDENTITY_CONFLICT' });
                else
                    identities.push(row.identity!);
            });
            await materializeOrganizationIdentities(userId, identities, executor);
            const succeededKeys = identities.map(identity => identity.key);
            await applyOrganizationOperation(userId, operation, succeededKeys, collectionId, executor);
            return { ...common, succeededKeys, failed, succeededCount: succeededKeys.length, failedCount: failed.length, affectedCount: succeededKeys.length };
        });
    }
    catch (error) {
        if (error instanceof LibraryOrganizationError)
            throw error;
        if (!selected.length)
            throw error;
        return { ...common, succeededKeys: [], failed: selected.map(row => ({ key: row.organization_key, errorCode: 'TRANSACTION_FAILED' })), succeededCount: 0, failedCount: selected.length, affectedCount: 0 };
    }
}
