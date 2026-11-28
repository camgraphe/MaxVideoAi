import { updateMobileSetting } from '../frontend/lib/mobile-model-settings';
import { ensureMediaLibrarySchema } from '../frontend/src/lib/schema/media-library-schema';
import { ensureMediaLibraryOrganizationSchema } from '../frontend/src/lib/schema/media-library-organization-schema';
import { ensureAssetSchema } from '../frontend/src/lib/schema/asset-schema';
import { mutateLibraryOrganization } from '../frontend/server/media-library/organization';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb } from '../frontend/src/lib/db';
import {
  createQuoteRepository,
  generationQuoteCodec,
} from '../frontend/src/server/agent-api/quote-repository';
import {
  listPublicAgentGenerationEngines,
  type AgentModelCatalogDeps,
} from '../frontend/src/server/agent-api/model-catalog';
import { readMobileModels } from '../frontend/src/server/mobile/catalog';
import {
  prepareMobileQuote,
  confirmMobileQuote,
  recoverMobileQuote,
} from '../frontend/src/server/mobile/quotes';
import { listMobileJobs, readMobileJob } from '../frontend/src/server/mobile/generations';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { addTopup, ProviderHarness, sharedWebPrice } from './helpers/mcp-paid-e2e-harness';

test(
  'native quotes preserve canonical price, single reservation, account and transport scope',
  { timeout: 90_000 },
  async (t) => {
    const database = await startDisposablePostgres('mobile-generation');
    const oldUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = database.databaseUrl;
    t.after(async () => {
      await getDb().end();
      if (oldUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = oldUrl;
      await database.cleanup();
    });
    await createPaidGenerationTestSchema(database.pool);
    await ensureMediaLibrarySchema();
    await database.pool.query(readFileSync('neon/migrations/106_generation_confirmation_platform.sql', 'utf8'));
    await database.pool.query(readFileSync('neon/migrations/107_mobile_create_quote_scope.sql', 'utf8'));
    const engineId = 'seedance-2-0-mini';
    const registered = getFalEngineById(engineId)!;
    const catalog: AgentModelCatalogDeps = {
      listEngines: async () => [registered.engine],
      surfaceByEngineId: () => 'video',
    };
    const readModels = (filter: Parameters<typeof readMobileModels>[0]) =>
      readMobileModels(filter, catalog);
    const [model] = await readModels({ surface: 'video' });
    assert.equal(model.id, engineId);
    const mode = model.modes.find((control) => control.mode === 't2v')!;
    assert.equal(typeof mode.defaults.durationSec, 'number');
    const owner = 'native-account-1';
    const other = 'native-account-2';
    await addTopup(database.pool, owner, 10_000);
    const provider = new ProviderHarness(database.pool);
    const dependencies = {
      listPublicEngines: () => listPublicAgentGenerationEngines(catalog),
      resolveRequestExecutability: () => ({ executable: true, reason: 'available' }) as const,
    };
    const draft = {
      mode: mode.mode,
      surface: 'video',
      engineId,
      prompt: 'A paper boat floats downstream.',
      settings: { ...mode.defaults, resolution: '720p', durationSec: 5, aspectRatio: '16:9' },
    };
    const options = { readModels, dependencies };
    await assert.rejects(prepareMobileQuote(owner, { ...draft, userId: other }, options), /Invalid mobile/);
    await assert.rejects(
      prepareMobileQuote(owner, { ...draft, settings: { safetyTolerance: 4 } }, options),
      /changed/,
    );
    const quote = await prepareMobileQuote(owner, draft, options);
    assert.deepEqual(quote.price.amountCents, (await sharedWebPrice(quote.summary, 'member')).priceCents);
    assert.equal(quote.topupRequired, false);
    const approval = { quoteId: quote.quoteId, confirmed: true };
    const confirmDependencies = { ...dependencies, submitPaidGeneration: provider.submit };
    await assert.rejects(
      confirmMobileQuote(owner, { ...approval, confirmed: false }, confirmDependencies),
      /Confirm the exact quote/,
    );
    await assert.rejects(confirmMobileQuote(other, approval, confirmDependencies));
    const restored = await recoverMobileQuote(owner, quote.quoteId);
    assert.equal(restored.job, null);
    assert.equal(restored.canConfirm, true);
    assert.equal(restored.terminal, false);
    assert.deepEqual(restored.quote.price, quote.price);
    assert.deepEqual(restored.quote.summary, quote.summary);
    const oldQuote = await prepareMobileQuote(owner, draft, {
      ...options,
      dependencies: { ...dependencies, now: () => new Date(Date.now() - 3_600_000) },
    });
    const expired = await recoverMobileQuote(owner, oldQuote.quoteId);
    assert.equal(expired.canConfirm, false);
    assert.equal(expired.terminal, true);
    assert.equal(expired.job, null);
    for (const scope of [
      { origin: 'oauth' },
      { origin: 'toolbox-session' },
      { origin: 'studio-session', projectId: 'p1' },
    ] as const) {
      assert.equal(
        await createQuoteRepository(generationQuoteCodec, scope).getOwnedQuote({
          userId: owner,
          quoteId: quote.quoteId,
          oauthClientId: null,
        }),
        null,
      );
    }
    assert.equal(provider.calls(quote.quoteId), 0);
    const [first, duplicate] = await Promise.all([
      confirmMobileQuote(owner, approval, confirmDependencies, new Headers({'x-maxvideoai-client-platform':'android'})),
      confirmMobileQuote(owner, approval, confirmDependencies, new Headers({'x-maxvideoai-client-platform':'android'})),
    ]);
    assert.equal(first.jobId, quote.quoteId);
    assert.equal(duplicate.jobId, first.jobId);
    assert.deepEqual((await database.pool.query('SELECT confirmation_platform FROM mcp_generation_quotes WHERE job_id=$1 AND user_id=$2',[first.jobId,owner])).rows, [{confirmation_platform:'android'}]);
    assert.equal(provider.calls(quote.quoteId), 1);
    const { rows: charges } = await database.pool.query(
      'SELECT amount_cents, description FROM app_receipts WHERE type=$1 AND job_id=$2',
      ['charge', first.jobId],
    );
    assert.deepEqual(charges, [{ amount_cents: quote.price.amountCents, description: `Mobile ${registered.engine.label} - 5s` }]);
    assert.equal((await recoverMobileQuote(owner, quote.quoteId)).job?.jobId, first.jobId);
    await assert.rejects(recoverMobileQuote(other, quote.quoteId), /not found/);
    const page = await listMobileJobs(owner, null);
    assert.deepEqual(
      page.items.map((job) => [job.jobId, job.prompt]),
      [[first.jobId, draft.prompt]],
    );
    assert.deepEqual((await listMobileJobs(other, null)).items, []);
    await assert.rejects(readMobileJob(other, first.jobId), /not found/);
    assert.equal(provider.calls(quote.quoteId), 1);

    const imageEngine = getFalEngineById('nano-banana-2')!;
    const imageCatalog: AgentModelCatalogDeps = {
      listEngines: async () => [imageEngine.engine],
      surfaceByEngineId: () => 'image',
    };
    const imageModels = (filter: Parameters<typeof readMobileModels>[0]) =>
      readMobileModels(filter, imageCatalog);
    const [imageModel] = await imageModels({ surface: 'image' });
    const imageMode = imageModel.modes.find((item) => item.mode === 't2i')!;
    const imageDraft = {
      surface: 'image',
      mode: imageMode.mode,
      engineId: imageModel.id,
      prompt: 'A bright sail on the water.',
      settings: imageMode.defaults,
    };
    const imageDependencies = {
      ...dependencies,
      listPublicEngines: () => listPublicAgentGenerationEngines(imageCatalog),
    };
    const quoteImage = () =>
      prepareMobileQuote(owner, imageDraft, {
        readModels: imageModels,
        dependencies: imageDependencies,
      });
    const obsolete = await quoteImage();
    const baseline = await sharedWebPrice(obsolete.summary, 'member');
    await assert.rejects(
      confirmMobileQuote(
        owner,
        { quoteId: obsolete.quoteId, confirmed: true },
        {
          ...imageDependencies,
          submitPaidGeneration: provider.submit,
          priceGeneration: async () => ({ ...baseline, priceCents: baseline.priceCents + 1 }),
        },
      ),
      /no longer current/,
    );
    assert.equal(provider.calls(obsolete.quoteId), 0);
    assert.equal(
      (
        await database.pool.query('SELECT COUNT(*)::int n FROM app_receipts WHERE job_id=$1', [
          obsolete.quoteId,
        ])
      ).rows[0].n,
      0,
    );
    const currentImage = await quoteImage();
    const selected = { quoteId: currentImage.quoteId, confirmed: true };
    const submitImage = () =>
      confirmMobileQuote(owner, selected, {
        ...imageDependencies,
        submitPaidGeneration: provider.submit,
      });
    const [img, again] = await Promise.all([submitImage(), submitImage()]);
    assert.equal(img.surface, 'image');
    assert.equal(img.jobId, again.jobId);
    assert.equal(provider.calls(currentImage.quoteId), 1);
    assert.equal(currentImage.price.amountCents, baseline.priceCents);
    assert.deepEqual(
      (
        await database.pool.query(
          "SELECT amount_cents FROM app_receipts WHERE type='charge' AND job_id=$1",
          [img.jobId],
        )
      ).rows,
      [{ amount_cents: currentImage.price.amountCents }],
    );
    for (const [surface, ids] of [
      ['video', [first.jobId]],
      ['image', [img.jobId]],
      ['audio', []],
    ] as const) {
      assert.deepEqual(
        (await listMobileJobs(owner, null, surface)).items.map((job) => job.jobId),
        ids,
      );
    }
    // A camera-roll upload has an owned media asset, but no provider job or lineage.
    await ensureAssetSchema();
    await ensureMediaLibraryOrganizationSchema();
    await database.pool.query("ALTER TABLE media_assets ALTER COLUMN source SET DEFAULT 'upload'");
    const sourceId = 'ma_' + '9'.repeat(32);
    await database.pool.query(
      `INSERT INTO media_assets
      (id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
      VALUES($1,$1,$2,'video','https://cdn.maxvideoai.com/owned/rehearsal.mp4','video/mp4',240000,1280,720,'ready',$3)`,
      [
        sourceId,
        owner,
        JSON.stringify({
          originalName: 'rehearsal.mp4',
          durationSec: 5,
          mediaFacts: { source: 'probe', durationSec: 5, width: 1280, height: 720 },
        }),
      ],
    );
    const klingEngine = getFalEngineById('kling-o3-standard')!.engine;
    const klingCatalog: AgentModelCatalogDeps = {
      listEngines: async () => [klingEngine], surfaceByEngineId: () => 'video',
    };
    const klingOptions = {
      modelSettings: true,
      readModels: (filter: Parameters<typeof readMobileModels>[0]) => readMobileModels(filter, klingCatalog),
      dependencies: {
        ...dependencies,
        listPublicEngines: () => listPublicAgentGenerationEngines(klingCatalog),
        priceGeneration: async (request) => {
          assert.equal(request.operation, 'kling-edit');
          assert.equal(request.settings.keepAudio, true);
          assert.equal(request.settings.durationSec, undefined);
          assert.equal(request.settings.aspectRatio, undefined);
          return {
            priceCents: 82,
            currency: 'USD',
            membershipTier: 'member' as const,
            pricingSnapshot: { totalCents: 82, currency: 'USD', membershipTier: 'member' },
          };
        },
      } satisfies NonNullable<Parameters<typeof prepareMobileQuote>[2]>,
    };
    const [klingModel] = await klingOptions.readModels({ surface: 'video', modelSettings: true, videoOperations: true });
    const editControl = klingModel.modes.find(control => control.operation === 'kling-edit')!;
    const klingDraft = {
      surface: 'video', engineId: klingModel.id, prompt: 'Make only the lantern blue.',
      mode: editControl.mode, operation: editControl.operation, settings: editControl.defaults,
      reference: { assetId: sourceId, role: 'source' },
    };
    await assert.rejects(prepareMobileQuote(owner, {
      ...klingDraft, settings: { ...editControl.defaults, durationSec: 5 },
    }, klingOptions), { code: 'PARAMETER_INVALID' });
    const klingQuote = await prepareMobileQuote(owner, klingDraft, klingOptions);
    assert.equal(klingQuote.summary.operation, 'kling-edit');
    assert.equal(klingQuote.summary.settings.keepAudio, true);
    assert.equal(klingQuote.summary.settings.durationSec, undefined);
    assert.equal(klingQuote.summary.settings.aspectRatio, undefined);
    assert.equal(klingQuote.summary.references[0].role, 'source');
    assert.deepEqual((await recoverMobileQuote(owner, klingQuote.quoteId)).quote.summary, klingQuote.summary);
    assert.equal(provider.calls(klingQuote.quoteId), 0);
    for (const operation of ['v2v', 'extend'] as const) {
      const controls = model.modes.find((control) => control.mode === operation)!;
      assert.ok(controls.sourceVideo);
      const videoDraft = {
        ...draft,
        mode: operation,
        settings: controls.defaults,
        reference: { assetId: sourceId, role: 'source' },
      };
      await assert.rejects(
        prepareMobileQuote(other, videoDraft, options),
        (error) => (error as { code?: string }).code === 'REFERENCE_NOT_FOUND',
      );
      const videoQuote = await prepareMobileQuote(owner, videoDraft, options);
      let referenceQuoteId = videoQuote.quoteId;
      assert.equal(videoQuote.summary.mode, operation);
      assert.ok(videoQuote.price.amountCents > 0);
      assert.equal((await recoverMobileQuote(owner, videoQuote.quoteId)).canConfirm, true);
      assert.equal(provider.calls(videoQuote.quoteId), 0);
      const reference = { type:'asset' as const, assetId:sourceId, kind:'video' as const };
      // Prepared receipts created by older builds lack alias evidence. They still obey current visibility.
      if (operation === 'extend') {
        const oldRepository = createQuoteRepository(generationQuoteCodec, {origin:'mobile-session'});
        const row = await oldRepository.getOwnedQuote({userId:owner,oauthClientId:null,quoteId:videoQuote.quoteId});
        assert.ok(row);
        const {mobileLibrarySources, ...pricingSnapshot} = row.pricingSnapshot;
        assert.ok(mobileLibrarySources);
        const earlier = await oldRepository.insertPreparedQuote({userId:owner,oauthClientId:null,request:row.request,
          requestHash:row.requestHash,catalogRevision:row.catalogRevision,pricingSnapshot,priceCents:row.priceCents,currency:row.currency,fundingMode:row.fundingMode});
        referenceQuoteId = earlier.quoteId;
      }
      await mutateLibraryOrganization({userId:owner, operation:'trash', references:[reference]});
      await assert.rejects(prepareMobileQuote(owner, videoDraft, options), {code:'REFERENCE_INVALID'});
      await assert.rejects(confirmMobileQuote(owner, {quoteId:referenceQuoteId,confirmed:true}, confirmDependencies), {code:'REFERENCE_INVALID'});
      assert.equal(provider.calls(referenceQuoteId), 0);
      assert.equal((await database.pool.query('SELECT count(*)::int AS n FROM app_receipts WHERE job_id=$1',[referenceQuoteId])).rows[0].n, 0);
      await mutateLibraryOrganization({userId:owner, operation:'restore', references:[reference]});
      const acceptedSource = await confirmMobileQuote(
        owner,
        { quoteId: referenceQuoteId, confirmed: true },
        confirmDependencies,
      );
      assert.ok(acceptedSource.jobId);
      assert.equal(provider.calls(referenceQuoteId), 1);
    }
    const pairEngine = getFalEngineById('veo-3-1-fast')!.engine;
    const pairCatalog = {...catalog, listEngines:async()=>[pairEngine]};
    const readPair = (filter: Parameters<typeof readMobileModels>[0]) => readMobileModels(filter,pairCatalog);
    const pairMode = (await readPair({id:pairEngine.id}))[0].modes.find(control=>control.mode==='fl2v')!;
    const pairOptions = {readModels:readPair, dependencies:{...dependencies,listPublicEngines:()=>listPublicAgentGenerationEngines(pairCatalog)}};
    const firstId='ma_'+'a'.repeat(32), lastId='ma_'+'b'.repeat(32);
    const pairDraft={surface:'video',engineId:pairEngine.id,mode:'fl2v',prompt:'Move from dawn to dusk.',settings:pairMode.defaults,
      reference:{role:'first_frame',assetId:firstId},lastFrame:{role:'last_frame',assetId:lastId}};
    for(const [id,who] of [[firstId,owner],[lastId,other]]) {
      await database.pool.query(`INSERT INTO media_assets (id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
        VALUES($1,$1,$2,'image',$3,'image/jpeg',32768,1280,720,'ready','{}')`, [id,who,'https://cdn.maxvideoai.com/owned/'+id+'.jpg']);
    }
    await assert.rejects(prepareMobileQuote(owner,pairDraft,pairOptions),(e)=> (e as {code:string}).code === 'REFERENCE_NOT_FOUND');
    await database.pool.query('UPDATE media_assets SET user_id=$2 WHERE id=$1',[lastId,owner]);
    const pairQuote=await prepareMobileQuote(owner,pairDraft,pairOptions);
    assert.equal(pairQuote.summary.mode,'fl2v');
    assert.deepEqual(pairQuote.summary.references.map(r=>[r.role, r.kind==='asset'&&r.assetId]),[['first_frame',firstId],['last_frame',lastId]]);
    assert.ok(pairQuote.price.amountCents>0);
    const recovery=await recoverMobileQuote(owner,pairQuote.quoteId);
    assert.ok(recovery.canConfirm);
    assert.equal(provider.calls(pairQuote.quoteId),0);
    const imageToVideo = model.modes.find(control => control.mode === 'i2v')!;
    assert.equal(imageToVideo.optionalLastFrame?.fieldId, 'end_image_url');
    const startOnly = { ...draft, mode: 'i2v', reference: { role: imageToVideo.referenceRole, assetId: firstId } };
    const startQuote = await prepareMobileQuote(owner, startOnly, options);
    assert.deepEqual(startQuote.summary.references.map(r => r.role), [imageToVideo.referenceRole]);
    const withEnd = { ...startOnly, lastFrame: pairDraft.lastFrame };
    await assert.rejects(prepareMobileQuote(owner, { ...withEnd, reference: null }, options), {code: 'REFERENCE_REQUIRED'});
    await assert.rejects(prepareMobileQuote(owner, { ...withEnd, mode: 't2v' }, options), {code: 'REFERENCE_REQUIRED'});
    const endQuote = await prepareMobileQuote(owner, withEnd, options);
    assert.equal(endQuote.summary.mode, 'i2v');
    assert.deepEqual(endQuote.summary.references.map(r => [r.role, r.kind === 'asset' && r.assetId]),
      [[imageToVideo.referenceRole, firstId], ['last_frame', lastId]]);
    await confirmMobileQuote(owner, {quoteId: endQuote.quoteId, confirmed: true}, confirmDependencies);
    const capturedFrames = provider.captures.find(call => call.quoteId === endQuote.quoteId)!.body;
    assert.equal(capturedFrames.imageUrl, 'https://cdn.maxvideoai.com/owned/' + firstId + '.jpg');
    assert.equal(capturedFrames.endImageUrl, 'https://cdn.maxvideoai.com/owned/' + lastId + '.jpg');
    const setMode = (await readPair({id:pairEngine.id}))[0].modes.find(c=>c.mode==='ref2v')!;
    const setDraft={...pairDraft,mode:'ref2v',settings:setMode.defaults,reference:null,lastFrame:undefined,imageReferences:[lastId,firstId]};
    const setQuote=await prepareMobileQuote(owner,setDraft,pairOptions);
    const savedSet=await recoverMobileQuote(owner,setQuote.quoteId);
    assert.deepEqual(savedSet.quote.summary,setQuote.summary);
    assert.deepEqual(setQuote.summary.references.map(r=>[r.slot,r.kind==='asset'&&r.assetId]),[[0,lastId],[1,firstId]]);
    await confirmMobileQuote(owner,{quoteId:setQuote.quoteId,confirmed:true},{...pairOptions.dependencies,submitPaidGeneration:provider.submit});
    const capture=provider.captures.find(c=>c.quoteId===setQuote.quoteId)!;
    assert.deepEqual((capture.body as {referenceImages?:string[]}).referenceImages,[lastId,firstId].map(id=>'https://cdn.maxvideoai.com/owned/'+id+'.jpg'));
    const audioIds = ['d','c'].map(c => 'ma_' + c.repeat(32));
    for (const id of audioIds) {
      await database.pool.query(`INSERT INTO media_assets (id,public_id,user_id,kind,url,mime_type,size_bytes,status,metadata)
        VALUES($1,$1,$2,'audio',$3,'audio/wav',32768,'ready',$4)`, [id,owner,'https://cdn.maxvideoai.com/owned/'+id+'.wav', { durationSec: 4.25 }]);
    }
    function mediaOptions(id: string) {
      const engine = getFalEngineById(id)!.engine;
      const selection = { ...catalog, listEngines: async () => [engine] };
      return {
        readModels: (filter: Parameters<typeof readMobileModels>[0]) => readMobileModels(filter, selection),
        dependencies: { ...dependencies, listPublicEngines: () => listPublicAgentGenerationEngines(selection) },
      };
    }
    const mediaOptions25 = mediaOptions('seedance-2-5');
    const mediaControl = (await mediaOptions25.readModels({id:'seedance-2-5', mediaReferences:true}))[0].modes.find(m=>m.mode==='ref2v')!;
    const mediaDraft = {
      ...draft, engineId:'seedance-2-5', mode:'ref2v',settings:mediaControl.defaults,
      mediaReferences:audioIds.map(assetId=>({fieldId:'audio_urls',kind:'audio',assetId})),
    };
    await assert.rejects(prepareMobileQuote(other, mediaDraft, mediaOptions25), {code:'REFERENCE_NOT_FOUND'});
    await assert.rejects(prepareMobileQuote(owner,{...mediaDraft,mediaReferences:[{fieldId:'audio_urls',kind:'audio',assetId:sourceId}]},mediaOptions25), {code:'REFERENCE_INVALID'});
    await assert.rejects(prepareMobileQuote(owner,{...mediaDraft,mediaReferences:[{...mediaDraft.mediaReferences[0],fieldId:'video_url'}]},mediaOptions25), {code:'REFERENCE_INVALID'});
    await assert.rejects(prepareMobileQuote(owner,{...mediaDraft,mediaReferences:[mediaDraft.mediaReferences[0],mediaDraft.mediaReferences[0]]},mediaOptions25), {code:'REFERENCE_INVALID'});
    await assert.rejects(prepareMobileQuote(owner,{...mediaDraft,engineId},options), {code:'REFERENCE_REQUIRED'});
    await assert.rejects(prepareMobileQuote(owner, { ...mediaDraft, mediaReferences:
      Array.from({length:11}, (_,i)=>({fieldId:'audio_urls',kind:'audio',assetId:'ma_'+i.toString(16).padStart(32,'0')}))
    }, mediaOptions25), {code:'REFERENCE_INVALID'});
    await database.pool.query('UPDATE media_assets SET metadata=$2 WHERE public_id=ANY($1::text[])',[audioIds,{durationSec:18}]);
    await assert.rejects(prepareMobileQuote(owner,mediaDraft,mediaOptions25), {code:'REFERENCE_INVALID'});
    await database.pool.query('UPDATE media_assets SET metadata=$2 WHERE public_id=ANY($1::text[])',[audioIds,{durationSec:4.25}]);
    const videoAlone = {...mediaDraft,mediaReferences:[{fieldId:'video_urls',kind:'video',assetId:sourceId}]};
    await database.pool.query('UPDATE media_assets SET width=320,height=240 WHERE public_id=$1',[sourceId]);
    await assert.rejects(prepareMobileQuote(owner,videoAlone,mediaOptions25), {code:'REFERENCE_INVALID'});
    await database.pool.query('UPDATE media_assets SET width=1280,height=720 WHERE public_id=$1',[sourceId]);
    await database.pool.query('UPDATE media_assets SET metadata=$2 WHERE public_id=$1', [sourceId, {
      originalName:'rehearsal.mp4', durationSec:6.25, mediaFacts:{source:'probe',durationSec:6.25,width:1280,height:720},
    }]);
    const videoOnly = await prepareMobileQuote(owner,videoAlone,mediaOptions25);
    assert.equal(videoOnly.summary.references.length,1);
    const audioOnly = await prepareMobileQuote(owner, mediaDraft, mediaOptions25);
    assert.equal(audioOnly.summary.orderedMediaReferences,true);
    assert.ok(audioOnly.price.amountCents > 0);
    assert.deepEqual(audioOnly.summary.references.map(r=>[r.kind === 'asset' && r.assetId,r.kind === 'asset' && r.fieldId,r.slot]),audioIds.map((id,i)=>[id,'audio_urls',i]));
    const mediaQuote = await prepareMobileQuote(owner,{...mediaDraft,imageReferences:[lastId,firstId],
      mediaReferences:[mediaDraft.mediaReferences[0],{fieldId:'video_urls',kind:'video',assetId:sourceId},mediaDraft.mediaReferences[1]]},mediaOptions25);
    assert.deepEqual((await recoverMobileQuote(owner,mediaQuote.quoteId)).quote.summary,mediaQuote.summary);
    assert.deepEqual(mediaQuote.summary.references.map(r=>[r.kind==='asset'&&r.assetId,r.slot]),[lastId,firstId,audioIds[0],sourceId,audioIds[1]].map((id,i)=>[id,i]));
    const confirmMedia = {...mediaOptions25.dependencies,submitPaidGeneration:provider.submit};
    await mutateLibraryOrganization({userId:owner,operation:'trash',references:[{type:'asset',kind:'audio',assetId:audioIds[0]}]});
    await assert.rejects(confirmMobileQuote(owner,{quoteId:mediaQuote.quoteId,confirmed:true},confirmMedia),{code:'REFERENCE_INVALID'});
    assert.equal(provider.calls(mediaQuote.quoteId),0);
    await mutateLibraryOrganization({userId:owner,operation:'restore',references:[{type:'asset',kind:'audio',assetId:audioIds[0]}]});
    await confirmMobileQuote(owner,{quoteId:mediaQuote.quoteId,confirmed:true},confirmMedia);
    const captured = provider.captures.find(c=>c.quoteId===mediaQuote.quoteId)!.body;
    assert.deepEqual(captured.referenceAudio,audioIds.map(id=>'https://cdn.maxvideoai.com/owned/'+id+'.wav'));
    assert.deepEqual(captured.referenceVideos,['https://cdn.maxvideoai.com/owned/rehearsal.mp4']);
    assert.deepEqual((captured.inputs as {slotId:string;assetId:string}[]).filter(ref=>ref.slotId==='audio_urls').map(ref=>ref.assetId),audioIds);

    const ltxOptions = mediaOptions('ltx-2-5-pro');
    const ltxMode = (await ltxOptions.readModels({id:'ltx-2-5-pro',mediaReferences:true}))[0].modes.find(m=>m.mode==='a2v')!;
    const audioSourceDraft = { ...draft, engineId:'ltx-2-5-pro', mode:'a2v',settings:ltxMode.defaults,
      mediaReferences:[{fieldId:'audio_url',kind:'audio',assetId:audioIds[0]}] };
    await assert.rejects(prepareMobileQuote(owner,{...audioSourceDraft,settings:{...ltxMode.defaults,durationSec:3}},ltxOptions), {code:'PARAMETER_INVALID'});
    const audioSource = await prepareMobileQuote(owner,audioSourceDraft,ltxOptions);
    assert.equal(audioSource.summary.settings.durationSec,5);

    assert.equal(audioSource.summary.references[0].role,'source');
    assert.equal(audioSource.summary.references[0].slot,0);
    await database.pool.query('UPDATE media_assets SET metadata=$2 WHERE public_id=$1',[audioIds[0],{durationSec:6.5}]);
    await assert.rejects(confirmMobileQuote(owner,{quoteId:audioSource.quoteId,confirmed:true},{...ltxOptions.dependencies,submitPaidGeneration:provider.submit}));
    assert.equal(provider.calls(audioSource.quoteId),0);
    await database.pool.query('UPDATE media_assets SET metadata=$2 WHERE public_id=$1',[audioIds[0],{durationSec:4.25}]);
    const withFirstFrame = await prepareMobileQuote(owner,{...audioSourceDraft,reference:{assetId:firstId,role:'first_frame'}},ltxOptions);
    await confirmMobileQuote(owner,{quoteId:withFirstFrame.quoteId,confirmed:true},{...ltxOptions.dependencies,submitPaidGeneration:provider.submit});
    const audioBody=provider.captures.find(c=>c.quoteId===withFirstFrame.quoteId)!.body;
    assert.equal(audioBody.audioUrl,'https://cdn.maxvideoai.com/owned/'+audioIds[0]+'.wav');
    assert.equal(audioBody.imageUrl,'https://cdn.maxvideoai.com/owned/'+firstId+'.jpg');
    const imageSet=imageModel.modes.find(c=>c.mode==='i2i')!;
    const imageSetOptions={readModels:imageModels,dependencies:imageDependencies};
    const edit={...imageDraft,mode:'i2i',settings:imageSet.defaults,imageReferences:[lastId,firstId]};
    await assert.rejects(prepareMobileQuote(owner,{...edit,imageReferences:[sourceId]},imageSetOptions), error=>(error as {code:string}).code==='REFERENCE_INVALID');
    await assert.rejects(prepareMobileQuote(owner,{...edit,imageReferences:[lastId,lastId]},imageSetOptions),error=>(error as {code:string}).code==='REFERENCE_INVALID');
    const imageEditQuote=await prepareMobileQuote(owner,edit,imageSetOptions);
    assert.deepEqual(imageEditQuote.summary.references.map(r=>[r.slot,r.kind==='asset'&&r.assetId]),[[0,lastId],[1,firstId]]);
    assert.deepEqual((await recoverMobileQuote(owner,imageEditQuote.quoteId)).quote.summary,imageEditQuote.summary);

    const rayOptions = { ...mediaOptions('luma-ray-3-2'), modelSettings: true };
    const [ray] = await rayOptions.readModels({ id: 'luma-ray-3-2', modelSettings: true });
    const rayMode = ray.modes.find((item) => item.mode === 't2v')!;
    const hdr = updateMobileSetting(rayMode, rayMode.defaults, 'hdr', true);
    const raySettings = updateMobileSetting(rayMode, hdr, 'exrExport', true);
    const rayQuote = await prepareMobileQuote(owner, {
      ...draft, engineId: ray.id, mode: rayMode.mode, settings: raySettings,
    }, rayOptions);
    assert.equal(rayQuote.summary.settings.hdr, true);
    assert.equal(rayQuote.summary.settings.exrExport, true);
    assert.deepEqual((await recoverMobileQuote(owner, rayQuote.quoteId)).quote.summary, rayQuote.summary);
    await confirmMobileQuote(owner, { quoteId: rayQuote.quoteId, confirmed: true }, {
      ...rayOptions.dependencies, submitPaidGeneration: provider.submit,
    });
    const rayBody = provider.captures.find((capture) => capture.quoteId === rayQuote.quoteId)!.body;
    const rayInputs = rayBody.extraInputValues as Record<string, unknown>;
    assert.equal(rayInputs.hdr, true);
    assert.equal(rayInputs.exr_export, true);
    assert.equal(provider.calls(rayQuote.quoteId), 1);

    const [nano] = await imageModels({ id: imageModel.id, modelSettings: true });
    const nanoMode = nano.modes.find((item) => item.mode === 't2i')!;
    const nanoSettings = updateMobileSetting(nanoMode, nanoMode.defaults, 'enableWebSearch', true);
    const searchQuote = await prepareMobileQuote(owner, { ...imageDraft, settings: nanoSettings }, {
      readModels: imageModels, dependencies: imageDependencies, modelSettings: true,
    });
    assert.equal(searchQuote.summary.settings.enableWebSearch, true);
  },
);
