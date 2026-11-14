import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('18+ document migration preserves consent evidence, newer versions and publication time on retry', async t => {
  const pg = await startDisposablePostgres('adult-legal');
  t.after(() => pg.cleanup());
  await pg.pool.query(readFileSync('neon/migrations/01_legal_documents.sql', 'utf8'));
  await pg.pool.query(`CREATE TABLE user_consents (user_id text,doc_key text,doc_version text,accepted boolean);
    INSERT INTO user_consents VALUES ('old-user','age_attestation','min_age:15',true);
    UPDATE legal_documents SET title='Localized title',url='/fr/legal/terms' WHERE key='terms';`);
  const migration = readFileSync('neon/migrations/99_legal_adult_eligibility.sql', 'utf8');
  await pg.pool.query(migration);
  const first = (await pg.pool.query('SELECT * FROM legal_documents ORDER BY key')).rows;
  assert.equal(first.find(r => r.key === 'terms').version, '2026-11-11');
  assert.equal(first.find(r => r.key === 'terms').title, 'Localized title');
  assert.equal(first.find(r => r.key === 'terms').url, '/fr/legal/terms');
  assert.equal(first.find(r => r.key === 'privacy').version, '2026-11-11');
  assert.equal(first.find(r => r.key === 'cookies').version, '2025-10-26');
  await pg.pool.query(migration);
  assert.deepEqual((await pg.pool.query('SELECT * FROM legal_documents ORDER BY key')).rows, first);
  await pg.pool.query("UPDATE legal_documents SET version='2026-12-01' WHERE key='terms'");
  await pg.pool.query(migration);
  assert.equal((await pg.pool.query("SELECT version FROM legal_documents WHERE key='terms'")).rows[0].version, '2026-12-01');
  assert.deepEqual((await pg.pool.query('SELECT * FROM user_consents')).rows, [
    { user_id: 'old-user', doc_key: 'age_attestation', doc_version: 'min_age:15', accepted: true },
  ]);
});
