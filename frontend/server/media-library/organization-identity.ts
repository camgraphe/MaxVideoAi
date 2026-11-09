import { createHash } from 'node:crypto';
import type { QueryExecutor, TransactionQueryExecutor } from '@/lib/db';
import type { LibraryMediaReference, LibraryOrganizationState } from '@/lib/media-library-organization';
import { sourceIdentity, sourceReference, type OrganizationSource } from './organization-sources';
export function organizationHash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function organizationSourceRevision(source: OrganizationSource): string { return `sr_${organizationHash(['v1', source.kind, source.original])}`; }
export type OrganizationAlias = {
    type: OrganizationSource['type'];
    id: string;
    revision: string;
    reference: LibraryMediaReference;
};
export function organizationSourceAlias(source: OrganizationSource): OrganizationAlias {
    const reference = sourceReference(source);
    return { type: source.type, id: organizationHash(reference), revision: organizationSourceRevision(source), reference };
}
export function organizationAliasKey(alias: Pick<OrganizationAlias, 'type' | 'id' | 'revision'>): string { return JSON.stringify([alias.type, alias.id, alias.revision]); }
export type OrganizationIdentity = {
    key: string;
    sourceRevision: string;
    aliases: OrganizationAlias[];
    sources: OrganizationSource[];
    kind: OrganizationSource['kind'];
    outputAnchored?: boolean;
};
/** Build proven components once per bounded batch. Similarity is never an output/asset identity. */
export function organizationSourceGroups(rows: OrganizationSource[]): Map<string, OrganizationSource[]> {
    const active = rows.filter(row => row.available);
    const byId = new Map(active.map(row => [sourceIdentity(row), row]));
    const edges = new Map(active.map(row => [sourceIdentity(row), new Set<OrganizationSource>([row])]));
    const connect = (a: OrganizationSource, b: OrganizationSource) => {
        if (a.kind !== b.kind)
            return;
        edges.get(sourceIdentity(a))!.add(b);
        edges.get(sourceIdentity(b))!.add(a);
    };
    const outputById = new Map(active.filter(row => row.type === 'job-output').map(row => [row.id, row]));
    const assetById = new Map(active.filter(row => row.type === 'asset').map(row => [row.id, row]));
    for (const asset of assetById.values()) {
        const output = asset.outputId ? outputById.get(asset.outputId) : undefined;
        if (output && asset.kind === output.kind && asset.jobId === output.jobId && asset.original === output.original)
            connect(asset, output);
    }
    for (const legacy of active.filter(row => row.type === 'legacy')) {
        const canonical = legacy.canonicalId ? assetById.get(legacy.canonicalId) : undefined;
        if (canonical && legacy.kind === canonical.kind) {
            connect(legacy, canonical);
            continue;
        }
        // Ambiguous legacy projections remain independent instead of selecting the first URL match.
        if (legacy.canonicalId)
            continue;
        const outputs = [...outputById.values()].filter(row => legacy.kind === row.kind && legacy.jobId === row.jobId && (!legacy.outputId || legacy.outputId === row.id) && legacy.original === row.original);
        if (outputs.length === 1)
            connect(legacy, outputs[0]);
    }
    const groups = new Map<string, OrganizationSource[]>();
    for (const row of active) {
        if (groups.has(sourceIdentity(row)))
            continue;
        const found = new Set<string>();
        const queue = [sourceIdentity(row)];
        while (queue.length) {
            const key = queue.pop()!;
            if (found.has(key))
                continue;
            found.add(key);
            for (const next of edges.get(key) ?? [])
                queue.push(sourceIdentity(next));
        }
        const group = [...found].map(key => byId.get(key)!);
        for (const key of found)
            groups.set(key, group);
    }
    return groups;
}
export function identifyOrganizationSource(userId: string, reference: LibraryMediaReference, seed: OrganizationSource, rows: OrganizationSource[], groups: Map<string, OrganizationSource[]>, outputKeys?: ReadonlySet<string>): OrganizationIdentity | string {
    if (!seed.available)
        return 'SOURCE_UNAVAILABLE';
    const revision = organizationSourceRevision(seed);
    if (reference.sourceRevision && reference.sourceRevision !== revision)
        return 'SOURCE_VERSION_CHANGED';
    const sources = groups.get(sourceIdentity(seed)) ?? [seed];
    const aliases = sources.map(organizationSourceAlias);
    const outputAnchor = sources.find(row => row.kind === seed.kind && row.outputId && row.jobId && (outputKeys ? outputKeys.has(JSON.stringify([row.kind, row.jobId, row.outputId])) : rows.some(output => output.type === 'job-output' && output.kind === row.kind && output.id === row.outputId && output.jobId === row.jobId)));
    let anchor: unknown;
    if (outputAnchor) {
        anchor = ['job-output', outputAnchor.jobId, outputAnchor.outputId, organizationSourceRevision(outputAnchor)];
        aliases.push(organizationSourceAlias({ ...outputAnchor, type: 'job-output', id: outputAnchor.outputId!, publicId: null }));
    }
    else {
        // SQL projects fixed-width UTC microseconds; byte order is chronological, then matches SQL id COLLATE "C".
        const oldest = [...sources].sort((a, b) => Buffer.compare(Buffer.from(a.createdAt), Buffer.from(b.createdAt)) || Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)))[0];
        anchor = ['record', oldest.id, organizationSourceRevision(oldest)];
    }
    return { key: `lo_${organizationHash(['v1', userId, reference.kind, anchor])}`, sourceRevision: revision, outputAnchored: Boolean(outputAnchor),
        aliases: [...new Map(aliases.map(alias => [organizationAliasKey(alias), alias])).values()], sources, kind: reference.kind };
}
export async function persistedOrganizationAliases(userId: string, identities: OrganizationIdentity[], executor: QueryExecutor): Promise<Map<string, string>> {
    const aliases = [...new Map(identities.flatMap(identity => identity.aliases).map(alias => [organizationAliasKey(alias), alias])).values()];
    if (!aliases.length)
        return new Map();
    const rows = await executor.query<{
        alias_type: OrganizationAlias['type'];
        alias_id: string;
        source_revision: string;
        organization_key: string;
    }>(`SELECT a.alias_type,a.alias_id,a.source_revision,a.organization_key FROM library_organization_aliases a
    JOIN jsonb_to_recordset($2::jsonb) AS wanted(type text,id text,revision text)
    ON a.alias_type=wanted.type AND a.alias_id=wanted.id AND a.source_revision=wanted.revision WHERE a.user_id=$1`, [userId, JSON.stringify(aliases)]);
    return new Map(rows.map(row => [organizationAliasKey({ type: row.alias_type, id: row.alias_id, revision: row.source_revision }), row.organization_key]));
}
export async function readOrganizationStates(userId: string, keys: string[], executor: QueryExecutor): Promise<Map<string, LibraryOrganizationState>> {
    if (!keys.length)
        return new Map();
    const rows = await executor.query<{
        key: string;
        favorite: boolean;
        trashed_at: Date | string | null;
        collection_ids: string[];
    }>(`SELECT o.key,o.favorite,o.trashed_at,
    ARRAY(SELECT m.collection_id FROM library_collection_members m WHERE m.user_id=o.user_id AND m.organization_key=o.key ORDER BY m.collection_id) AS collection_ids
    FROM library_organization o WHERE o.user_id=$1 AND o.key=ANY($2::text[])`, [userId, keys]);
    const states = new Map(keys.map(key => [key, { key, favorite: false, trashedAt: null, collectionIds: [] } as LibraryOrganizationState]));
    for (const row of rows)
        states.set(row.key, { key: row.key, favorite: row.favorite, trashedAt: row.trashed_at ? new Date(row.trashed_at).toISOString() : null, collectionIds: row.collection_ids });
    return states;
}
export async function materializeOrganizationIdentities(userId: string, identities: OrganizationIdentity[], executor: TransactionQueryExecutor): Promise<void> {
    if (!identities.length)
        return;
    // Validate the complete proposal before issuing even the first INSERT. A Map
    // must not silently replace an alias assignment from another resolved key.
    const proposed = new Map<string, OrganizationAlias & {
        key: string;
    }>();
    for (const identity of identities) {
        for (const alias of identity.aliases) {
            const aliasKey = organizationAliasKey(alias);
            const previous = proposed.get(aliasKey);
            if ((previous && previous.key !== identity.key) || alias.reference.kind !== identity.kind)
                throw new Error('ORGANIZATION_IDENTITY_CONFLICT');
            proposed.set(aliasKey, { ...alias, key: identity.key });
        }
    }
    const aliases = [...proposed.values()];
    await executor.query(`INSERT INTO library_organization(user_id,key,kind) SELECT $1,r.key,r.kind FROM jsonb_to_recordset($2::jsonb) AS r(key text,kind text)
    ORDER BY r.key ON CONFLICT(user_id,key) DO NOTHING`, [userId, JSON.stringify(identities.map(({ key, kind }) => ({ key, kind })))]);
    const rows = await executor.query<{
        alias_type: OrganizationAlias['type'];
        alias_id: string;
        source_revision: string;
        organization_key: string;
    }>(`INSERT INTO library_organization_aliases(user_id,alias_type,alias_id,source_revision,organization_key,reference)
    SELECT $1,r.type,r.id,r.revision,r.key,r.reference FROM jsonb_to_recordset($2::jsonb) AS r(type text,id text,revision text,key text,reference jsonb)
    ORDER BY r.type,r.id,r.revision ON CONFLICT(user_id,alias_type,alias_id,source_revision)
    DO UPDATE SET organization_key=library_organization_aliases.organization_key RETURNING alias_type,alias_id,source_revision,organization_key`, [userId, JSON.stringify(aliases)]);
    const expected = new Map(aliases.map(alias => [organizationAliasKey(alias), alias.key]));
    if (rows.some(row => expected.get(organizationAliasKey({ type: row.alias_type, id: row.alias_id, revision: row.source_revision })) !== row.organization_key))
        throw new Error('ORGANIZATION_IDENTITY_CONFLICT');
}
