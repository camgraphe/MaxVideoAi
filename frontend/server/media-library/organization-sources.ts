import type { QueryExecutor, TransactionQueryExecutor } from '@/lib/db';
import type { LibraryMediaKind, LibraryMediaReference } from '@/lib/media-library-organization';
import { initialSourceSql, canonicalSourceSql, legacySourceSql, legacyIdentityProofSql, legacySimilarityLimitsSql, outputSourceSql } from './organization-source-sql';
export type OrganizationSource = {
    type: 'asset' | 'legacy' | 'job-output';
    id: string;
    publicId: string | null;
    kind: LibraryMediaKind;
    url: string;
    original: string;
    provenance: string | null;
    jobId: string | null;
    outputId: string | null;
    createdAt: string;
    available: boolean;
    canonicalId?: string | null;
};
export function sourceReference(source: OrganizationSource): LibraryMediaReference {
    return source.type === 'job-output' ? { type: source.type, jobId: source.jobId!, outputId: source.id, kind: source.kind } : { type: source.type, assetId: source.publicId ?? source.id, kind: source.kind };
}
export function sourceIdentity(source: OrganizationSource): string { return JSON.stringify([source.type, source.id, source.kind]); }
export function referenceIdentity(reference: LibraryMediaReference): string {
    return JSON.stringify(reference.type === 'job-output' ? [reference.type, reference.jobId, reference.outputId, reference.kind] : [reference.type, reference.assetId, reference.kind]);
}
export type OrganizationSourceBatch = {
    sources: OrganizationSource[];
    discovered: OrganizationSource[];
    /** Exact/materialized group proof exceeded 1000; never project default state for these identities. */
    proofLimitedSourceIds: string[];
    similarityLimitedSourceIds: string[];
};
/** Discover first, then lock all canonical rows before any legacy/output rows. */
export async function readOrganizationSourceBatch(userId: string, references: readonly LibraryMediaReference[], executor: QueryExecutor, transaction?: TransactionQueryExecutor): Promise<OrganizationSourceBatch> {
    if (!references.length)
        return { sources: [], discovered: [], proofLimitedSourceIds: [], similarityLimitedSourceIds: [] };
    const discovered = await executor.query<OrganizationSource>(initialSourceSql(), [userId, JSON.stringify(references)]);
    if (!discovered.length)
        return { sources: [], discovered, proofLimitedSourceIds: [], similarityLimitedSourceIds: [] };
    const assets = await executor.query<OrganizationSource>(canonicalSourceSql(Boolean(transaction)), [userId, JSON.stringify(discovered)]);
    const seeds = [...assets, ...discovered.filter(row => row.type !== 'asset')];
    const proofs = await executor.query<Pick<OrganizationSource, 'type' | 'id' | 'kind'> & {
        overflow: boolean;
        ids: string[];
    }>(legacyIdentityProofSql(), [userId, JSON.stringify(seeds)]);
    const proofLimitedSourceIds = proofs.filter(proof => proof.overflow).map(proof => JSON.stringify([proof.type, proof.id, proof.kind]));
    const similarityLimits = await executor.query<Pick<OrganizationSource, 'type' | 'id' | 'kind'>>(legacySimilarityLimitsSql(), [userId, JSON.stringify(seeds)]);
    const similarityLimitedSourceIds = similarityLimits.map(row => JSON.stringify([row.type, row.id, row.kind]));
    const proofIds = [...new Set(proofs.flatMap(proof => proof.ids))];
    const legacy = await executor.query<OrganizationSource>(legacySourceSql(Boolean(transaction)), [userId, JSON.stringify(seeds), proofIds]);
    const outputs = await executor.query<OrganizationSource>(outputSourceSql(Boolean(transaction)), [userId, JSON.stringify([...assets, ...legacy, ...discovered.filter(row => row.type === 'job-output')])]);
    const jobs = outputs.length ? await executor.query<{
        job_id: string;
        hidden: boolean;
    }>(`SELECT job_id,hidden FROM app_jobs WHERE user_id=$1 AND job_id=ANY($2::text[]) ORDER BY job_id${transaction ? ' FOR UPDATE' : ''}`, [userId, [...new Set(outputs.map(row => row.jobId))]]) : [];
    const ownedJobs = new Map(jobs.map(row => [row.job_id, row]));
    for (const output of outputs)
        output.available = output.available && ownedJobs.has(output.jobId!) && !ownedJobs.get(output.jobId!)?.hidden;
    return { sources: [...assets, ...legacy, ...outputs.filter(row => ownedJobs.has(row.jobId!))], discovered, proofLimitedSourceIds, similarityLimitedSourceIds };
}
/** Recheck only the requested original; another projection's unavailable bytes do not invalidate a durable copy. */
export async function unavailableOrganizationSourceUrls(sources: OrganizationSource[], executor: QueryExecutor, lock: boolean): Promise<Set<string>> {
    const urls = [...new Set(sources.map(row => row.url).filter(url => /\/(?:mcp-reference-staging\/)?(?:user-assets\/by-content|user-asset-thumbs)\//.test(url)))];
    if (!urls.length)
        return new Set();
    const rows = await executor.query<{
        state: string;
        urls: string[];
    }>(`WITH requested AS (
    SELECT url,COALESCE(reference_storage_object_key(url),unrecognized_reference_storage_object_key(url)) AS object_key FROM unnest($1::text[]) AS originals(url))
    SELECT f.state,ARRAY(SELECT r.url FROM requested r WHERE r.object_key=f.object_key) AS urls
    FROM mcp_reference_upload_object_fences f WHERE f.object_key IN(SELECT object_key FROM requested) ORDER BY f.object_key${lock ? ' FOR SHARE OF f' : ''}`, [urls]);
    return new Set(rows.filter(row => ['deleting', 'deleted'].includes(row.state)).flatMap(row => row.urls));
}
