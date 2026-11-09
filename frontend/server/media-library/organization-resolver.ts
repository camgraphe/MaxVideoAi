import { query, isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import type { LibraryMediaReference, LibraryOrganizationState } from '@/lib/media-library-organization';
import { identifyOrganizationSource, organizationSourceGroups, organizationSourceRevision, organizationAliasKey, persistedOrganizationAliases, readOrganizationStates, type OrganizationIdentity } from './organization-identity';
import { readOrganizationSourceBatch, referenceIdentity, sourceReference, sourceIdentity, unavailableOrganizationSourceUrls } from './organization-sources';
import { requireLibraryOwner, validateLibraryReference, validateLibraryReferences } from './organization-validation';
export type ResolvedLibraryOrganizationReference = {
    reference: LibraryMediaReference;
    key?: string;
    sourceRevision?: string;
    state?: LibraryOrganizationState;
    error?: string;
    identity?: OrganizationIdentity;
};
/** SELECT-only without an executor; mutation callers pass a live branded transaction. */
export async function resolveLibraryOrganizationReferences(userId: string, references: readonly LibraryMediaReference[], transaction?: TransactionQueryExecutor): Promise<ResolvedLibraryOrganizationReference[]> {
    requireLibraryOwner(userId);
    validateLibraryReferences(references);
    return resolveOrganizationBatch(userId, references, transaction);
}
/** Internal set-based owner. Only validated frozen snapshots may exceed the public 500-reference boundary. */
export async function resolveOrganizationBatch(userId: string, references: readonly LibraryMediaReference[], transaction?: TransactionQueryExecutor): Promise<ResolvedLibraryOrganizationReference[]> {
    requireLibraryOwner(userId);
    if (references.length > 10000)
        throw new Error('SELECTION_LIMIT');
    if (transaction && !isTransactionQueryExecutor(transaction))
        throw new Error('TRANSACTION_REQUIRED');
    const executor = transaction ?? { query };
    const valid = references.filter(validateLibraryReference);
    const { sources, discovered, proofLimitedSourceIds, similarityLimitedSourceIds } = await readOrganizationSourceBatch(userId, valid, executor, transaction);
    const current = new Map(sources.map(source => [referenceIdentity(sourceReference(source)), source]));
    const initial = new Map(discovered.map(source => [referenceIdentity(sourceReference(source)), source]));
    const requestedSources = valid.map(ref => current.get(referenceIdentity(ref))).filter(source => source !== undefined);
    const unavailable = await unavailableOrganizationSourceUrls(requestedSources, executor, Boolean(transaction));
    const groups = organizationSourceGroups(sources);
    const outputKeys = new Set(sources.filter(source => source.type === 'job-output').map(source => JSON.stringify([source.kind, source.jobId, source.id])));
    const proofLimited = new Set(proofLimitedSourceIds);
    const similarityLimited = new Set(similarityLimitedSourceIds);
    const results: ResolvedLibraryOrganizationReference[] = references.map(reference => {
        if (!validateLibraryReference(reference))
            return { reference, error: 'INVALID_REFERENCE' };
        const seed = current.get(referenceIdentity(reference));
        const before = initial.get(referenceIdentity(reference));
        if (before && proofLimited.has(sourceIdentity(before)))
            return { reference, error: 'IDENTITY_PROOF_LIMIT' };
        if (!seed || !seed.available || unavailable.has(seed.url))
            return { reference, error: 'SOURCE_UNAVAILABLE' };
        if ((groups.get(sourceIdentity(seed)) ?? [seed]).some(source => proofLimited.has(sourceIdentity(source))))
            return { reference, error: 'IDENTITY_PROOF_LIMIT' };
        if (before && organizationSourceRevision(before) !== organizationSourceRevision(seed))
            return { reference, error: 'SOURCE_VERSION_CHANGED' };
        const identity = identifyOrganizationSource(userId, reference, seed, sources, groups, outputKeys);
        return typeof identity === 'string' ? { reference, error: identity } : { reference, identity };
    });
    const identities = results.flatMap(row => row.identity ? [row.identity] : []);
    const aliases = await persistedOrganizationAliases(userId, identities, executor);
    for (const row of results) {
        if (!row.identity)
            continue;
        const keys = [...new Set(row.identity.aliases.map(alias => aliases.get(organizationAliasKey(alias))).filter((key): key is string => Boolean(key)))];
        if (keys.length > 1) {
            row.error = 'ORGANIZATION_IDENTITY_CONFLICT';
            delete row.identity;
            continue;
        }
        if (!keys.length && !row.identity.outputAnchored && row.identity.sources.some(source => similarityLimited.has(sourceIdentity(source)))) {
            const seed = current.get(referenceIdentity(row.reference))!;
            const exact = row.identity.sources.filter(source => source.id === seed.id && (source.type === 'asset' || source.type === 'legacy'));
            if (exact.some(source => source.type === 'asset') && exact.some(source => source.type === 'legacy')) {
                const stable = identifyOrganizationSource(userId, row.reference, seed, sources, new Map([[sourceIdentity(seed), exact]]), outputKeys);
                if (typeof stable !== 'string')
                    row.identity = stable;
                else {
                    row.error = stable;
                    delete row.identity;
                    continue;
                }
            }
            else {
                row.error = 'IDENTITY_PROOF_LIMIT';
                delete row.identity;
                continue;
            }
        }
        row.identity.key = keys[0] ?? row.identity.key;
        row.key = row.identity.key;
        row.sourceRevision = row.identity.sourceRevision;
    }
    const states = await readOrganizationStates(userId, [...new Set(results.flatMap(row => row.key ? [row.key] : []))], executor);
    for (const row of results)
        if (row.key)
            row.state = states.get(row.key);
    return results;
}
