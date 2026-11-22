import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { getDb } from '../frontend/src/lib/db';
import { promptSessionSnapshotSchema } from '../frontend/src/lib/prompt-assistance/session';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('Milo history keeps only submitted slots and reauthorizes owned visible originals for each inspection', async (t) => {
  const pg = await startDisposablePostgres('milo-turn-media');
  const bucket = 'milo-turn-test.s3.us-east-1.amazonaws.com';
  const env = {
    DATABASE_URL: pg.databaseUrl,
    PROMPT_ASSISTANCE_ENABLED: 'true',
    S3_BUCKET: 'milo-turn-test',
    S3_REGION: 'us-east-1',
    S3_PUBLIC_BASE_URL: 'https://' + bucket,
    S3_ACCESS_KEY_ID: 'fixture',
    S3_SECRET_ACCESS_KEY: 'fixture',
  };
  const previous = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  t.after(async () => {
    await getDb().end();
    for (const [k, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[k];
      else process.env[k] = value;
    }
    await pg.cleanup();
  });
  const { handleMobileMilo } = await import('../frontend/src/server/mobile/milo');
  const { readMobileMiloMedia } = await import('../frontend/src/server/mobile/milo-media');
  const { handlePromptAssistance } = await import('../frontend/src/server/prompt-assistance/route-handler');
  const { setupToolLibrary, mutateLibraryOrganization } = await import('./helpers/mobile-tool-library');
  const { GET: mediaGet } = await import('../frontend/app/api/mobile/milo/media/route');
  await setupToolLibrary();
  await pg.pool
    .query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY, user_id text, hidden boolean DEFAULT false);
    CREATE TABLE prompt_assistance_sessions(user_id text, id uuid, scope text, expires_at timestamptz);
    CREATE TABLE prompt_assistance_requests(user_id text, session_id uuid, request_id uuid, state text,
      created_at timestamptz DEFAULT now(), input_json jsonb, reply_json jsonb, error text)`);
  const sessionId = randomUUID(),
    requestId = randomUUID(),
    next = randomUUID();
  const refs = [
    { type: 'asset', kind: 'image', assetId: 'ma_' + '1'.repeat(32) },
    { type: 'asset', kind: 'video', assetId: 'ma_' + '2'.repeat(32) },
    { type: 'asset', kind: 'image', assetId: 'ma_' + '3'.repeat(32) },
  ] as const;
  const slots = [
    { fieldId: 'startImage', slot: 0 },
    { fieldId: 'video_urls', slot: 0 },
    { fieldId: 'otherImages', slot: 0 },
  ];
  for (const [i, ref] of refs.entries()) {
    const owner = i === 2 ? 'bob' : 'alice';
    const prefix = 'https://' + bucket + '/user-assets/' + owner + '/';
    const name = i === 1 ? 'Camera.mp4' : 'Frame.png';
    await pg.pool.query(
      `INSERT INTO media_assets(id,public_id,user_id,kind,url,thumb_url,source,mime_type,metadata)
      VALUES($1,$2,$3,$4,$5,$6,'upload',$7,$8::jsonb)`,
      [
        String(i),
        ref.assetId,
        owner,
        ref.kind,
        prefix + name,
        prefix + name + '.webp',
        i === 1 ? 'video/mp4' : 'image/png',
        JSON.stringify({ originalName: name }),
      ],
    );
  }
  const references = refs.map((ref, i) => ({
    ...slots[i],
    label: 'private arbitrary label',
    ref,
  }));
  await pg.pool.query("INSERT INTO prompt_assistance_sessions VALUES ($1,$2,$3,now()+interval '1 day')", [
    'alice',
    sessionId,
    'video:create',
  ]);
  await pg.pool.query(
    `INSERT INTO prompt_assistance_requests(user_id,session_id,request_id,state,input_json,reply_json)
    VALUES('alice',$1,$2,'complete',$4::jsonb,'{"reply":"OK","text":null}'),('alice',$1,$3,'preparing',$5::jsonb,null)`,
    [
      sessionId,
      requestId,
      next,
      JSON.stringify({
        message: 'Discuss the shot',
        draft: { text: 'private draft', references },
      }),
      JSON.stringify({
        message: 'Next shot',
        draft: { references: [references[1]] },
      }),
    ],
  );
  const request = () =>
    new NextRequest('https://test.invalid/api/mobile/milo?sessionId=' + sessionId + '&scope=video:create', {
      headers: { 'x-milo-turn-media': '1' },
    });
  const session = await (
    await handleMobileMilo(request(), {
      enabled: true,
      user: async () => 'alice',
    })
  ).json();
  const markers = slots.map((s, i) => ({ ...s, kind: refs[i].kind }));
  assert.deepEqual(session.result.turns[0].attachments, markers);
  assert.deepEqual(session.result.pending.attachments, [markers[1]]);
  assert.doesNotMatch(JSON.stringify(session), /ma_|private draft|arbitrary label|https:/);
  const web = await (
    await handlePromptAssistance(request(), {
      enabled: true,
      access: async () => ({ ok: true, userId: 'alice' }),
    })
  ).json();
  assert.ok(promptSessionSnapshotSchema.safeParse(web.result).success);
  assert.equal(web.result.turns[0].attachments, undefined);
  assert.equal(web.result.pending.attachments, undefined);

  const authRequired = await mediaGet(request());
  assert.equal(authRequired.status, 401);
  assert.match(authRequired.headers.get('cache-control')!, /no-store/);
  const read = (location?: (typeof slots)[number]) =>
    readMobileMiloMedia('alice', sessionId, requestId, location);
  const previews = await read();
  assert.deepEqual(
    previews.map((p) => p.state),
    ['ready', 'ready', 'unavailable'],
  );
  assert.ok(
    previews[0].state === 'ready' && new URL(previews[0].thumbnail!).searchParams.get('X-Amz-Signature'),
  );
  assert.ok(previews[1].state === 'ready' && previews[1].name === 'Camera.mp4' && !previews[1].original);
  assert.deepEqual(previews[2], { ...markers[2], state: 'unavailable' });
  const [opened] = await read(slots[1]);
  assert.ok(opened.state === 'ready' && new URL(opened.original!).searchParams.get('X-Amz-Signature'));
  assert.deepEqual(await read({ fieldId: 'startImage', slot: 1 }), []);
  await assert.rejects(readMobileMiloMedia('bob', sessionId, requestId), /Message unavailable/);
  await assert.rejects(readMobileMiloMedia('alice', randomUUID(), requestId), /Message unavailable/);
  await mutateLibraryOrganization({
    userId: 'alice',
    operation: 'trash',
    references: [refs[1]],
  });
  assert.deepEqual(await read(slots[1]), [{ ...markers[1], state: 'unavailable' }]);
  await pg.pool.query('UPDATE media_assets SET deleted_at=now() WHERE public_id=$1', [refs[0].assetId]);
  assert.deepEqual(await read(slots[0]), [{ ...markers[0], state: 'unavailable' }]);
});
