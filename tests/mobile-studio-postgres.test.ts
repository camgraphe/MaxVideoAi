import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { ensureMediaLibrarySchema } from '../frontend/src/lib/schema/media-library-schema';
import { getDb } from '../frontend/src/lib/db';
import { chooseStudioAssistance } from '../frontend/src/server/studio/assistance-ledger';
import { STUDIO_TASK_PROFILES } from '../frontend/src/lib/studio/task-budget-contract';
import { handleMobileStudio } from '../frontend/src/server/mobile/studio';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const headers = { authorization: 'Bearer offline-fixture', 'x-maxvideoai-auth-mode': 'bearer' };
function request(body?: unknown, auth: Record<string, string> = headers, search = '') {
  return new NextRequest('https://example.invalid/api/mobile/studio/projects' + search, {
    method: body ? 'POST' : 'GET',
    headers: auth,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('mobile Studio rejects cookie fallback, disabled Studio and outstanding consent before data access', async () => {
  for (const auth of [
    { cookie: 'fixture=value' },
    { authorization: 'Bearer fixture' },
    { 'x-maxvideoai-auth-mode': 'bearer' },
  ]) {
    for (const body of [undefined, { action: 'create' }]) {
      const result = await handleMobileStudio(request(body, auth as Record<string, string>), undefined, {
        access: async () => {
          throw Error('Unexpected access');
        },
      });
      assert.equal(result.status, 401);
    }
  }
  const access = async () => ({ ok: true as const, userId: 'fixture' });
  assert.equal(
    (await handleMobileStudio(request(), undefined, { access, enabled: () => false })).status,
    404,
  );
  assert.equal(
    (
      await handleMobileStudio(request(), undefined, {
        access,
        enabled: () => true,
        consentBlocked: async () => true,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await handleMobileStudio(request(), undefined, {
        access: async () => ({ ok: false, status: 403, error: 'FORBIDDEN' }),
      })
    ).status,
    403,
  );
});

test('Studio phone projects, journal and reviewed messages share website ownership, identity and task ceiling', async (t) => {
  const pg = await startDisposablePostgres('native-studio');
  const env = {
    DATABASE_URL: pg.databaseUrl,
    STUDIO_ASSISTANCE_ENABLED: 'true',
    STUDIO_CONVERSATION_TASKS_ENABLED: 'true',
    STUDIO_CONVERSATION_ACTIONS_ENABLED: 'true',
    STUDIO_CONVERSATION_MEDIA_ENABLED: 'true',
    STUDIO_IMAGE_CONVERSATION_ENABLED: 'true',
    STUDIO_CONVERSATION_EDITING_ENABLED: 'true',
  };
  const before = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(async () => {
    await getDb().end();
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await ensureMediaLibrarySchema();
  for (const migration of [
    '26_studio_projects',
    '42_studio_connected_montages',
    '50_studio_image_conversation',
    '51_studio_image_model_usage',
    '52_studio_conversation_runs',
    '54_studio_assistance_ledger',
    '62_studio_assistance_resolutions',
    '63_studio_assistance_credits',
    '65_studio_task_budgets',
    '67_studio_luna_reasoning',
    '86_milo_three_levels',
    '87_milo_runtime_bounds',
    '88_milo_task_profiles',
    '94_studio_conversation_reply_envelope',
    '96_milo_lite_output_allowance',
  ]) {
    await pg.pool.query(readFileSync('neon/migrations/' + migration + '.sql', 'utf8'));
  }
  const owner = randomUUID(),
    foreign = randomUUID(),
    wake: string[] = [];
  const route = (id?: string, body?: unknown, userId: string = owner, search = '') =>
    handleMobileStudio(request(body, headers, search), id, {
      access: async () => ({ ok: true, userId }),
      consentBlocked: async () => false,
      wake: (_kind, scope) => {
        assert.equal(scope.userId, owner);
        wake.push(scope.requestId);
      },
    });
  const create = { action: 'create', name: 'Vertical teaser', idempotencyKey: randomUUID() };
  const first = await route(undefined, create);
  assert.equal(first.status, 200);
  const { projectId } = await first.json();
  assert.ok(projectId);
  assert.equal((await (await route(undefined, create)).json()).projectId, projectId);
  assert.deepEqual((await (await route(undefined, undefined, foreign)).json()).projects, []);
  assert.equal((await (await route()).json()).projects[0].id, projectId);
  const rename = { action: 'rename', name: 'Paper boats', idempotencyKey: randomUUID() };
  assert.equal((await route(projectId, rename, foreign)).status, 404);
  assert.equal((await route(projectId, undefined, foreign)).status, 404);
  assert.equal((await (await route(projectId, rename)).json()).name, 'Paper boats');
  const journal = await (await route(projectId)).json();
  assert.equal(journal.projectName, 'Paper boats');
  assert.deepEqual(journal.turns, []);
  assert.ok(journal.allowance);
  const a = journal.allowance,
    requestId = randomUUID();
  assert.equal(a.customerMaxCredits, STUDIO_TASK_PROFILES.standard.maxCredits);
  assert.equal(a.maxCredits, STUDIO_TASK_PROFILES.standard.maxCredits);
  const kinds = ['audio', 'image', 'video'] as const;
  const media = kinds.map(kind => ({kind, assetId: 'ma_' + randomUUID().replaceAll('-', '')}));
  for (const ref of media) {
    const extension = {audio:'mp3', image:'png', video:'mp4'}[ref.kind];
    const mime = {audio:'audio/mpeg', image:'image/png', video:'video/mp4'}[ref.kind];
    await pg.pool.query(`INSERT INTO media_assets (id,public_id,user_id,kind,url,mime_type,source,status)
      VALUES ($1,$2,$3,$4,$5,$6,'upload','ready')`,[randomUUID(),ref.assetId,owner,ref.kind,'https://cdn.maxvideoai.com/studio-test.' + extension,mime]);
  }
  const foreignImage = 'ma_' + randomUUID().replaceAll('-', '');
  await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,source,status)
    VALUES($1,$2,$3,'image','https://cdn.maxvideoai.com/foreign.png','image/png','upload','ready')`,[randomUUID(),foreignImage,foreign]);
  const command = {
    media,
    action: 'message',
    confirmed: true,
    locale: 'en',
    requestId,
    message: 'Plan an opening shot.',
    model: a.model,
    assistanceRevision: a.revision,
    policyVersion: a.policyVersion,
    maxCredits: a.maxCredits,
    customerMaxCredits: a.customerMaxCredits,
  };
  for (const changed of [
    { confirmed: false },
    { assistanceRevision: a.revision + 1 },
    { maxCredits: a.maxCredits + 100 },
    { customerMaxCredits: 999 },
    { model: 'gpt-6.1-terra', customerMaxCredits: STUDIO_TASK_PROFILES.quick.maxCredits },
    { action: 'confirm' },
    { references: ['ma_foreign'] },
    { media: [media[1], media[1]] },
    { media: [{assetId:media[1].assetId,kind:'audio'}] },
    { media: [{assetId:'ma_' + 'e'.repeat(32),kind:'image'}] },
    { media: [{assetId:foreignImage,kind:'image'}] },
    { media: [{ ...media[0], label: 'Image 7' }] },
    { media: [{ ...media[0], label: 'Audio 7' }, media[1]] },
    { media: [{ ...media[1], label: 'Image 7' }, { assetId: foreignImage, kind: 'image', label: 'Image 7' }] },
  ]) {
    assert.ok((await route(projectId, { ...command, ...changed })).status >= 400);
  }
  assert.equal(wake.length, 0);
  assert.equal((await route(projectId, command, foreign)).status, 404);
  const sent = await route(projectId, command);
  assert.equal(sent.status, 200);
  assert.deepEqual(await sent.json(), { projectId, requestId });
  assert.equal((await route(projectId, command)).status, 200);
  const reopened = await (await route(projectId)).json();
  assert.deepEqual(
    reopened.turns.map((turn: { requestId: string; message: string; state: string }) => [
      turn.requestId,
      turn.message,
      turn.state,
    ]),
    [[requestId, command.message, 'thinking']],
  );
  assert.deepEqual(wake, [requestId, requestId]);
  const { rows: [saved] } = await pg.pool.query('SELECT input_json, profile, profile_json FROM studio_tasks WHERE request_id=$1', [requestId]);
  assert.equal(saved.profile, 'standard');
  assert.equal(saved.profile_json.targetInputTokens, 64_000);
  assert.equal(saved.profile_json.maxInputTokens, 128_000);
  assert.equal(saved.input_json.clientSurface, 'mobile');
  assert.equal(saved.input_json.message, command.message);
  assert.deepEqual(saved.input_json.references, [media[1].assetId]);
  assert.deepEqual(saved.input_json.attachments.map((ref: {assetId:string}) => ref.assetId), [media[0].assetId, media[2].assetId]);
  assert.deepEqual(reopened.turns[0].media, media);
  assert.equal(a.stableReferenceLabels, true);
  const withLabels = await (await route(projectId, undefined, owner, '?mediaLabels=1')).json();
  assert.deepEqual(withLabels.turns[0].media, media.map((ref, i) => ({ ...ref, label: ['Audio 1','Image 1','Video 1'][i] })));
  const photo = media[1].assetId;
  const photoQuery = '?view=photos&asset=' + photo + '&requestId=' + requestId;
  const thumbnails = await route(projectId, undefined, owner, photoQuery);
  assert.equal(thumbnails.status, 200);
  assert.equal(thumbnails.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await thumbnails.json(), { projectId, requestId, items: [{
    assetId: photo, state: 'ready', thumbnail: 'https://cdn.maxvideoai.com/studio-test.png',
  }] });
  assert.equal((await route(projectId, undefined, foreign, photoQuery)).status, 404);
  const exact = await (await route(projectId, undefined, owner, photoQuery + '&original=1')).json();
  assert.equal(exact.items[0].original, 'https://cdn.maxvideoai.com/studio-test.png');
  assert.equal((await route(projectId, undefined, owner, photoQuery + '&asset=' + photo + '&original=1')).status, 400);
  assert.equal((await route(projectId, undefined, owner, photoQuery.replace(requestId, randomUUID()))).status, 404);
  assert.equal((await route(projectId, undefined, owner, photoQuery.replace(photo, foreignImage))).status, 404);
  assert.deepEqual((await (await route(projectId, undefined, owner, '?view=photos&asset=' + foreignImage + '&original=1')).json()).items,
    [{ assetId: foreignImage, state: 'unavailable' }]);

  const legacyRequestId = randomUUID();
  await pg.pool.query(`INSERT INTO studio_image_turns
    (user_id,project_id,request_id,request_hash,input_json,lease_id,lease_expires_at,state)
    VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp(),'failed')`, [owner,projectId,legacyRequestId,'f'.repeat(64),
    { requestId: legacyRequestId, message: 'Older studio photo.', references: [photo] },randomUUID()]);
  const legacyPhoto = await route(projectId, undefined, owner, photoQuery.replace(requestId, legacyRequestId) + '&original=1');
  assert.equal(legacyPhoto.status, 200);
  assert.equal((await legacyPhoto.json()).items[0].original, 'https://cdn.maxvideoai.com/studio-test.png');
  for (const [query, count] of [
    ['SELECT count(*)::int n FROM studio_projects', 1],
    ['SELECT count(*)::int n FROM studio_tasks', 1],
    ['SELECT count(*)::int n FROM studio_assistance_calls', 0],
    ["SELECT count(*)::int n FROM app_receipts WHERE type='charge'", 0],
  ] as const)
    assert.equal((await pg.pool.query(query)).rows[0].n, count);

  const remove = { action: 'delete', confirmed: true };
  assert.equal((await route(projectId, remove)).status, 409);
  const sibling = await (await route(undefined, { ...create, name: 'Paper boats', idempotencyKey: randomUUID() })).json();
  assert.equal((await route(sibling.projectId, { action: 'delete' })).status, 400);
  assert.equal((await route(sibling.projectId, remove, foreign)).status, 404);
  assert.equal((await route(sibling.projectId)).status, 200);
  assert.deepEqual(await (await route(sibling.projectId, remove)).json(), { projectId: sibling.projectId, deleted: true });
  assert.equal((await route(sibling.projectId, remove)).status, 404);
  assert.equal((await route(sibling.projectId)).status, 404);
  assert.deepEqual((await (await route()).json()).projects.map((p: { id: string }) => p.id), [projectId]);
  assert.equal((await route(projectId)).status, 200);
  assert.equal((await pg.pool.query('SELECT deleted_at IS NOT NULL AS removed FROM studio_projects WHERE id=$1',[sibling.projectId])).rows[0].removed, true);
  // A mobile retry using the original offer still replays under the exact quick budget.
  const otherProject = await (await route(undefined, { ...create, idempotencyKey: randomUUID() }, foreign)).json();
  await chooseStudioAssistance(foreign, {action: 'select_luna', expectedRevision: 0});
  const lite = (await (await route(otherProject.projectId, undefined, foreign)).json()).allowance;
  assert.equal(lite.customerMaxCredits, 0);
  assert.equal(lite.maxCredits, a.maxCredits);
  const legacy = { ...command, media: [{ assetId: foreignImage, kind: 'image', label: 'Image 7' }],
    requestId: randomUUID(), model: lite.model,
    assistanceRevision: lite.revision, customerMaxCredits: 0, maxCredits: STUDIO_TASK_PROFILES.quick.maxCredits };
  const sendLegacy = () => handleMobileStudio(request(legacy), otherProject.projectId, {
    access: async () => ({ ok: true, userId: foreign }),
    consentBlocked: async () => false,
    wake: () => {},
  });
  assert.equal((await sendLegacy()).status, 200);
  assert.equal((await sendLegacy()).status, 200);
  const old = (await pg.pool.query('SELECT profile, max_credits, profile_json, input_json FROM studio_tasks WHERE request_id=$1', [legacy.requestId])).rows;
  assert.equal(old.length, 1);
  assert.equal(old[0].profile, 'quick');
  assert.equal(old[0].max_credits, STUDIO_TASK_PROFILES.quick.maxCredits);
  assert.equal(old[0].profile_json.maxInputTokens, 12_000);
  assert.equal(old[0].profile_json.targetInputTokens, undefined);
  assert.deepEqual(old[0].input_json.referenceMentions, [{ assetId: foreignImage, label: 'Image 7' }]);
  assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM media_assets WHERE user_id=$1',[owner])).rows[0].n, 3);
});
