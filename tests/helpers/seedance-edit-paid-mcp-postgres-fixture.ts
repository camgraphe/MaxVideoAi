import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENV } from '../../frontend/src/lib/env';
import { getDb } from '../../frontend/src/lib/db';
import { getFalEngineById } from '../../frontend/src/config/falEngines';
import { ensureMediaLibrarySchema } from '../../frontend/src/lib/schema/media-library-schema';
import { ensureAssetSchema } from '../../frontend/src/lib/schema/asset-schema';
import { getWalletBalanceCents } from '../../frontend/src/lib/wallet';
import { createPrepareGenerationService, createPrepareGenerationForActorService } from '../../frontend/src/server/agent-api/prepare-generation';
import { createConfirmGenerationService, createConfirmGenerationForActorService } from '../../frontend/src/server/agent-api/confirm-generation';
import { getAgentGenerationStatus } from '../../frontend/src/server/agent-api/generation-status';
import type { AgentPublicGenerationEngine } from '../../frontend/src/server/agent-api/model-catalog';
import { createQuoteRepository, generationQuoteCodec } from '../../frontend/src/server/agent-api/quote-repository';
import { runBytePlusPoll } from '../../frontend/server/byteplus-poll';
import { upsertLegacyJobOutputs } from '../../frontend/server/media-library/job-outputs';
import { promoteCompletedMcpJobOutputs } from '../../frontend/server/media-library/mcp-output-assets';
import { mapOutputRow, mapAssetRow } from '../../frontend/server/media-library-records';
import { ensureReusableAsset } from '../../frontend/server/media-library/assets';
import { continuousInputTariffSelector } from '../../frontend/src/lib/pricing-manual-scenario';
import { collectSellableManualTariffCoverage } from '../../frontend/lib/pricing-audit/manual-tariff-coverage';
import { seedanceInputTariffPriceFromRate } from '../../frontend/server/pricing/seedance-input-tariff';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './disposable-postgres';

