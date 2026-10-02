import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb, type TransactionQueryExecutor} from '../frontend/src/lib/db';
import type {ImageTurnInput} from '../frontend/src/lib/studio/image-conversation-contract';
import type {StudioMediaIntent} from '../frontend/lib/studio/conversation-media-contract';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import type {CanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-types';
import type {CanonicalAudioRequest} from '../frontend/src/server/agent-api/audio-normalization';
import type {AgentPublicGenerationEngine} from '../frontend/src/server/agent-api/model-catalog';
import type {McpGenerationQuote} from '../frontend/src/server/agent-api/quote-repository';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import {prepareAudioRun} from '../frontend/src/server/audio/prepare-audio';
import {completeAudioJob} from '../frontend/src/server/audio/audio-generate-jobs';
import {loadPricingPolicyOverridesWithExecutor} from '../frontend/src/lib/pricing-rule-store';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioImageGenerationService, createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {createStudioAudioGenerationService} from '../frontend/src/server/studio/audio-generation-service';
import {createPaidGenerationTestSchema, startDisposablePostgres} from './helpers/disposable-postgres';
import {addTopup, ProviderHarness} from './helpers/mcp-paid-e2e-harness';

type MediaRequest = CanonicalGenerationRequest | CanonicalAudioRequest;
type RecoveryCase = {name: string; message: string; action: StudioMediaIntent; expected: MediaRequest};
const firstFrame = 'ma_' + '1'.repeat(32);
const lastFrame = 'ma_' + '2'.repeat(32);
const videoPrompt = 'A slow vertical camera move between two warm cream compositions';
const narration = 'Tu historia empieza con una conversación.';
const musicPrompt = 'Warm instrumental piano and subtle strings, no vocals';
const cases: RecoveryCase[] = [
  {
    name: 'selected Wan duration, resolution, audio and frame roles', message: 'Animate these images with the chosen settings.',
    action: {action: 'video.prepare', reply: 'An eight-second vertical camera move. Review the quote.', prompt: videoPrompt,
      aspectRatio: '16:9', source: null, modelId: 'wan-3', mode: 'i2v', outputCount: 1,
      settings: [{name: 'durationSec', value: 8}, {name: 'resolution', value: '720p'}, {name: 'audio', value: true}, {name: 'aspectRatio', value: '9:16'}],
      references: [{ref: {type: 'asset', kind: 'image', assetId: firstFrame}, role: 'first_frame', slot: null},
        {ref: {type: 'asset', kind: 'image', assetId: lastFrame}, role: 'last_frame', slot: null}]},
    expected: {schemaVersion: 1, surface: 'video', engineId: 'wan-3', mode: 'i2v', prompt: videoPrompt,
      settings: {aspectRatio: '9:16', audio: true, durationSec: 8, resolution: '720p'},
      references: [{kind: 'asset', assetId: firstFrame, role: 'first_frame'}, {kind: 'asset', assetId: lastFrame, role: 'last_frame'}], outputCount: 1},
  },
  {
    name: 'selected voice, WAV output and language', message: 'Prepare the Spanish narration in this voice and format.',
    action: {action: 'voice.prepare', reply: 'A calm Spanish narration in WAV. Review the quote.', script: narration, language: 'english',
      modelId: 'audio-voice-only', outputCount: 1, settings: [{name: 'voiceModel', value: 'seed'}, {name: 'seedAudioVoice', value: 'tracy_es_zh'},
        {name: 'seedAudioOutputFormat', value: 'wav'}, {name: 'seedAudioSampleRate', value: 24000}, {name: 'seedAudioSpeed', value: 1.2}, {name: 'language', value: 'spanish'}]},
    expected: {schemaVersion: 1, surface: 'audio', engineId: 'audio-voice-only', mode: 'voice_only', prompt: '',
      settings: {language: 'spanish', script: narration, seedAudioOutputFormat: 'wav', seedAudioSampleRate: 24000, seedAudioSpeed: 1.2,
        seedAudioVoice: 'tracy_es_zh', voiceModel: 'seed'}, references: [], outputCount: 1},
  },
  {
    name: 'selected Pro music, sixty seconds and tempo', message: 'Prepare a minute of this instrumental at ninety BPM.',
    action: {action: 'music.prepare', reply: 'A one-minute instrumental at ninety BPM. Review the quote.', prompt: musicPrompt, mood: 'dreamy',
      modelId: 'audio-music-only', outputCount: 1, settings: [{name: 'musicModel', value: 'pro'}, {name: 'durationSec', value: 60}, {name: 'musicBpm', value: 90}, {name: 'mood', value: 'epic'}]},
    expected: {schemaVersion: 1, surface: 'audio', engineId: 'audio-music-only', mode: 'music_only', prompt: musicPrompt,
      settings: {durationSec: 60, mood: 'epic', musicBpm: 90, musicModel: 'pro'}, references: [], outputCount: 1},
  },
];

function capability(id: string, surface: AgentPublicGenerationEngine['surface']): AgentPublicGenerationEngine {
  const entry = getFalEngineById(id);
  assert.ok(entry, `The regression fixture requires the real ${id} catalog model.`);
  const allowed = surface === 'image' ? ['t2i', 'i2i'] : ['t2v', 'i2v', 'ref2v', 'fl2v'];
  const modes = entry.modes.filter(mode => allowed.includes(mode.mode));
  return {engine: entry.engine, surface, publicModes: modes.map(mode => mode.mode) as AgentPublicGenerationEngine['publicModes'],
    modeCaps: Object.fromEntries(modes.map(mode => [mode.mode, mode.ui]))};
}

test('selected media survives an interrupted canonical quote transaction and retries without model, quote or charge duplication', async t => {
  const pg = await startDisposablePostgres('studio-media-retry');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDatabaseUrl;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  const userId = '00000000-0000-4000-8000-000000000085';
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz);
    CREATE TABLE studio_sequences(id text PRIMARY KEY);
    CREATE TABLE profiles(id uuid PRIMARY KEY,preferred_currency text);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,mime_type text,status text,duration_sec double precision,metadata jsonb,created_at timestamptz DEFAULT clock_timestamp());
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);`);
  await pg.pool.query("INSERT INTO profiles VALUES ($1,'usd');", [userId]);
  await pg.pool.query("INSERT INTO studio_projects VALUES ('film',$1,'Film',NULL)", [userId]);
  for (const [index, assetId] of [firstFrame, lastFrame].entries()) await pg.pool.query(`INSERT INTO media_assets
    (id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
    VALUES ($1,$2,$3,'image',$4,'image/png',1024,720,1280,'ready','{}')`,
  [`frame-${index}`, assetId, userId, `https://cdn.maxvideoai.com/frame-${index}.png`]);
  for (const migration of ['42_studio_connected_montages.sql', '50_studio_image_conversation.sql', '51_studio_image_model_usage.sql', '52_studio_conversation_runs.sql', '53_studio_media_generation_scope.sql'])
    await pg.pool.query(readFileSync('neon/migrations/' + migration, 'utf8'));
  await addTopup(pg.pool, userId, 10000);
  const actor = {authMethod: 'studio-session' as const, userId, projectId: 'film', clientId: null};
  const catalog = [capability('gpt-image-2', 'image'), capability('wan-3', 'video')];
  const availability = () => ({executable: true as const, reason: 'available' as const});
  const provider = new ProviderHarness(pg.pool);
  const imageFactory: typeof createStudioImageGenerationService = (current, options) => createStudioImageGenerationService(current, {...options,
    prepareDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: availability},
    confirmDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: availability, submitPaidGeneration: provider.submit},
  });
  let active: {input: ImageTurnInput; action: StudioMediaIntent; interrupt: boolean} | null = null;
  const preparedRequests: MediaRequest[] = [];
  const interruptedQuoteIds: string[] = [];
  async function checkpoint(quote: McpGenerationQuote<MediaRequest>, executor: TransactionQueryExecutor, onPrepared?: () => Promise<void>) {
    assert.ok(active);
    const stored = (await executor.query<{draft_json: {media: StudioMediaIntent}}>(
      'SELECT draft_json FROM studio_image_turns WHERE request_id=$1', [active.input.requestId]))[0];
    assert.deepEqual(stored.draft_json.media, active.action, 'The full explicit action is durable before the canonical quote callback.');
    preparedRequests.push(quote.request);
    await onPrepared?.();
    if (active.interrupt) {
      active.interrupt = false;
      interruptedQuoteIds.push(quote.quoteId);
      throw new Error('Controlled interruption after quote and conversation backlink writes');
    }
  }
  const videoFactory: typeof createStudioVideoGenerationService = (current, options) => createStudioVideoGenerationService(current, {...options,
    prepareDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: availability},
    confirmDependencies: {listPublicEngines: async () => catalog, resolveRequestExecutability: availability, submitPaidGeneration: provider.submit},
    onQuotePrepared: (quote, executor) => checkpoint(quote, executor, options.onQuotePrepared ? () => options.onQuotePrepared!(quote, executor) : undefined),
  });
  const audioEnvironment = {FAL_KEY: 'test-only-no-network', GOOGLE_VERTEX_PROJECT_ID: 'test-project', GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: 'test-only-no-network'};
  const pricingExecutor = {query: async (sql: string, values?: unknown[]) => (await pg.pool.query(sql, values)).rows};
  const audioExecutions: {jobId: string; normalized: Awaited<ReturnType<typeof prepareAudioRun>>['normalized']}[] = [];
  const audioFactory: typeof createStudioAudioGenerationService = (current, options) => createStudioAudioGenerationService(current, {...options,
    prepareDependencies: {listCapabilities: () => listAudioCapabilities(audioEnvironment),
      prepareRun: (body, owner) => prepareAudioRun(body, owner, {env: audioEnvironment, pricingPolicy: {loadOverrides: () => loadPricingPolicyOverridesWithExecutor(pricingExecutor)}})},
    confirmDependencies: {listCapabilities: () => listAudioCapabilities(audioEnvironment), executeRun: async run => {
      audioExecutions.push({jobId: run.jobId, normalized: run.prepared.normalized});
      assert.ok(await completeAudioJob(run.jobId, {progress: 100, message: 'Ready', audioUrl: 'https://media.maxvideoai.com/audio/fixture.mp3'}));
    }},
    onQuotePrepared: (quote, executor) => checkpoint(quote, executor, options.onQuotePrepared ? () => options.onQuotePrepared!(quote, executor) : undefined),
  });
  let modelCalls = 0;
  const options: Parameters<typeof createImageConversationService>[1] = {enabled: true, actionsEnabled: true, mediaEnabled: true,
    generationFactory: imageFactory, videoGenerationFactory: videoFactory, audioGenerationFactory: audioFactory,
    createActionResponse: async () => {
      assert.ok(active);
      modelCalls++;
      const {action, ...arguments_} = active.action;
      return {id: 'selected-media-response-' + modelCalls, model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', output_text: '',
        output: [{type: 'function_call', name: action.replace('.', '_'), call_id: 'selected-media-call-' + modelCalls, arguments: JSON.stringify(arguments_)}]};
    },
  };
  for (const [index, fixture] of cases.entries()) await t.test(fixture.name, async () => {
    const input: ImageTurnInput = {requestId: randomUUID(), message: fixture.message, references: fixture.action.action === 'video.prepare' ? [firstFrame, lastFrame] : []};
    active = {input, action: fixture.action, interrupt: true};
    const preparedBefore = preparedRequests.length;
    const executionCount = provider.captures.length + audioExecutions.length;
    await assert.rejects(createImageConversationService(actor, options).submit(input), {code: 'INTERNAL_ERROR'});
    const failed = (await pg.pool.query('SELECT state,draft_json,quote_id FROM studio_image_turns WHERE request_id=$1', [input.requestId])).rows[0];
    assert.equal(failed.state, 'failed');
    assert.equal(failed.quote_id, null, 'The interrupted backlink must roll back with the quote.');
    assert.deepEqual(failed.draft_json, {reply: fixture.action.reply, image: null, media: fixture.action});
    assert.deepEqual(preparedRequests[preparedBefore], fixture.expected);
    assert.equal((await pg.pool.query('SELECT count(*)::int AS count FROM mcp_generation_quotes')).rows[0].count, index);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS count FROM app_receipts WHERE type='charge'")).rows[0].count, index);
    assert.equal(provider.captures.length + audioExecutions.length, executionCount, 'Preparation never spends or invokes a provider.');
    const resumed = createImageConversationService(actor, options);
    const recovered = await resumed.submit(input);
    assert.ok(recovered.quote);
    assert.equal(recovered.state, 'ready');
    assert.deepEqual(recovered.quote.summary, fixture.expected);
    assert.deepEqual(recovered.quote.summary, preparedRequests[preparedBefore]);
    assert.equal(preparedRequests.length, preparedBefore + 2);
    assert.equal(modelCalls, index + 1, 'Retry uses the stored media action without another model call.');
    const quoteId = recovered.quote.quoteId;
    assert.ok(!interruptedQuoteIds.includes(quoteId));
    const repeated = await Promise.all([resumed.submit(input), createImageConversationService(actor, options).submit(input)]);
    for (const saved of repeated) {assert.equal(saved.quote?.quoteId, quoteId); assert.deepEqual(saved.quote?.summary, fixture.expected);}
    assert.equal(preparedRequests.length, preparedBefore + 2, 'A ready turn does not prepare another quote.');
    assert.equal((await pg.pool.query('SELECT count(*)::int AS count FROM mcp_generation_quotes')).rows[0].count, index + 1);
    const receipts = (await pg.pool.query('SELECT action_json,result_json FROM studio_conversation_steps WHERE request_id=$1 ORDER BY created_at', [input.requestId])).rows;
    assert.equal(receipts.length, 2);
    for (const receipt of receipts) assert.deepEqual(receipt.action_json, fixture.action);
    assert.equal(receipts[0].result_json.ok, false);
    assert.equal(receipts[1].result_json.ok, true);
    assert.deepEqual(receipts[1].result_json.data.summary, fixture.expected);
    assert.equal((await pg.pool.query('SELECT count(*)::int AS count FROM studio_conversation_responses WHERE request_id=$1', [input.requestId])).rows[0].count, 1);
    const confirmation = {requestId: input.requestId, quoteId, confirmed: true};
    const accepted = await Promise.all([resumed.confirm(confirmation), createImageConversationService(actor, options).confirm(confirmation)]);
    assert.equal(accepted[0].jobId, accepted[1].jobId);
    await resumed.confirm(confirmation);
    const saved = await createImageConversationService(actor, options).submit(input);
    assert.equal(saved.quote?.quoteId, quoteId);
    assert.deepEqual(saved.quote?.summary, fixture.expected);
    assert.equal(saved.generation?.jobId, accepted[0].jobId);
    assert.equal(provider.captures.length + audioExecutions.length, executionCount + 1, 'Repeated submit and confirmation invoke exactly one provider.');
    assert.deepEqual((await pg.pool.query("SELECT amount_cents FROM app_receipts WHERE type='charge' AND job_id=$1", [accepted[0].jobId])).rows.map(row => row.amount_cents), [recovered.quote.price.amountCents]);
    const quote = (await pg.pool.query('SELECT request_json,state,job_id FROM mcp_generation_quotes WHERE quote_id=$1', [quoteId])).rows[0];
    assert.deepEqual(quote.request_json, fixture.expected);
    assert.equal(quote.state, 'accepted');
    assert.equal(quote.job_id, accepted[0].jobId);
    assert.equal(modelCalls, index + 1);
    assert.equal(preparedRequests.length, preparedBefore + 2);
    if (fixture.expected.surface === 'video') {
      const body = provider.captures.find(capture => capture.quoteId === quoteId)!.body;
      assert.equal(body.mode, 'i2v');
      assert.equal(body.durationSec, 8);
      assert.equal(body.resolution, '720p');
      assert.equal(body.audio, true);
      assert.equal(body.imageUrl, 'https://cdn.maxvideoai.com/frame-0.png');
      assert.equal(body.endImageUrl, 'https://cdn.maxvideoai.com/frame-1.png');
    } else {
      const run = audioExecutions.find(execution => execution.jobId === accepted[0].jobId)!.normalized;
      for (const [name, value] of Object.entries(fixture.expected.settings))
        assert.equal(run[name as keyof typeof run], value, `Provider execution retains selected Audio ${name}.`);
    }
  });
  assert.equal(modelCalls, 3);
  assert.equal(provider.captures.length, 1);
  assert.equal(audioExecutions.length, 2);
  assert.equal((await pg.pool.query('SELECT count(*)::int AS count FROM app_jobs')).rows[0].count, 3);
  assert.equal((await pg.pool.query('SELECT count(*)::int AS count FROM mcp_generation_quotes')).rows[0].count, 3);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS count FROM app_receipts WHERE type='charge'")).rows[0].count, 3);
});
