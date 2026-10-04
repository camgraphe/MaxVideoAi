import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Pool } from 'pg';
import { parseEditorialDraft } from '../frontend/lib/editorial/schema.ts';
import { approveEditorialVersion, getEditorialVersion, saveEditorialDraft } from '../frontend/src/server/editorial/repository.ts';
import { requestEditorialCorrection, listEditorialCorrections } from '../frontend/src/server/editorial/corrections.ts';
import { saveEditorialChecks } from '../frontend/src/server/editorial/checks.ts';
import { checkedFixture } from './fixtures/editorial-checks.ts';
import { getDb } from '../frontend/src/lib/db.ts';
import { randomUUID } from 'node:crypto';
import { makeEditorialDraft } from './fixtures/editorial-draft.ts';

const testUrl = process.env.EDITORIAL_TEST_DATABASE_URL;
if (testUrl && !['127.0.0.1','localhost','[::1]'].includes(new URL(testUrl).hostname)) throw Error('Editorial repository tests require a disposable loopback database');

test('run retries are idempotent; changed content needs a new key and version', { skip: !testUrl }, async () => {
  process.env.DATABASE_URL = testUrl;
  const pool = new Pool({ connectionString: testUrl });
  try {
    await pool.query(readFileSync('neon/migrations/49_editorial_drafts.sql', 'utf8'));
    await pool.query(readFileSync('neon/migrations/50_editorial_checks.sql', 'utf8'));
    await pool.query(readFileSync('neon/migrations/51_editorial_publications.sql', 'utf8'));
    await pool.query('TRUNCATE editorial_events, editorial_versions, editorial_articles, editorial_topics RESTART IDENTITY CASCADE');
    const { draft: first, report } = checkedFixture();
    const created = await saveEditorialDraft({ draft: first, actor: 'test' });
    const replay = await saveEditorialDraft({ draft: first, actor: 'test' });
    assert.deepEqual(replay, created);
    assert.equal(created.version, 1);
    await assert.rejects(approveEditorialVersion({ ...created, digest: '0'.repeat(64), actor: 'human-admin' }), /exact version/);
    await approveEditorialVersion({ ...created, actor: 'human-admin' });
    assert.equal((await getEditorialVersion(created.articleId, 1))?.approvedBy, 'human-admin');
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM editorial_checks')).rows[0].count, 0);
    await saveEditorialChecks(created.articleId, created.version, created.digest, report, 'test-checker');

    const changed = structuredClone(first);
    changed.locales.en.title = 'A different title';
    await assert.rejects(saveEditorialDraft({ draft: parseEditorialDraft(changed), actor: 'test' }), /run key/i);

    const correction = {...created,requestId:randomUUID(),locale:'fr' as const,blockId:first.locales.fr.blocks[0].id,message:'Préciser le rôle du personnage.'};
    const recorded = await requestEditorialCorrection(correction, 'test-owner');
    assert.deepEqual(await requestEditorialCorrection(correction, 'test-owner'), recorded);
    assert.equal((await listEditorialCorrections(created.articleId,1)).length,1);
    assert.equal((await getEditorialVersion(created.articleId,1))?.approvedAt,null);
    await assert.rejects(requestEditorialCorrection({...correction,requestId:randomUUID(),blockId:'missing'},'test-owner'),/Unknown correction block/);
    await assert.rejects(approveEditorialVersion({...created,actor:'test-owner'}),/correction requires/);
    changed.runKey = 'manual-2026-09-18-shot-list-v2';
    changed.quality.mediaOk = false;
    const second = await saveEditorialDraft({ draft: parseEditorialDraft(changed), actor: 'test' });
    assert.equal(second.articleId, created.articleId);
    assert.equal(second.version, 2);
    await assert.rejects(requestEditorialCorrection({...correction,requestId:randomUUID()},'test-owner'),/latest exact version/);
    assert.notEqual(second.digest, created.digest);
    assert.equal((await pool.query('SELECT status FROM editorial_articles WHERE id = $1', [created.articleId])).rows[0].status, 'draft');
    await assert.rejects(approveEditorialVersion({ ...created, actor: 'human-admin' }), /latest exact version/);
    await approveEditorialVersion({ ...second, actor: 'human-admin' });
    assert.equal((await getEditorialVersion(created.articleId, 2))?.approvedBy, 'human-admin');
    assert.equal((await getEditorialVersion(created.articleId, 1))?.draft.locales.en.title, first.locales.en.title);
    assert.equal((await getEditorialVersion(created.articleId, 2))?.draft.locales.en.title, changed.locales.en.title);
  } finally {
    await pool.end();
    await getDb().end();
  }
});