/** Real paid backend, SQL and library qualification; only provider HTTP and remote copies are substituted. */
export async function qualifyPaidSeedanceEdit(transport: 'las' | 'modelark') {
    const db = await startDisposablePostgres(`${transport}-paid-mcp`);
    const expectedPrice = transport === 'las' ? 247 : 71;
    const taskPrefix = transport === 'las' ? 'lsd' : 'cgt';
    const previousUrl = process.env.DATABASE_URL;
    const previousNode = process.env.NODE_ENV;
    const previousSandbox = process.env.PRICING_SANDBOX;
    const previousPublicBase = process.env.S3_PUBLIC_BASE_URL;
    const previousFetch = globalThis.fetch;
    const flags = { BYTEPLUS_ARK_ENABLED: 'true', BYTEPLUS_ARK_API_KEY: 'fixture-ark',
      SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true', SEEDANCE_2_5_PROVIDER: 'byteplus_modelark',
      SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY: 'false', SEEDANCE_2_5_BYTEPLUS_MODES: 't2v,i2v,ref2v,v2v,extend',
      SEEDANCE_2_5_EDIT_TRANSPORT: transport, SEEDANCE_2_5_MODELARK_EDIT_ENABLED: transport === 'modelark' ? 'true' : 'false',
      SEEDANCE_2_5_LAS_ENABLED: transport === 'las' ? 'true' : 'false', BYTEPLUS_LAS_API_KEY: transport === 'las' ? 'fixture-las' : '' };
    const previousFlags = new Map<string, unknown>();
    for (const [key, value] of Object.entries(flags)) {
      previousFlags.set(key, (ENV as unknown as Record<string, unknown>)[key]);
      (ENV as unknown as Record<string, unknown>)[key] = value;
    }
    process.env.DATABASE_URL = db.databaseUrl;
    process.env.NODE_ENV = 'development'; process.env.PRICING_SANDBOX = '1';
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.maxvideoai.com';
    const identity = { userId: 'las-owner', clientId: 'las-oauth-client', emailVerified: true, authMethod: 'oauth' as const };
    const assetId = 'ma_11111111111111111111111111111111';
    const imageId = 'ma_22222222222222222222222222222222';
    const audioId = 'ma_33333333333333333333333333333333';
    const sourceUrl = 'https://cdn.maxvideoai.com/owned/source.mp4';
    const entry = getFalEngineById('seedance-2-5')!;
    const candidate: AgentPublicGenerationEngine = { engine: entry.engine, surface: 'video',
      publicModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
      modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) as AgentPublicGenerationEngine['modeCaps'] };
    const catalog = { paidGenerationEnabled: () => true, listPublicEngines: async () => [candidate] };
    const prepare = createPrepareGenerationService('https://maxvideoai.com/account/connections', { clientIp: null, userAgent: null }, catalog);
    const confirm = createConfirmGenerationService('https://maxvideoai.com/account/connections', { clientIp: null, userAgent: null }, catalog);
    const request = { surface: 'video' as const, engineId: 'seedance-2-5', mode: 'v2v' as const,
      prompt: 'Keep the scene, change the light.', settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', audio: false },
      references: [{ kind: 'asset' as const, assetId, role: 'source' as const },
        { kind: 'asset' as const, assetId: imageId, role: 'reference' as const },
        { kind: 'asset' as const, assetId: audioId, role: 'reference' as const }], outputCount: 1 };
    const row = async (id: string) => (await db.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [id])).rows[0];
    const receipts = async (id: string) => (await db.pool.query('SELECT type,amount_cents,currency FROM app_receipts WHERE job_id=$1 ORDER BY type', [id])).rows;
    let posts = 0;
    let copies = 0;
    let providerLookupBlocked = false;
    let providerOutcome: 'succeeded' | 'failed' = 'succeeded';
    let durableSnapshot: Record<string, unknown> | null = null;
    let quoteId: string;
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      assert.ok(url.startsWith(transport === 'las'
        ? 'https://operator.las.ap-southeast-1.bytepluses.com/api/v1/contents/generations/tasks'
        : 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks'), url);
      assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${transport === 'las' ? 'fixture-las' : 'fixture-ark'}`);
      if (init?.method === 'POST') {
        posts++;
        const payload = JSON.parse(String(init.body));
        if (transport === 'modelark') {
          assert.equal(payload.omni_reference_task_type, 'edit');
          assert.equal(payload.ratio, 'adaptive');
          assert.equal(payload.duration, -1);
        }
        assert.equal(payload.content.find((item: { type: string }) => item.type === 'video_url').video_url.url, sourceUrl);
        assert.equal(payload.content.find((item: { type: string }) => item.type === 'image_url').image_url.url, 'https://cdn.maxvideoai.com/owned/reference.png');
        assert.equal(payload.content.find((item: { type: string }) => item.type === 'audio_url').audio_url.url, 'https://cdn.maxvideoai.com/owned/reference.mp3');
        durableSnapshot = (await row(quoteId)).settings_snapshot;
        return new Response(JSON.stringify({ id: `${taskPrefix}-paid-mcp-${posts}`, status: 'queued' }), { status: 202 });
      }
      if (providerLookupBlocked) throw new Error('Provider task expired after durable copy');
      return new Response(JSON.stringify({ id: url.split('/').at(-1), status: providerOutcome, duration: 4,
        resolution: '480p', content: { video_url: 'https://provider.example.test/ephemeral.mp4' }, usage: { total_tokens: 999999 } }));
    }) as typeof fetch;
    try {
      await createPaidGenerationTestSchema(db.pool);
      await db.pool.query(`ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text;
        CREATE TABLE fal_queue_log (job_id text, provider text, provider_job_id text, engine_id text, status text, payload jsonb);
        CREATE TABLE app_pricing_change_events (id uuid PRIMARY KEY, domain text);
        INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ('las-owner','topup',10000,'USD');`);
      for (const migration of ['54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql', '47_generation_poll_state.sql', '53_studio_media_generation_scope.sql']) {
        await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
      }
      await ensureMediaLibrarySchema();
      await ensureAssetSchema();
      const scenario = collectSellableManualTariffCoverage({ modelId: 'seedance-2-5', mode: 'v2v' }).scenarios
        .find(s => s.context.durationSec === 4 && s.context.resolution === '480p' && s.context.aspectRatio === '16:9' && s.context.addons?.audio === false)!;
      assert.ok(scenario);
      const selector = continuousInputTariffSelector(scenario.selector)!;
      const price = transport === 'las' ? seedanceInputTariffPriceFromRate({ ...scenario.context, inputVideoDurationSec: 4 }, 30.7545)
        : { kind: 'unit_components', rounding: 'up', components: [{ id: 'retail', rounding: 'none', flatCents: 62,
          terms: [{ unit: 'input_video_seconds', centsPerUnit: 8.857077007717129, includedUnits: 3.0000520426749935 }] }] };
      await db.pool.query(`INSERT INTO app_customer_tariff_cells(id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
        VALUES ('las-480p-4s',$1,$2,$3,'USD','2026-10-02',1,'11111111-1111-4111-8111-111111111111')`,
      [JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b))), selector, price]);
      await db.pool.query('UPDATE app_customer_tariff_state SET active=true,revision=1');
      await db.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,source,status,metadata)
        VALUES ('source-internal',$1,'las-owner','video',$2,'video/mp4',1000,1280,720,'upload','ready',
          '{"durationSec":4,"originalName":"source.mp4"}')`, [assetId, sourceUrl]);
      await db.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,source,status,metadata)
        VALUES ('image-internal',$1,'las-owner','image','https://cdn.maxvideoai.com/owned/reference.png','image/png',1000,512,512,'upload','ready','{"originalName":"reference.png"}'),
          ('audio-internal',$2,'las-owner','audio','https://cdn.maxvideoai.com/owned/reference.mp3','audio/mpeg',1000,NULL,NULL,'upload','ready','{"durationSec":2,"originalName":"reference.mp3"}')`, [imageId, audioId]);
      const prepared = await prepare(request, identity);
      quoteId = prepared.quoteId;
      assert.equal(prepared.price.amountCents, expectedPrice);
      const quoted = (await db.pool.query('SELECT request_json,pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1', [quoteId])).rows[0];
      if (transport === 'modelark') {
        const sourceFacts = { durationSec: 4, width: 1280, height: 720, billedDurationSec: 4,
          pricingAspectRatio: '16:9', outputDuration: 'source', outputAspectRatio: 'source' };
        assert.deepEqual(quoted.pricing_snapshot.canonicalPricing.meta.seedanceEditSource, sourceFacts);
        assert.deepEqual((prepared as typeof prepared & { sourceVideoOutput?: unknown }).sourceVideoOutput, sourceFacts);
      }
      await db.pool.query(`CREATE FUNCTION reject_quote_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.state='accepted' THEN RAISE EXCEPTION 'injected quote acceptance outage'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER quote_outage BEFORE UPDATE ON mcp_generation_quotes FOR EACH ROW EXECUTE FUNCTION reject_quote_acceptance();`);
      await assert.rejects(confirm({ quoteId, confirmed: true }, identity), /injected quote acceptance outage/);
      await db.pool.query('DROP TRIGGER quote_outage ON mcp_generation_quotes');
      const accepted = await confirm({ quoteId, confirmed: true }, identity);
      assert.equal(posts, 1, JSON.stringify({ reason: 'the real paid continuation must reach the LAS HTTP transport',
        status: accepted.status, message: (await row(quoteId)).message, settings: (await row(quoteId)).settings_snapshot }));
      assert.equal(accepted.paymentStatus, 'paid_wallet');
      assert.equal((await row(quoteId)).provider, 'byteplus_modelark');
      assert.equal((await row(quoteId)).provider_job_id, `${taskPrefix}-paid-mcp-1`);
      assert.equal(durableSnapshot?.byteplusInputVideoDurationSec, 4);
      assert.equal(durableSnapshot?.inputMode, 'v2v');
      assert.equal((durableSnapshot?.core as { resolution?: string })?.resolution, '480p');
      assert.equal(durableSnapshot?.byteplusTransport, transport);
      if (transport === 'modelark') assert.deepEqual(durableSnapshot?.seedanceEditSource, quoted.pricing_snapshot.canonicalPricing.meta.seedanceEditSource);
      assert.deepEqual(durableSnapshot?.settings, quoted.request_json.settings);
      assert.deepEqual(durableSnapshot?.references, quoted.request_json.references);
      assert.deepEqual((await row(quoteId)).pricing_snapshot, quoted.pricing_snapshot.canonicalPricing);
      assert.deepEqual(await receipts(quoteId), [{ type: 'charge', amount_cents: expectedPrice, currency: 'USD' }]);
      assert.equal((await db.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [quoteId])).rows[0].state, 'claimed');
      await confirm({ quoteId, confirmed: true }, identity);
      assert.equal(posts, 1);
      ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false'; ENV.SEEDANCE_2_5_LAS_ENABLED = 'false';
      await db.pool.query(`CREATE FUNCTION reject_output() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'injected output projection outage'; END $$;
        CREATE TRIGGER output_outage BEFORE INSERT ON job_outputs FOR EACH ROW EXECUTE FUNCTION reject_output();
        CREATE FUNCTION defer_quote_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.state='accepted' THEN RETURN OLD; END IF; RETURN NEW; END $$;
        CREATE TRIGGER quote_defer BEFORE UPDATE ON mcp_generation_quotes FOR EACH ROW EXECUTE FUNCTION defer_quote_acceptance();`);
      const poll = async (retryDue = false) => {
        if (retryDue) await db.pool.query("UPDATE app_jobs SET settings_snapshot=jsonb_set(settings_snapshot,'{byteplusStorageCopy,nextRetryAt}',to_jsonb((now()-interval '1 second')::text),false) WHERE job_id=$1",[quoteId]);
        await db.pool.query("UPDATE app_jobs SET updated_at=now()-interval '1 minute' WHERE job_id=$1", [quoteId]);
        await db.pool.query('DELETE FROM generation_poll_state WHERE job_id=$1', [quoteId]);
        return runBytePlusPoll({ jobId: quoteId, deps: {
          ensureFastStartVideoFn: async options => {
            copies++;
            if (transport === 'modelark') {
              const durationSec = (await row(quoteId)).settings_snapshot.seedanceEditSource.durationSec === 4.25 ? 3.958333 : 3.708333;
              options.onVideoMediaFacts?.({ version: 1, source: 'probe', probe: 'ffprobe',
                original: { url: 'https://cdn.maxvideoai.com/owned/output.mp4', sha256: 'a'.repeat(64), sizeBytes: 1000 },
                durationSec, videoDurationSec: durationSec, containerDurationSec: durationSec, audioDurationSec: null });
            }
            return 'https://cdn.maxvideoai.com/owned/output.mp4';
          },
          ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/owned/output.jpg',
          upsertLegacyJobOutputsFn: (output, options) => upsertLegacyJobOutputs(output, { ...options,
            promoteMcpOutputsFn: outputs => promoteCompletedMcpJobOutputs(outputs, {
              executor: { query: async <T,>(sql: string, values?: readonly unknown[]): Promise<T[]> =>
                (await db.pool.query(sql, values as unknown[])).rows },
              ensureReusableAsset: params => ensureReusableAsset(params, {
                copyRemoteMediaFn: async input => ({ url: input.url, thumbUrl: null, mimeType: 'video/mp4',
                  width: 854, height: 480, sizeBytes: 1000 }),
              }),
            }),
          }),
          generateAndPersistJobPreviewVideoFn: async () => null, generateAndPersistJobKeyframesFn: async () => [],
        } });
      };
      await poll();
      assert.notEqual((await row(quoteId)).status, 'completed', 'a failed owned output projection must remain retryable');
      assert.equal((await row(quoteId)).video_url, 'https://cdn.maxvideoai.com/owned/output.mp4', 'retain the copied original while projections retry');
      assert.equal((await db.pool.query('SELECT count(*) FROM job_outputs WHERE job_id=$1', [quoteId])).rows[0].count, '0');
      assert.deepEqual(await receipts(quoteId), [{ type: 'charge', amount_cents: expectedPrice, currency: 'USD' }]);
      await db.pool.query('DROP TRIGGER output_outage ON job_outputs');
      providerLookupBlocked = true;
      await poll(true);
      assert.notEqual((await row(quoteId)).status, 'completed', 'a skipped owned MCP promotion is still pending');
      assert.equal((await db.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [quoteId])).rows[0].state, 'claimed');
      await db.pool.query('DROP TRIGGER quote_defer ON mcp_generation_quotes');
      await db.pool.query(`CREATE TRIGGER promotion_outage BEFORE INSERT ON media_assets FOR EACH ROW EXECUTE FUNCTION reject_output();`);
      await poll(true);
      assert.notEqual((await row(quoteId)).status, 'completed', 'a failed library promotion must remain retryable');
      await db.pool.query('DROP TRIGGER promotion_outage ON media_assets');
      await poll(true);
      assert.equal((await row(quoteId)).status, 'completed');
      assert.equal((await db.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [quoteId])).rows[0].state, 'accepted');
      assert.equal((await row(quoteId)).video_url, 'https://cdn.maxvideoai.com/owned/output.mp4');
      assert.equal(copies, 1, 'recover output projections from the cached durable original');
      assert.equal((await row(quoteId)).cost_breakdown_usd.provider_cost_usd_list, transport === 'las' ? 0.984144 : 6.399994);
      assert.equal((await db.pool.query('SELECT count(*) FROM job_outputs WHERE job_id=$1 AND user_id=$2', [quoteId, identity.userId])).rows[0].count, '1');
      assert.equal((await db.pool.query('SELECT count(*) FROM media_assets WHERE source_job_id=$1 AND user_id=$2', [quoteId, identity.userId])).rows[0].count, '1');
      if (transport === 'modelark') {
        const output = (await db.pool.query('SELECT * FROM job_outputs WHERE job_id=$1', [quoteId])).rows[0];
        const asset = (await db.pool.query('SELECT * FROM media_assets WHERE source_job_id=$1', [quoteId])).rows[0];
        assert.equal(mapOutputRow(output).durationSec, 3.708333, 'Recent media uses measured original timing after projection recovery');
        assert.equal(mapAssetRow(asset).durationSec, 3.708333, 'Saved media uses measured original timing');
        assert.equal(output.metadata.inheritedOutputDurationSec, 4, 'The immutable source quote is separate from measured delivery');
        assert.equal((await row(quoteId)).settings_snapshot.seedanceEditSource.durationSec, 4);
      }
      const recovered = await getAgentGenerationStatus({ jobId: quoteId }, identity);
      assert.equal(recovered.status, 'completed');
      assert.equal(recovered.result?.surface, 'video');
      await confirm({ quoteId, confirmed: true }, identity);
      assert.equal(posts, 1);
      assert.deepEqual(await receipts(quoteId), [{ type: 'charge', amount_cents: expectedPrice, currency: 'USD' }]);
      assert.equal((await getWalletBalanceCents(identity.userId)).balanceCents, 10000 - expectedPrice);
      await assert.rejects(getAgentGenerationStatus({ jobId: quoteId }, { ...identity, userId: 'other-owner' }));
      ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true'; ENV.SEEDANCE_2_5_LAS_ENABLED = 'true';
      const second = await prepare(request, identity);
      quoteId = second.quoteId;
      assert.equal(second.price.amountCents, expectedPrice);
      await confirm({ quoteId, confirmed: true }, identity);
      assert.equal(posts, 2);
      providerLookupBlocked = false; providerOutcome = 'failed';
      ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false'; ENV.SEEDANCE_2_5_LAS_ENABLED = 'false';
      await poll();
      assert.equal((await row(quoteId)).status, 'failed');
      assert.equal((await row(quoteId)).payment_status, 'refunded_wallet');
      assert.equal((await db.pool.query('SELECT state FROM mcp_generation_quotes WHERE quote_id=$1', [quoteId])).rows[0].state, 'failed');
      assert.deepEqual(await receipts(quoteId), [{ type: 'charge', amount_cents: expectedPrice, currency: 'USD' }, { type: 'refund', amount_cents: expectedPrice, currency: 'USD' }]);
      await Promise.all([poll(), poll(), confirm({ quoteId, confirmed: true }, identity)]);
      assert.equal(posts, 2);
      assert.equal((await receipts(quoteId)).length, 2);
      assert.equal((await getWalletBalanceCents(identity.userId)).balanceCents, 10000 - expectedPrice);
      ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true'; ENV.SEEDANCE_2_5_LAS_ENABLED = 'true';
      const studioActor = { userId: identity.userId, clientId: null, authMethod: 'studio-session' as const, projectId: 'studio-las-project' };
      const studioQuotes = createQuoteRepository(generationQuoteCodec, { origin: 'studio-session', projectId: studioActor.projectId });
      const prepareStudio = createPrepareGenerationForActorService('https://maxvideoai.com/account/connections', { clientIp: null, userAgent: null },
        { ...catalog, insertPreparedQuote: studioQuotes.insertPreparedQuote });
      const confirmStudio = createConfirmGenerationForActorService('https://maxvideoai.com/account/connections', { clientIp: null, userAgent: null },
        { ...catalog, lockOwnedQuote: studioQuotes.lockOwnedQuote, markQuoteExpired: studioQuotes.markQuoteExpired,
          claimPreparedQuote: studioQuotes.claimPreparedQuote, markQuoteAccepted: studioQuotes.markQuoteAccepted, markQuoteFailed: studioQuotes.markQuoteFailed });
      const studioQuote = await prepareStudio(request, studioActor);
      quoteId = studioQuote.quoteId;
      assert.equal(studioQuote.price.amountCents, expectedPrice);
      await assert.rejects(confirmStudio({ quoteId, confirmed: true }, { ...studioActor, projectId: 'other-project' }));
      await confirmStudio({ quoteId, confirmed: true }, studioActor);
      assert.equal(posts, 3);
      assert.equal((await row(quoteId)).settings_snapshot.byteplusInputVideoDurationSec, 4);
      assert.equal((await row(quoteId)).settings_snapshot.mode, 'v2v');
      providerOutcome = 'succeeded';
      ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false'; ENV.SEEDANCE_2_5_LAS_ENABLED = 'false';
      await poll();
      assert.equal((await row(quoteId)).status, 'completed');
      assert.deepEqual(await receipts(quoteId), [{ type: 'charge', amount_cents: expectedPrice, currency: 'USD' }]);
      const studioStored = (await db.pool.query('SELECT auth_origin,studio_project_id,pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1', [quoteId])).rows[0];
      assert.equal(studioStored.auth_origin, 'studio-session');
      assert.equal(studioStored.studio_project_id, studioActor.projectId);
      assert.equal(typeof studioStored.pricing_snapshot.studioReferenceFingerprint, 'string');
      await confirmStudio({ quoteId, confirmed: true }, studioActor);
      assert.equal(posts, 3);
      assert.equal((await getWalletBalanceCents(identity.userId)).balanceCents, 10000 - 2 * expectedPrice);
      if (transport === 'modelark') {
        ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
        const fractionalSelector = { ...selector, durationSec: '5' };
        const fractionalPrice = { kind: 'unit_components', rounding: 'up', components: [{ id: 'retail', rounding: 'none',
          flatCents: 81.00046838407494, terms: [{ unit: 'input_video_seconds', centsPerUnit: 9, includedUnits: 4.0000520426749935 }] }] };
        await db.pool.query(`INSERT INTO app_customer_tariff_cells(id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
          VALUES ('modelark-480p-5s',$1,$2,$3,'USD','2026-10-02',1,'11111111-1111-4111-8111-111111111111')`,
          [JSON.stringify(Object.entries(fractionalSelector).sort(([a], [b]) => a.localeCompare(b))), fractionalSelector, fractionalPrice]);
        await db.pool.query(`UPDATE media_assets SET metadata=metadata || '{"durationSec":4.25}'::jsonb WHERE public_id=$1`, [assetId]);
        const fractional = await prepare(request, identity);
        assert.equal(fractional.price.amountCents, 84, 'price the literal 5s class, with precise 4.25s input usage');
        assert.equal(fractional.sourceVideoOutput?.durationSec, 4.25);
        assert.equal(fractional.sourceVideoOutput?.billedDurationSec, 5);
        assert.equal(fractional.sourceVideoOutput?.pricingAspectRatio, '16:9');
        await db.pool.query(`UPDATE media_assets SET metadata=metadata || '{"durationSec":4.251}'::jsonb WHERE public_id=$1`, [assetId]);
        await assert.rejects(confirm({ quoteId: fractional.quoteId, confirmed: true }, identity), /quote.*no longer current/i);
        assert.equal(posts, 3);
        assert.deepEqual(await receipts(fractional.quoteId), []);
        await db.pool.query(`UPDATE media_assets SET metadata=metadata || '{"durationSec":4.25}'::jsonb WHERE public_id=$1`, [assetId]);
        const completedFractional = await prepare(request, identity);
        quoteId = completedFractional.quoteId;
        providerLookupBlocked = false;
        await confirm({ quoteId, confirmed: true }, identity);
        await poll();
        assert.equal((await row(quoteId)).status, 'completed');
        const output = (await db.pool.query('SELECT * FROM job_outputs WHERE job_id=$1', [quoteId])).rows[0];
        const asset = (await db.pool.query('SELECT * FROM media_assets WHERE source_job_id=$1', [quoteId])).rows[0];
        assert.equal(output.metadata.inheritedOutputDurationSec, 4.25, 'The paid completion persists fractional inherited timing');
        assert.equal(Number(output.duration_sec), 4, 'The legacy integer projection remains compatible');
        assert.equal(mapOutputRow(output).durationSec, 3.958333);
        await upsertLegacyJobOutputs({ ...(await row(quoteId)), duration_sec: 5 }, { promoteMcpOutputsFn: async () => ({ promoted: 0, failed: 0 }) });
        const reread = (await db.pool.query('SELECT * FROM job_outputs WHERE job_id=$1', [quoteId])).rows[0];
        assert.equal(mapOutputRow(reread).durationSec, 3.958333, 'A subsequent legacy synchronization cannot overwrite measured timing');
        assert.equal(mapAssetRow(asset).durationSec, 3.958333, 'The saved Library asset preserves measured timing');
        await db.pool.query(`UPDATE media_assets SET metadata=metadata || '{"durationSec":3.99}'::jsonb WHERE public_id=$1`, [assetId]);
        await assert.rejects(prepare(request, identity), /cannot be priced|settings cannot be priced|reference duration/i);
        assert.equal(posts, 4);
        assert.equal((await getWalletBalanceCents(identity.userId)).balanceCents, 10000 - 2 * expectedPrice - 84);
      }
    } finally {
      globalThis.fetch = previousFetch;
      await getDb().end().catch(() => undefined);
      for (const [key, value] of previousFlags) (ENV as unknown as Record<string, unknown>)[key] = value;
      if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
      if (previousNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNode;
      if (previousSandbox === undefined) delete process.env.PRICING_SANDBOX; else process.env.PRICING_SANDBOX = previousSandbox;
      if (previousPublicBase === undefined) delete process.env.S3_PUBLIC_BASE_URL; else process.env.S3_PUBLIC_BASE_URL = previousPublicBase;
      await db.cleanup();
    }
}
