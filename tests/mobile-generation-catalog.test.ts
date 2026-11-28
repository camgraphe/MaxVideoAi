import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { readMobileModels } from '../frontend/src/server/mobile/catalog';
import { listPublicAgentGenerationEngines } from '../frontend/src/server/agent-api/model-catalog';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { createPrepareGenerationForActorService } from '../frontend/src/server/agent-api/prepare-generation';
import type { GenerationActor } from '../frontend/src/server/agent-api/generation-actor';
import { resolveVideoOperationEngine } from '../frontend/lib/video-operation';

test('every projected native preset passes canonical capability validation before pricing', async () => {
  const errors: string[] = [];
  for (const surface of ['video', 'image'] as const) {
    const catalog = {
      listEngines: async () => getBaseEnginesByCategory(surface),
      surfaceByEngineId: () => surface,
    };
    const models = await readMobileModels({ surface, modelSettings: true, videoOperations: true }, catalog);
    const candidates = await listPublicAgentGenerationEngines(catalog);
    assert.ok(models.length > 1);
    for (const model of models) {
      const candidate = candidates.find((entry) => entry.engine.id === model.id)!;
      for (const control of model.modes) {
        try {
          const request = normalizeGenerationRequest({
            surface,
            engineId: model.id,
            mode: control.mode,
            operation: control.operation,
            outputCount: 1,
            prompt: 'A paper boat on a winding stream.',
            settings: control.defaults,
            references: control.referenceRole
              ? [
                  {
                    kind: 'asset',
                    role: control.referenceRole,
                    assetId: 'ma_0123456789abcdef0123456789abcdef',
                  },
                  ...(control.lastFrame
                    ? [
                        {
                          kind: 'asset' as const,
                          role: 'last_frame' as const,
                          assetId: 'ma_' + '9'.repeat(32),
                        },
                      ]
                    : []),
                ]
              : [],
          });
          const engine = control.operation ? resolveVideoOperationEngine(candidate.engine, 'v2v', control.operation) : candidate.engine;
          validateCanonicalGenerationCapabilities(request, engine === candidate.engine ? candidate : {
            ...candidate, engine, modeCaps: { ...candidate.modeCaps, v2v: engine.modeCaps?.v2v },
          });
          for (const key of ['durationSec', 'resolution', 'aspectRatio', 'audio']) {
            if (control.defaults[key] !== undefined)
              assert.equal(request.settings[key], control.defaults[key]);
          }
        } catch (error) {
          errors.push(model.id + '/' + control.mode + ' ' + String(error) + ' ' + JSON.stringify(error));
        }
      }
    }
  }
  assert.deepEqual(errors, []);
});

test('phone video operations follow the source requirements and duration policy for each model', async () => {
  const models = await readMobileModels(
    { surface: 'video' },
    {
      listEngines: async () => getBaseEnginesByCategory('video'),
      surfaceByEngineId: () => 'video',
    },
  );
  const modes = (id: string) => models.find((model) => model.id === id)?.modes ?? [];
  const lumaEdit = modes('luma-ray-3-2').find((entry) => entry.mode === 'v2v');
  assert.equal(lumaEdit?.sourceVideo?.fieldId, 'video_url');
  assert.equal(lumaEdit?.sourceVideo?.inheritsDuration, true);
  assert.deepEqual(lumaEdit?.durations, []);
  assert.equal(
    modes('luma-ray-3-2').some((entry) => entry.mode === 'extend'),
    false,
  );
  const seedanceExtend = modes('seedance-2-5').find((entry) => entry.mode === 'extend');
  assert.equal(seedanceExtend?.sourceVideo?.fieldId, 'extension_source_videos');
  assert.equal(seedanceExtend?.sourceVideo?.inheritsDuration, false);
  assert.ok(seedanceExtend?.durations.length);
  assert.equal(
    modes('minimax-h3-max').some((entry) => entry.mode === 'v2v'),
    false,
  );
});

test('frame-pair discovery requires two distinct declared roles and opt-in, and an exact quote requires both owned identities', async () => {
  const { visibleMobileMode } = await import('../frontend/lib/mobile-generation-contract');
  const { prepareMobileQuote } = await import('../frontend/src/server/mobile/quotes');
  const catalog = {
    listEngines: async () => getBaseEnginesByCategory('video'),
    surfaceByEngineId: () => 'video' as const,
  };
  const readModels = (filter: Parameters<typeof readMobileModels>[0]) => readMobileModels(filter, catalog);
  const paired = (await readModels({ surface: 'video' })).filter((m) =>
    m.modes.some((c) => c.mode === 'fl2v'),
  );
  assert.ok(paired.length > 1);
  assert.ok(paired.some(model => model.id === 'gemini-omni-flash'));
  assert.equal(visibleMobileMode('fl2v', new URLSearchParams('sourceVideo=1')), false);
  assert.equal(visibleMobileMode('fl2v', new URLSearchParams('framePair=1')), true);
  for (const m of paired) {
    const mode = m.modes.find((c) => c.mode === 'fl2v')!;
    assert.equal(mode.referenceRole, 'first_frame');
    assert.ok(mode.referenceImageField);
    assert.ok(mode.lastFrame?.fieldId);
    assert.notEqual(mode.lastFrame?.fieldId, mode.referenceImageField);
    const draft = {
      surface: 'video',
      engineId: m.id,
      mode: 'fl2v',
      prompt: 'Move from one shot to the next.',
      settings: mode.defaults,
      reference: { role: 'first_frame', assetId: 'ma_' + '1'.repeat(32) },
    };
    await assert.rejects(prepareMobileQuote('owner', draft, { readModels }), /first and last frame/);
    await assert.rejects(
      prepareMobileQuote(
        'owner',
        { ...draft, lastFrame: { role: 'first_frame', assetId: 'ma_' + '2'.repeat(32) } },
        { readModels },
      ),
      /Invalid mobile/,
    );
    await assert.rejects(
      prepareMobileQuote(
        'owner',
        { ...draft, reference: null, lastFrame: { role: 'last_frame', assetId: 'ma_' + '2'.repeat(32) } },
        { readModels },
      ),
      /Choose an image/,
    );
  }
});

