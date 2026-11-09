import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';
import { ensureMediaLibraryOrganizationSchema } from '@/lib/schema';
import type { LibraryCollection } from '@/lib/media-library-organization';
import { libraryCollectionName, LibraryOrganizationError, requireLibraryOwner } from './organization-validation';
type Row = {
    id: string;
    name: string;
    created_at: Date | string;
    updated_at: Date | string;
};
function mapCollection(row: Row): LibraryCollection { return { id: row.id, name: row.name, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() }; }
export async function listLibraryCollections({ userId, limit = 30, cursor }: {
    userId: string;
    limit?: number;
    cursor?: string | null;
}): Promise<{
    items: LibraryCollection[];
    hasMore: boolean;
    nextCursor: string | null;
}> {
    requireLibraryOwner(userId);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new LibraryOrganizationError('INVALID_LIMIT');
    if (cursor !== undefined && cursor !== null && !/^lc_[a-f0-9-]{36}$/.test(cursor))
        throw new LibraryOrganizationError('INVALID_CURSOR');
    const rows = await query<Row>(`SELECT id,name,created_at,updated_at FROM library_collections WHERE user_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3`, [userId, cursor ?? null, limit + 1]);
    const items = rows.slice(0, limit).map(mapCollection);
    const hasMore = rows.length > limit;
    return { items, hasMore, nextCursor: hasMore ? items[items.length - 1].id : null };
}
export async function createLibraryCollection({ userId, name }: {
    userId: string;
    name: string;
}): Promise<LibraryCollection> {
    requireLibraryOwner(userId);
    const normalized = libraryCollectionName(name);
    await ensureMediaLibraryOrganizationSchema();
    const rows = await query<Row>('INSERT INTO library_collections(user_id,id,name) VALUES($1,$2,$3) RETURNING *', [userId, `lc_${randomUUID()}`, normalized]);
    return mapCollection(rows[0]);
}
export async function renameLibraryCollection({ userId, collectionId, name }: {
    userId: string;
    collectionId: string;
    name: string;
}): Promise<LibraryCollection> {
    requireLibraryOwner(userId);
    const normalized = libraryCollectionName(name);
    await ensureMediaLibraryOrganizationSchema();
    const rows = await query<Row>('UPDATE library_collections SET name=$3,updated_at=now() WHERE user_id=$1 AND id=$2 RETURNING *', [userId, collectionId, normalized]);
    if (!rows[0])
        throw new LibraryOrganizationError('COLLECTION_NOT_FOUND', 404);
    return mapCollection(rows[0]);
}
export async function deleteLibraryCollection({ userId, collectionId }: {
    userId: string;
    collectionId: string;
}): Promise<void> {
    requireLibraryOwner(userId);
    await ensureMediaLibraryOrganizationSchema();
    const rows = await query('DELETE FROM library_collections WHERE user_id=$1 AND id=$2 RETURNING id', [userId, collectionId]);
    if (!rows.length)
        throw new LibraryOrganizationError('COLLECTION_NOT_FOUND', 404);
}
