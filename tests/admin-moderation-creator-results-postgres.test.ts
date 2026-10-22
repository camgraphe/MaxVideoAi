import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { readModerationCreatorResults } from '../frontend/server/admin-moderation-creator-results';
import type { ModerationToolResult } from '../frontend/server/admin-moderation-creator-results';

test('creator moderation reads the finalized customer result and keeps pending or unrelated outputs out', async () => {
  const db = await startDisposablePostgres('moderation-creator-results');
  try {
    await db.pool.query(`CREATE TABLE app_jobs(job_id text,user_id text,status text DEFAULT 'completed',settings_snapshot jsonb DEFAULT '{}');
      CREATE TABLE mcp_generation_quotes(quote_id text,job_id text,user_id text);
      CREATE TABLE creator_operations(id text,user_id text,tool_id text,status text,result jsonb)`);
    for (const [id, tool, status, owner, kind] of [
      ['final', 'lip-sync', 'completed', 'owner', 'video'], ['pending', 'lip-sync', 'finalizing', 'owner', 'video'],
      ['wrong-owner', 'lip-sync', 'completed', 'other', 'video'], ['photo', 'product-photo-editor', 'completed', 'owner', 'image'],
    ] as const) {
      await db.pool.query('INSERT INTO app_jobs(job_id,user_id) VALUES ($1,$2)', [id, 'owner']);
      await db.pool.query('INSERT INTO mcp_generation_quotes VALUES ($1,$1,$2)', [id, owner]);
      await db.pool.query('INSERT INTO creator_operations VALUES ($1,$2,$3,$4,$5)', [id, owner, tool, status,
        JSON.stringify({outputs:[{kind,originalUrl:`https://example.test/${id}`,thumbnailUrl:null}]})]);
    }
    const read = async <T>(sql: string, params?: unknown[]) => (await db.pool.query(sql, params)).rows as T[];
    const present = async (userId: string, value: { result: ModerationToolResult | null }) => ({ result: value.result ? {
      ...value.result,
      outputs: value.result.outputs?.map(output => ({ ...output, readUrl: `${output.originalUrl}?owner=${userId}`, thumbnailReadUrl: null })),
      ...(value.result.ref ? {readUrl:`${value.result.originalUrl}?owner=${userId}`,thumbnailReadUrl:'https://example.test/subtitle-thumb?owner='+userId}:{}),
    } : null });
    const result = await readModerationCreatorResults(['final', 'pending', 'wrong-owner', 'photo'], 'lip-sync', read, present);
    assert.equal(result.get('final')?.videoUrl, 'https://example.test/final?owner=owner');
    assert.equal(result.get('pending')?.status, 'finalizing');
    assert.equal(result.get('pending')?.videoUrl, null);
    assert.equal(result.get('pending')?.originalUrl, null);
    assert.equal(result.has('wrong-owner'), false);
    assert.equal(result.has('photo'), false);
    const photo = (await readModerationCreatorResults(['photo'], 'product-photo-editor', read, present)).get('photo');
    assert.equal(photo?.thumbUrl, 'https://example.test/photo?owner=owner');
    assert.equal(photo?.originalUrl, 'https://example.test/photo?owner=owner');
    assert.equal(photo?.videoUrl, null);
    await db.pool.query('INSERT INTO app_jobs(job_id,user_id,settings_snapshot) VALUES ($1,$2,$3)', ['subtitle','owner',JSON.stringify({toolId:'subtitles',subtitleResult:{ref:{type:'asset',assetId:'subtitle-asset',kind:'video'},originalUrl:'https://example.test/subtitle'}})]);
    const subtitle = (await readModerationCreatorResults(['subtitle'], 'subtitles', read, present)).get('subtitle');
    assert.equal(subtitle?.videoUrl, 'https://example.test/subtitle?owner=owner');
    assert.equal(subtitle?.thumbUrl, 'https://example.test/subtitle-thumb?owner=owner');
    const unavailable = await readModerationCreatorResults(['final'], 'lip-sync', read, async () => ({ result: null }));
    assert.equal(unavailable.get('final')?.videoUrl, null);
    assert.equal(unavailable.get('final')?.originalUrl, null);
  } finally { await db.cleanup(); }
});
