import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { ensureMediaLibraryOrganizationSchema } from '@/lib/schema';
import type { LibraryMediaReference, LibraryOrganizationOperation, LibraryOrganizationMutationResult, LibraryOrganizationResult } from '@/lib/media-library-organization';
import { resolveLibraryOrganizationReferences } from './organization-resolver';
import { materializeOrganizationIdentities, readOrganizationStates } from './organization-identity';
import { LibraryOrganizationError, requireLibraryOwner, validateLibraryReferences, validateOrganizationOperation, onlyFields } from './organization-validation';
export async function mutateLibraryOrganization(input: {
    userId: string;
    operation: LibraryOrganizationOperation;
    references: readonly LibraryMediaReference[];
    collectionId?: string;
}): Promise<LibraryOrganizationMutationResult> {
    onlyFields(input, ['userId', 'operation', 'references', 'collectionId']);
    const { userId, operation, references, collectionId } = input;
    requireLibraryOwner(userId);
    validateOrganizationOperation(operation);
    validateLibraryReferences(references);
    const membership = operation === 'add-to-collection' || operation === 'remove-from-collection';
    if (membership && (!collectionId || typeof collectionId !== 'string'))
        throw new LibraryOrganizationError('INVALID_COLLECTION');
    if (!membership && collectionId !== undefined)
        throw new LibraryOrganizationError('INVALID_COLLECTION');
    await ensureMediaLibraryOrganizationSchema();
    try {
        return await withDbTransaction(async (executor) => {
            // Serializes alias materialization and overlapping organization batches per account.
            await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,97))', [userId]);
            if (membership) {
                const collection = await executor.query('SELECT id FROM library_collections WHERE user_id=$1 AND id=$2 FOR KEY SHARE', [userId, collectionId]);
                if (!collection.length)
                    throw new LibraryOrganizationError('COLLECTION_NOT_FOUND', 404);
            }
            const resolved = await resolveLibraryOrganizationReferences(userId, references, executor);
            const identities = [...new Map(resolved.filter(row => row.identity).map(row => [row.key!, row.identity!])).values()].sort((a, b) => a.key.localeCompare(b.key));
            await materializeOrganizationIdentities(userId, identities, executor);
            const keys = identities.map(identity => identity.key);
            await applyOrganizationOperation(userId, operation, keys, collectionId, executor);
            const states = await readOrganizationStates(userId, keys, executor);
            const results: LibraryOrganizationResult[] = resolved.map(row => row.error ? { reference: row.reference, status: 'failed', error: row.error } : { reference: row.reference, key: row.key, status: 'succeeded', state: states.get(row.key!) });
            const succeededCount = results.filter(row => row.status === 'succeeded').length;
            return { results, succeededCount, failedCount: results.length - succeededCount, affectedCount: identities.length };
        });
    }
    catch (error) {
        if (error instanceof LibraryOrganizationError)
            throw error;
        // A failed commit/statement cannot leak in-transaction success to the client.
        return { results: references.map(reference => ({ reference, status: 'failed', error: 'TRANSACTION_FAILED' })), succeededCount: 0, failedCount: references.length, affectedCount: 0 };
    }
}
/** Shared set-based writer; caller owns source validation, locks, collection validation and transaction. */
export async function applyOrganizationOperation(userId: string, operation: LibraryOrganizationOperation, keys: string[], collectionId: string | undefined, executor: TransactionQueryExecutor): Promise<void> {
    const membership = operation === 'add-to-collection' || operation === 'remove-from-collection';
    if (keys.length) {
        if (membership) {
            if (operation === 'add-to-collection')
                await executor.query(`INSERT INTO library_collection_members(user_id,collection_id,organization_key)
                      SELECT $1,$2,key FROM unnest($3::text[]) AS keys(key) ORDER BY key ON CONFLICT DO NOTHING`, [userId, collectionId, keys]);
            else
                await executor.query('DELETE FROM library_collection_members WHERE user_id=$1 AND collection_id=$2 AND organization_key=ANY($3::text[])', [userId, collectionId, keys]);
        }
        else {
            const assignment = { favorite: 'favorite=true', unfavorite: 'favorite=false', trash: 'trashed_at=COALESCE(trashed_at,now())', restore: 'trashed_at=NULL' }[operation];
            await executor.query(`UPDATE library_organization SET ${assignment},updated_at=now() WHERE user_id=$1 AND key=ANY($2::text[])`, [userId, keys]);
        }
    }
}
