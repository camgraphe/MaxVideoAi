import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import type {
  StudioCharacter,
  StudioCharacterPage,
  StudioCharacterSummary,
  StudioImage,
  StudioLook,
  StudioSaveInput,
  StudioSaveResult,
} from '@/types/character-studio';
import { resolveStudioOutput, studioId, studioName, StudioLibraryError } from './source';

import { parseStudioPresentation, type StudioPresentation } from '@/lib/character-studio-presentation';

type Row = {
  presentation?: StudioPresentation;
  id: string;
  name: string;
  source_job_id: string;
  image_url: string;
  thumb_url: string;
  settings_snapshot: StudioImage['settingsSnapshot'];
  created_at: string;
  look_count: string;
};
const db: QueryExecutor = { query };
const image = (row: Row): StudioImage => ({
  jobId: row.source_job_id,
  imageUrl: row.image_url,
  thumbUrl: row.thumb_url,
  settingsSnapshot: row.settings_snapshot,
});
const summary = (row: Row): StudioCharacterSummary => ({
  id: String(row.id),
  name: row.name,
  identity: { jobId: row.source_job_id, imageUrl: row.image_url, thumbUrl: row.thumb_url },
  createdAt: row.created_at,
  lookCount: Number(row.look_count ?? 0),
});

export async function listStudioCharacters(
  userId: string,
  before?: string | null,
  name?: string,
  search?: string,
): Promise<StudioCharacterPage> {
  if (!userId) throw new StudioLibraryError('auth_required', 401);
  const rows = await db.query<Row>(
    `SELECT c.id::text,c.name,c.source_job_id,c.image_url,c.thumb_url,c.created_at::text,
    (SELECT count(*) FROM character_studio_looks l WHERE l.character_id=c.id AND l.user_id=c.user_id)::text AS look_count
    FROM character_studio_characters c WHERE c.user_id=$1 AND ($2::bigint IS NULL OR c.id<$2)
    AND ($3::text IS NULL OR lower(c.name)=lower($3))
    AND ($4::text IS NULL OR strpos(lower(c.name),lower($4))>0)
    ORDER BY c.id DESC LIMIT 13`,
    [userId, before ? studioId(before) : null, name === undefined ? null : studioName(name),
      search === undefined ? null : studioName(search)],
  );
  return {
    characters: rows.slice(0, 12).map(summary),
    nextCursor: rows.length > 12 ? String(rows[11].id) : null,
  };
}

export async function getStudioCharacter(
  userId: string,
  id: string,
  beforeLook?: string | null,
  executor: QueryExecutor = db,
  lookName?: string,
): Promise<StudioCharacter> {
  const [row] = await executor.query<Row>(
    `SELECT c.*,c.id::text,c.created_at::text,
    (SELECT count(*) FROM character_studio_looks l WHERE l.character_id=c.id AND l.user_id=c.user_id)::text AS look_count
    FROM character_studio_characters c WHERE c.user_id=$1 AND c.id=$2`,
    [userId, studioId(id)],
  );
  if (!row) throw new StudioLibraryError('character_unavailable', 404);
  const rows = await executor.query<Row>(
    `SELECT l.*,l.id::text,l.created_at::text FROM character_studio_looks l
    WHERE l.user_id=$1 AND l.character_id=$2 AND ($3::bigint IS NULL OR l.id<$3)
    AND ($4::text IS NULL OR lower(l.name)=lower($4)) ORDER BY l.id DESC LIMIT 25`,
    [userId, id, beforeLook ? studioId(beforeLook) : null, lookName === undefined ? null : studioName(lookName)],
  );
  const looks: StudioLook[] = rows
    .slice(0, 24)
    .map((look) => ({ ...image(look), id: String(look.id), name: look.name, createdAt: look.created_at }));
  return {
    ...summary(row),
    identity: image(row),
    presentation: row.presentation ?? {},
    looks,
    nextLookCursor: rows.length > 24 ? String(rows[23].id) : null,
  };
}

/** Exact lookup does not depend on which page of looks the client has loaded. */
export async function getStudioCharacterLook(userId: string, characterId: string, lookId: string): Promise<StudioLook> {
  const [row] = await db.query<Row>(
    `SELECT l.*,l.id::text,l.created_at::text FROM character_studio_looks l
     JOIN character_studio_characters c ON c.id=l.character_id AND c.user_id=l.user_id
     WHERE l.user_id=$1 AND l.character_id=$2 AND l.id=$3`,
    [userId, studioId(characterId), studioId(lookId)],
  );
  if (!row) throw new StudioLibraryError('look_unavailable', 404);
  return {...image(row), id:String(row.id), name:row.name, createdAt:row.created_at};
}

export async function saveStudioCharacterOutput(
  userId: string,
  input: StudioSaveInput,
): Promise<StudioSaveResult> {
  if (!userId) throw new StudioLibraryError('auth_required', 401);
  const name = studioName(input.name);
  return withDbTransaction(async (transaction) => {
    const source = await resolveStudioOutput(transaction, userId, input.jobId, input.imageUrl);
    const parentId = source.settingsSnapshot.builder.characterId;
    let id: string;
    if (parentId) {
      id = studioId(parentId);
      const [parent] = await transaction.query(
        `SELECT id FROM character_studio_characters WHERE user_id=$1 AND id=$2 FOR SHARE`,
        [userId, id],
      );
      if (!parent) throw new StudioLibraryError('character_unavailable', 404);
      await transaction.query(
        `INSERT INTO character_studio_looks(character_id,user_id,name,source_job_id,image_url,thumb_url,settings_snapshot)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,source_job_id,image_url) DO NOTHING`,
        [
          id,
          userId,
          name,
          source.jobId,
          source.imageUrl,
          source.thumbUrl,
          JSON.stringify(source.settingsSnapshot),
        ],
      );
    } else {
      const [row] = await transaction.query<{ id: string }>(
        `INSERT INTO character_studio_characters(user_id,name,source_job_id,image_url,thumb_url,settings_snapshot)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,source_job_id,image_url) DO UPDATE SET name=character_studio_characters.name RETURNING id::text`,
        [
          userId,
          name,
          source.jobId,
          source.imageUrl,
          source.thumbUrl,
          JSON.stringify(source.settingsSnapshot),
        ],
      );
      id = row.id;
    }
    return {
      character: await getStudioCharacter(userId, id, null, transaction),
      kind: parentId ? 'look' : 'character',
    };
  });
}

export async function renameStudioCharacter(
  userId: string,
  id: string,
  name: string,
): Promise<StudioCharacter> {
  const rows = await db.query(
    `UPDATE character_studio_characters SET name=$3,updated_at=now() WHERE user_id=$1 AND id=$2 RETURNING id`,
    [userId, studioId(id), studioName(name)],
  );
  if (!rows.length) throw new StudioLibraryError('character_unavailable', 404);
  return getStudioCharacter(userId, id);
}

export async function updateStudioPresentation(userId: string, id: string, input: unknown): Promise<StudioCharacter> {
  const presentation = parseStudioPresentation(input);
  if (!presentation) throw new StudioLibraryError('invalid_payload');
  const rows = await db.query(
    'UPDATE character_studio_characters SET presentation=$3::jsonb, updated_at=now() WHERE user_id=$1 AND id=$2 RETURNING id',
    [userId, studioId(id), JSON.stringify(presentation)],
  );
  if (!rows.length) throw new StudioLibraryError('character_unavailable', 404);
  return getStudioCharacter(userId, id);
}