test('negotiated field capabilities distinguish audio-only, visual and inherited audio workflows', async () => {
  const catalog = { listEngines: async () => getBaseEnginesByCategory('video'), surfaceByEngineId: () => 'video' as const };
  const legacy = await readMobileModels({ surface:'video' }, catalog);
  const updated = await readMobileModels({ surface:'video',mediaReferences:true }, catalog);
  const mode = (id: string, mode: string) => updated.find(m => m.id === id)!.modes.find(c => c.mode === mode)!;
  assert.ok(legacy.every(m=>m.modes.every(c=>!c.mediaReferenceFields && c.mode !== 'a2v')));
  assert.equal(legacy.find(m=>m.id==='seedance-2-5')!.modes.find(c=>c.mode==='ref2v')?.imageSeries?.min,1);
  const omni = mode('seedance-2-5','ref2v');
  assert.equal(omni.imageSeries?.min,0);
  assert.deepEqual(omni.requiredReferenceFieldIds,['image_urls','video_urls','audio_urls']);
  assert.deepEqual(omni.mediaReferenceFields?.map(f=>[f.kind,f.fieldId,f.max]),[['video','video_urls',10],['audio','audio_urls',10]]);
  assert.deepEqual(mode('seedance-2-0','ref2v').requiredReferenceFieldIds,['image_urls','video_urls']);
  assert.equal(mode('kling-v4','ref2v').imageSeries?.min,0);
  assert.ok(mode('minimax-h3-max','t2v').mediaReferenceFields?.some(f=>f.fieldId==='target_audio_url' && f.min===0 && f.max===1));
  assert.equal(mode('seedance-2-5','t2v').mediaReferenceFields,undefined);
  assert.equal(mode('seedance-2-5','extend').mediaReferenceFields?.some(f=>f.kind==='video'),false);
  const ltx = mode('ltx-2-5-fast','a2v');
  assert.equal(ltx.mediaReferenceFields?.[0].min,1);
  assert.equal(ltx.sourceAudio?.fieldId,'audio_url');
  assert.equal(ltx.optionalFirstFrame?.fieldId,'image_url');
  assert.deepEqual(ltx.durations,[]);
  const { visibleMobileMode } = await import('../frontend/lib/mobile-generation-contract');
  assert.equal(visibleMobileMode('a2v',new URLSearchParams('imageSeries=1')),false);
  assert.equal(visibleMobileMode('a2v',new URLSearchParams('mediaReferences=1')),true);
});

test('ordered native reference bindings cannot enter another quote channel', async () => {
  const actors: GenerationActor[] = [
    { authMethod: 'oauth', userId: 'member', clientId: 'mcp-client', emailVerified: true },
    { authMethod: 'studio-session', userId: 'member', clientId: null, projectId: 'project' },
    { authMethod: 'toolbox-session', userId: 'member', clientId: null },
  ];
  const prepare = createPrepareGenerationForActorService('https://maxvideoai.com/account/connections',
    { clientIp: null, userAgent: null }, { paidGenerationEnabled: () => true });
  const assetId = 'ma_' + '1'.repeat(32);
  const cases = [
    { surface: 'image', engineId: 'seedream-5-0-flash', mode: 'i2i', orderedImageReferences: true,
      references: [{ kind: 'asset', role: 'reference', assetId, slot: 0 }] },
    { surface: 'video', engineId: 'seedance-2-5', mode: 'ref2v', orderedMediaReferences: true,
      references: [{ kind: 'asset', role: 'reference', fieldId: 'reference_audios', mediaKind: 'audio', assetId, slot: 0 }] },
  ];
  for (const actor of actors) {
    for (const input of cases) {
      await assert.rejects(prepare({ ...input, prompt: 'Use this reference.', settings: {} }, actor),
        { code: 'PARAMETER_INVALID', message: 'Native reference bindings require a mobile Create session.' });
    }
  }
});

test('Create keeps selectable legacy models admitted by the generation engine', async () => {
  for (const [surface, legacyId] of [['video', 'wan-2-6'], ['image', 'gpt-image-2']] as const) {
    const deps = {
      listEngines: async () => getBaseEnginesByCategory(surface),
      surfaceByEngineId: () => surface,
    };
    const models = await readMobileModels({ surface, modelSettings: true }, deps);
    const engine = (await listPublicAgentGenerationEngines(deps)).find(entry => entry.engine.id === legacyId);
    assert.ok(engine);
    const model = models.find(entry => entry.id === legacyId);
    assert.ok(model?.modes.length);
    assert.ok(model.modes.every(control => engine.publicModes.includes(control.mode)));
    const disabled = await readMobileModels({ surface, id: legacyId }, { ...deps, isEngineExecutable: () => false });
    assert.deepEqual(disabled, []);
  }
});
