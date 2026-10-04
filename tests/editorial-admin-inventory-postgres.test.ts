import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { parseEditorialDraft } from '../frontend/lib/editorial/schema';
import { makeEditorialDraft } from './fixtures/editorial-draft';

test('article inventory distinguishes the latest saved version from an older published version', async () => {
  const db = await startDisposablePostgres('editorialinventory');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  const { getDb } = await import('../frontend/src/lib/db');
  try {
    for (const migration of ['49_editorial_drafts', '50_editorial_checks', '51_editorial_publications']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}.sql`, 'utf8'));
    }
    const { listEditorialDrafts, saveEditorialDraft, approveEditorialVersion } = await import('../frontend/src/server/editorial/repository');
    const draft = parseEditorialDraft(makeEditorialDraft());
    const first = await saveEditorialDraft({ draft, actor: 'fixture' });
    let row = (await listEditorialDrafts())[0];
    assert.equal(row.publicationStatus, null);
    assert.equal(row.publishedVersion, null);
    await approveEditorialVersion({ ...first, actor: 'fixture' });
    row = (await listEditorialDrafts())[0];
    assert.ok(row.approvedAt);
    assert.equal(row.publicationStatus, null, 'approval alone does not establish publication');
    await db.pool.query(`INSERT INTO editorial_publications(article_id,version,digest,status,requested_by) VALUES ($1,$2,$3,'queued','fixture')`, [first.articleId, first.version, first.digest]);
    for (const status of ['queued', 'awaiting-ci', 'awaiting-deployment', 'blocked', 'published']) {
      await db.pool.query('UPDATE editorial_publications SET status=$1', [status]);
      row = (await listEditorialDrafts())[0];
      assert.equal(row.publicationStatus, status);
      assert.equal(row.publishedVersion, status === 'published' ? 1 : null);
    }
    const second = await saveEditorialDraft({ draft: { ...draft, runKey: randomUUID() }, actor: 'fixture' });
    row = (await listEditorialDrafts())[0];
    assert.equal(row.version, second.version);
    assert.equal(row.publicationStatus, null, 'a published older version does not publish the revision');
    assert.equal(row.publishedVersion, 1);
    assert.equal(row.approvedAt, null);
  } finally {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    await db.cleanup();
  }
});
