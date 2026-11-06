import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { createDefaultCharacterBuilderState } from '../frontend/src/lib/character-builder';
import {
  saveStudioCharacterOutput,
  getStudioCharacter,
  listStudioCharacters,
  renameStudioCharacter,
  updateStudioPresentation,
} from '../frontend/server/character-studio/store';

const owner = '00000000-0000-4000-8000-000000000091';
const other = '00000000-0000-4000-8000-000000000092';
const imageUrl = 'https://example.invalid/identity.png';
const source = (jobId = 'identity-A', url = imageUrl) => ({ name: 'Alba', jobId, imageUrl: url });
const snapshot = (characterId?: string) => ({
  schemaVersion: 1,
  surface: 'character-builder',
  action: 'generate',
  engineId: 'fixture',
  engineLabel: 'Fixture',
  inputMode: 't2i',
  prompt: 'Server-owned recipe',
  builder: { ...createDefaultCharacterBuilderState(), characterId },
  lineage: {},
});

test(
  'saved characters and looks remain durable, idempotent and account owned',
  { timeout: 60_000 },
  async (t) => {
    const pg = await startDisposablePostgres('character-studio-library');
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = pg.databaseUrl;
    t.after(async () => {
      await getDb().end();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
      await pg.cleanup();
    });
    await pg.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY)');
    await pg.pool.query('INSERT INTO profiles VALUES($1),($2)', [owner, other]);
    await pg.pool
      .query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id uuid,status text,hidden boolean,settings_snapshot jsonb,render_ids jsonb);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id uuid,kind text,status text,url text,storage_url text,thumb_url text)`);
    await pg.pool.query(readFileSync('neon/migrations/93_character_studio.sql', 'utf8'));
    await pg.pool.query(readFileSync('neon/migrations/94_character_studio_presentation.sql', 'utf8'));
    const addJob = async (id: string, userId = owner, characterId?: string, status = 'completed') => {
      const url = id === 'identity-A' ? imageUrl : `https://example.invalid/${id}.png`;
      await pg.pool.query('INSERT INTO app_jobs VALUES($1,$2,$3,false,$4,$5)', [
        id,
        userId,
        status,
        snapshot(characterId),
        JSON.stringify([{ url, thumb_url: 'https://example.invalid/thumb.png' }]),
      ]);
      return source(id, url);
    };
    await addJob('identity-A');
    const saved = await saveStudioCharacterOutput(owner, source());
    const id = saved.character.id;

    await t.test('exact original and server recipe survive a fresh read', async () => {
      assert.equal(saved.kind, 'character');
      const character = await getStudioCharacter(owner, id);
      assert.equal(character.name, 'Alba');
      assert.equal(character.identity.imageUrl, imageUrl);
      assert.equal(character.identity.thumbUrl, 'https://example.invalid/thumb.png');
      assert.equal(character.identity.settingsSnapshot.prompt, 'Server-owned recipe');
      assert.deepEqual(character.looks, []);
    });
    await t.test('casting notes persist independently from the generation recipe and only for their owner', async () => {
      await updateStudioPresentation(owner, id, { age: '35', outfit: '  Canvas apron  ' });
      await assert.rejects(updateStudioPresentation(other, id, { outfit: 'foreign' }));
      await assert.rejects(updateStudioPresentation(owner, id, { name: 'wrong field' }));
      await assert.rejects(updateStudioPresentation(owner, id, { age: 'a'.repeat(601) }));
      const result = await getStudioCharacter(owner, id);
      assert.deepEqual(result.presentation, { age: '35', outfit: 'Canvas apron' });
      assert.equal(result.identity.settingsSnapshot.prompt, 'Server-owned recipe');
    });
    await t.test('retries including concurrent saves return one identity', async () => {
      const results = await Promise.all([
        saveStudioCharacterOutput(owner, source()),
        saveStudioCharacterOutput(owner, source()),
      ]);
      assert.ok(results.every((result) => result.character.id === id));
      assert.equal((await listStudioCharacters(owner)).characters.length, 1);
    });
    await t.test('foreign IDs, URLs, unfinished and hidden jobs cannot be saved', async () => {
      await assert.rejects(saveStudioCharacterOutput(other, source()));
      await assert.rejects(getStudioCharacter(other, id));
      await assert.rejects(renameStudioCharacter(other, id, 'Hijacked'));
      await assert.rejects(
        saveStudioCharacterOutput(owner, source('identity-A', 'https://example.invalid/forged.png')),
      );
      await assert.rejects(
        saveStudioCharacterOutput(owner, await addJob('pending', owner, undefined, 'running')),
      );
      const hidden = await addJob('hidden');
      await pg.pool.query('UPDATE app_jobs SET hidden=true WHERE job_id=$1', [hidden.jobId]);
      await assert.rejects(saveStudioCharacterOutput(owner, hidden));
      assert.deepEqual((await listStudioCharacters(other)).characters, []);
    });
    await t.test('looks attach using stored generation lineage, not a client character choice', async () => {
      const look = await addJob('look-A', owner, id);
      const result = await saveStudioCharacterOutput(owner, { ...look, name: 'Veste bleue' });
      assert.equal(result.kind, 'look');
      assert.equal(result.character.id, id);
      assert.equal(result.character.identity.imageUrl, imageUrl);
      assert.equal(result.character.looks[0].name, 'Veste bleue');
      assert.equal((await saveStudioCharacterOutput(owner, look)).character.looks.length, 1);
      const foreignLineage = await addJob('look-B', other, id);
      await assert.rejects(saveStudioCharacterOutput(other, foreignLineage));
    });
    await t.test('renaming validates input and keeps lineage and identity intact', async () => {
      await assert.rejects(renameStudioCharacter(owner, id, '  '));
      await assert.rejects(renameStudioCharacter(owner, id, 'a'.repeat(81)));
      const updated = await renameStudioCharacter(owner, id, ' Alba Studio ');
      assert.equal(updated.name, 'Alba Studio');
      assert.equal(updated.looks.length, 1);
      assert.equal(updated.identity.imageUrl, imageUrl);
    });
    await t.test('deleted output projections cannot become new saved characters', async () => {
      const deleted = await addJob('deleted');
      await pg.pool.query(
        `INSERT INTO job_outputs VALUES('deleted-output',$1,$2,'image','deleted',$3,NULL,NULL)`,
        [deleted.jobId, owner, deleted.imageUrl],
      );
      await assert.rejects(saveStudioCharacterOutput(owner, deleted));
    });
    await t.test(
      'character and look pages have bounded disjoint cursors without losing older entries',
      async () => {
        for (let n = 0; n < 13; n++) await saveStudioCharacterOutput(owner, await addJob(`character-${n}`));
        for (let n = 0; n < 25; n++)
          await saveStudioCharacterOutput(owner, await addJob(`look-${n}`, owner, id));
        const first = await listStudioCharacters(owner);
        const second = await listStudioCharacters(owner, first.nextCursor);
        assert.equal(first.characters.length, 12);
        assert.equal(second.characters.length, 2);
        assert.equal(new Set([...first.characters, ...second.characters].map((c) => c.id)).size, 14);
        assert.equal(second.nextCursor, null);
        assert.equal('settingsSnapshot' in first.characters[0].identity, false);
        const looks = await getStudioCharacter(owner, id);
        const older = await getStudioCharacter(owner, id, looks.nextLookCursor);
        assert.equal(looks.lookCount, 26);
        assert.equal(looks.looks.length, 24);
        assert.equal(older.looks.length, 2);
        assert.equal(new Set([...looks.looks, ...older.looks].map((l) => l.id)).size, 26);
        assert.equal(older.nextLookCursor, null);
      },
    );
  },
);
