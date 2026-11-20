import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { coerceFormState, getWorkspaceCreateMode } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { preparePickerScenario } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-picker-scenario';
import { buildWorkspacePickerOptions } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-picker';
import { getVideoWorkflowSourceField } from '../frontend/lib/video-source-workflow';
import type { WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';
import { serializeWorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-setups';
import { parseEditorKeyframeSlots } from '../frontend/app/(core)/(workspace)/app/_lib/luma-ray32-keyframes';
const engines = getBaseEnginesByCategory('video');
const engine = (id: string) => engines.find(e => e.id === id)!;
function setup(mode: 't2v'|'v2v'|'extend'): WorkspaceModelSetup {
  return {form:coerceFormState(engine('wan-3-prime'),mode,null),prompt:'Keep authored prompt',negativePrompt:'Keep negative',inputAssets:{},klingElements:[],multiPromptEnabled:false,
    multiPromptScenes:[{id:'scene',prompt:'Keep scene',duration:5}],shotType:'customize',voiceIdsInput:'',cfgScale:null};
}
for (const mode of ['v2v','extend'] as const) test(`${mode}: manual switching prepares real Create and never converts source video to references`,()=>{
 const current=setup(mode);
 const sourceField=getVideoWorkflowSourceField(engine(current.form.engineId).inputSchema,mode)!;
 current.inputAssets[sourceField.id]=[{id:'source',assetId:'source',fieldId:sourceField.id,kind:'video',name:'Source',type:'video/mp4',size:1024,status:'ready',durationSec:8,url:'https://owned.test/source.mp4',previewUrl:'https://owned.test/source.mp4'}];
 const before=structuredClone(current);
 for(const id of ['wan-3','flux-3-max','kling-o3-4k','kling-v4','luma-ray-3-2']) {
  const candidate=preparePickerScenario({current,engine:engine(id),currentEngine:engine(current.form.engineId),locale:'en'});
  assert.equal(candidate.applicable,true,`${id}: ${JSON.stringify(candidate.blockingReasons)}`);
  assert.equal(candidate.workflow.activeManualMode,null,id);
  assert.equal(candidate.workflow.submissionMode,'t2v',id);
  assert.equal(candidate.setup.form.operation,undefined,id);
  assert.ok(!Object.values(candidate.setup.inputAssets).flat().some(a=>a?.assetId==='source'),id);
  assert.ok(candidate.removedReferences.some(ref=>ref.asset.assetId==='source'),id);
  assert.equal(candidate.setup.prompt,current.prompt);assert.deepEqual(candidate.setup.multiPromptScenes,current.multiPromptScenes);
 }
 assert.deepEqual(current,before);
});
test('compatible opening image stays active and is quoted in inferred Create',()=>{
 const current=setup('v2v');
 current.inputAssets.start_image_url=[{id:'frame',assetId:'frame',fieldId:'start_image_url',kind:'image',name:'Frame',type:'image/png',size:100,status:'ready',url:'https://owned.test/frame.png',previewUrl:'https://owned.test/frame.png'}];
 for(const overrides of [{},{durationSec:10}]){
  const candidate=preparePickerScenario({current,engine:engine('wan-3'),currentEngine:engine(current.form.engineId),locale:'en',overrides});
  assert.equal(candidate.workflow.submissionMode,'i2v');
  assert.equal(candidate.setup.inputAssets.start_image_url?.[0]?.assetId,'frame');
  assert.ok(!candidate.removedReferences.some(ref=>ref.asset.assetId==='frame'),'a kept inactive compatible frame is not reported as retired');
 }
});
test('runtime admission is checked on the prepared Create mode, without inventing absent Create',()=>{
 const current=setup('v2v');
 const target={...engine('wan-3'),modeAvailability:{v2v:{available:false}}};
 const rows=buildWorkspacePickerOptions({current,engines:[engine(current.form.engineId),target],locale:'en',memberTier:'Member'});
 assert.equal(rows[target.id].disabledReason,undefined);assert.equal(rows[target.id].request?.mode,'t2v');
 for(const closed of [
  {...target,modes:['v2v'] as typeof target.modes},
  {...target,modeAvailability:Object.fromEntries(target.modes.map(mode=>[mode,{available:false}]))},
 ]){
  for(const overrides of [{},{iterations:2}]){
   const prepared=preparePickerScenario({current,engine:closed,currentEngine:engine(current.form.engineId),locale:'en',overrides});
   assert.equal(prepared.applicable,false,'edited options cannot bypass Create admission');
   const option=buildWorkspacePickerOptions({current,engines:[engine(current.form.engineId),closed],locale:'en',memberTier:'Member',overrides})[closed.id];
   assert.ok(option.disabledReason);assert.equal(option.request,null);
  }
 }
});

test('Retake is another explicit source workflow, and its clip never becomes a new model Create reference',()=>{
 const current=setup('t2v');const sourceEngine=engine('ltx-2-3');
 current.form=coerceFormState(sourceEngine,'retake',null);
 current.inputAssets.video_url=[{id:'retake',assetId:'retake',fieldId:'video_url',kind:'video',name:'Retake clip',type:'video/mp4',size:1234,status:'ready',url:'https://owned.test/retake.mp4',previewUrl:'https://owned.test/retake.mp4',durationSec:8}];
 const prepared=preparePickerScenario({current,engine:engine('wan-3'),currentEngine:sourceEngine,locale:'en'});
 assert.equal(prepared.workflow.submissionMode,'t2v');
 assert.ok(!Object.values(prepared.setup.inputAssets).flat().some(a=>a?.assetId==='retake'));
});

const readyReference = (id: string, fieldId: string, kind: 'image' | 'video' | 'audio') => ({
  id, fieldId, kind, name: id, size: 4096, status: 'ready' as const,
  url: `https://owned.test/${id}`, previewUrl: `https://owned.test/${id}-preview`,
  type: `${kind}/${kind === 'image' ? 'jpeg' : kind === 'audio' ? 'wav' : 'mp4'}`,
  width: 720, height: 1280, ...(kind !== 'image' ? { durationSec: 4 } : {}),
});
const createDraft = (): WorkspaceModelSetup => ({
  ...setup('t2v'), form: { ...coerceFormState(engine('seedance-2-5'),'t2v',null),
    durationSec: 8, durationOption: 8, resolution: '1080p', aspectRatio: '9:16', audio: false },
});

test('a reference clip in Create cannot select the target model’s Modify workflow', () => {
  const current = createDraft();
  current.inputAssets.video_urls = [readyReference('motion', 'video_urls', 'video')];
  const target = engine('wan-3-prime');
  const candidate = preparePickerScenario({ current, engine: target, currentEngine: engine('seedance-2-5'), locale:'fr' });
  assert.equal(candidate.workflow.activeManualMode, null);
  assert.equal(candidate.workflow.submissionMode, 't2v');
  assert.deepEqual(candidate.setup.inputAssets, {});
  const row = buildWorkspacePickerOptions({ current, engines: [engine('seedance-2-5'), target], locale: 'fr', memberTier: 'Member' })[target.id];
  assert.equal(row.request?.mode, 't2v');
  assert.equal(row.request?.inputs?.length, 0);
});

test('a draft restores compatible parked inputs around a model round trip and retains new text', () => {
  const current = createDraft();
  current.inputAssets = {
    image_urls: [readyReference('person', 'image_urls', 'image')],
    video_urls: [readyReference('motion', 'video_urls', 'video')],
    audio_urls: [readyReference('rhythm', 'audio_urls', 'audio')],
  };
  const seedance = engine('seedance-2-5'), wan = engine('wan-3-prime');
  const onWan = preparePickerScenario({ current, engine: wan, currentEngine: seedance, locale: 'fr' });
  assert.deepEqual(onWan.setup.inputAssets, {});
  assert.equal(onWan.setup.parkedCreateReferences?.length, 3);
  const onSeedance = preparePickerScenario({
    current: { ...onWan.setup, prompt: 'The latest edit' },
    engine: seedance, currentEngine: wan, locale: 'fr',
  });
  assert.equal(onSeedance.setup.prompt, 'The latest edit');
  assert.equal(onSeedance.workflow.submissionMode, 'ref2v');
  assert.deepEqual(onSeedance.setup.inputAssets, current.inputAssets);
  assert.equal(onSeedance.setup.parkedCreateReferences?.length ?? 0, 0);

  delete onSeedance.setup.inputAssets.video_urls;
  const leftAgain = preparePickerScenario({ current: onSeedance.setup, engine: wan, currentEngine: seedance, locale: 'fr' });
  const backAgain = preparePickerScenario({ current: leftAgain.setup, engine: seedance, currentEngine: wan, locale: 'fr' });
  assert.equal(backAgain.setup.inputAssets.video_urls, undefined, 'a deliberate removal survives future switches');
  assert.equal(backAgain.setup.inputAssets.image_urls[0]?.id, 'person');
});

test('target defaults are effective while unavailable values remain the draft preference', () => {
  const current = createDraft();
  const seedance = engine('seedance-2-5'), base = engine('wan-3-prime');
  const limited = { ...base, modeCaps: { ...base.modeCaps, t2v: {
    ...base.modeCaps!.t2v!, duration: { options: [5, 10], default: 5 }, resolution: ['720p'], aspectRatio: ['16:9'],
  } } };
  const adapted = preparePickerScenario({ current, engine: limited, currentEngine: seedance, locale: 'en' }).setup;
  assert.equal(adapted.form.durationSec, 5);
  assert.equal(adapted.form.resolution, '720p');
  assert.equal(adapted.form.aspectRatio, '16:9');
  assert.equal(adapted.form.audio, true);
  const restored = preparePickerScenario({ current: adapted, engine: seedance, currentEngine: limited, locale: 'en' }).setup;
  assert.equal(restored.form.durationSec, 8);
  assert.equal(restored.form.resolution, '1080p');
  assert.equal(restored.form.aspectRatio, '9:16');
  const edited = preparePickerScenario({ current: adapted, engine: limited, currentEngine: limited, locale: 'en', overrides: { durationSec: 10 } }).setup;
  const changed = preparePickerScenario({ current: edited, engine: seedance, currentEngine: limited, locale: 'en' }).setup;
  assert.equal(changed.form.durationSec, 10);
  assert.equal(changed.form.resolution, '1080p');
});

test('the available size and role determine whether a ready input can be carried to another model', () => {
  const current = createDraft();
  const portrait = readyReference('portrait', 'image_urls', 'image');
  current.inputAssets.image_urls = [portrait];
  const seedance = engine('seedance-2-5'), base = engine('seedance-2-5-flash');
  const flash = { ...base, inputSchema: { ...base.inputSchema!, constraints: { ...base.inputSchema!.constraints, minImageSidePx: 900 } } };
  const adapted = preparePickerScenario({ current, engine: flash, currentEngine: seedance, locale: 'en' });
  assert.equal(adapted.setup.inputAssets.image_urls, undefined);
  assert.equal(adapted.setup.parkedCreateReferences?.[0].asset.id, 'portrait');
  const restored = preparePickerScenario({ current: adapted.setup, engine: seedance, currentEngine: flash, locale: 'en' });
  assert.equal(restored.setup.inputAssets.image_urls[0]?.id, 'portrait');
});

test('an active attachment keeps its slot when an earlier model has parked media for the same role', () => {
  const seedance = engine('seedance-2-5'), base = engine('seedance-2-5-flash');
  const current = createDraft();
  const kept = readyReference('kept', 'image_urls', 'image');
  const second = readyReference('second', 'image_urls', 'image');
  current.inputAssets.image_urls = [kept, second];
  const flash = { ...base, inputSchema: { ...base.inputSchema!, optional: base.inputSchema?.optional?.map(field =>
    field.id === 'image_urls' ? { ...field, maxCount: 1 } : field) } };
  const limited = preparePickerScenario({ current, engine: flash, currentEngine: seedance, locale: 'en' }).setup;
  assert.equal(limited.inputAssets.image_urls[0]?.id, 'kept');
  assert.equal(limited.parkedCreateReferences?.[0].asset.id, 'second');
  limited.inputAssets.image_urls = [readyReference('latest', 'image_urls', 'image')];
  const restored = preparePickerScenario({ current: limited, engine: seedance, currentEngine: flash, locale: 'en' }).setup;
  assert.deepEqual(restored.inputAssets.image_urls.map(asset => asset?.id), ['latest', 'second']);
  assert.equal(restored.parkedCreateReferences?.length ?? 0, 0);
});

test('the public model catalog keeps Create when selecting another model with a reference pack or frame pair', () => {
  const source = engine('seedance-2-5');
  const packs = [
    { image_urls: [readyReference('portrait', 'image_urls', 'image')], video_urls: [readyReference('motion', 'video_urls', 'video')], audio_urls: [readyReference('rhythm', 'audio_urls', 'audio')] },
    { image_url: [readyReference('first', 'image_url', 'image')], end_image_url: [readyReference('last', 'end_image_url', 'image')] },
  ];
  for (const inputAssets of packs) {
    for (const target of engines.filter(value => value.id !== source.id && value.availability !== 'paused' && getWorkspaceCreateMode(value))) {
      const result = preparePickerScenario({ current: { ...createDraft(), inputAssets }, engine: target, currentEngine: source, locale: 'en' });
      assert.ok(result.applicable, `${target.id}: ${JSON.stringify(result.blockingReasons)}`);
      assert.ok(['t2v', 'i2v', 'fl2v', 'ref2v', 'r2v', 'a2v'].includes(result.workflow.submissionMode), target.id);
      const back = preparePickerScenario({ current: result.setup, engine: source, currentEngine: target, locale: 'en' });
      assert.deepEqual(back.setup.inputAssets, inputAssets, target.id);
    }
  }
});

test('a parked frame returns when the current frame cannot fill that slot on the target model', () => {
  const seedance = engine('seedance-2-5'), veo = engine('veo-3-1');
  const current = createDraft();
  const webp = { ...readyReference('cover.webp', 'image_url', 'image'), type: 'image/webp', width: 720, height: 720 };
  current.inputAssets.image_url = [webp];
  const onVeo = preparePickerScenario({ current, engine: veo, currentEngine: seedance, locale: 'en' }).setup;
  assert.equal(onVeo.parkedCreateReferences?.[0].asset.id, 'cover.webp');
  const small = { ...readyReference('small.jpg', 'image_url', 'image'), width: 256, height: 256 };
  onVeo.inputAssets.image_url = [small];
  const back = preparePickerScenario({ current: onVeo, engine: seedance, currentEngine: veo, locale: 'en' });
  assert.equal(back.setup.inputAssets.image_url?.[0]?.id, 'cover.webp');
  assert.equal(back.setup.parkedCreateReferences?.[0].asset.id, 'small.jpg');
});

test('an exact image reference slot can infer the target Create reference mode instead of image-to-video', () => {
  const current = createDraft();
  current.inputAssets.image_urls = [readyReference('portrait.jpg', 'image_urls', 'image')];
  const source = engine('seedance-2-5'), target = engine('veo-3-1');
  const result = preparePickerScenario({ current, engine: target, currentEngine: source, locale: 'en' });
  assert.equal(result.workflow.submissionMode, 'ref2v');
  assert.equal(result.setup.inputAssets.image_urls?.[0]?.id, 'portrait.jpg');
  const row = buildWorkspacePickerOptions({ current, engines: [source, target], locale: 'en', memberTier: 'Member' })[target.id];
  assert.equal(row.request?.mode, 'ref2v');
  assert.equal(row.request?.inputs?.length, 1);
});

test('a model switch retains equivalent 4K and 2160p resolution choices', () => {
  const seedance = engine('seedance-2-5'), ltx = engine('ltx-2-5-fast');
  const draft = createDraft();
  draft.form.resolution = '4k';
  const adapted = preparePickerScenario({ current: draft, engine: ltx, currentEngine: seedance, locale: 'en' }).setup;
  assert.equal(adapted.form.resolution.toLowerCase(), '2160p');
  const back = preparePickerScenario({ current: adapted, engine: seedance, currentEngine: ltx, locale: 'en' }).setup;
  assert.equal(back.form.resolution.toLowerCase(), '4k');
});

test('when two Create roles cannot coexist on Wan, the draft still uses a Create mode', () => {
  const source = engine('minimax-h3-max'), wan = engine('wan-3-prime');
  const still = readyReference('end.jpg', 'end_image_url', 'image');
  const motion = readyReference('motion.mp4', 'reference_video_urls', 'video');
  const current = {
    ...createDraft(), form: coerceFormState(source, 'ref2v', null),
    inputAssets: { end_image_url: [still], reference_video_urls: [motion] },
  };
  const result = preparePickerScenario({ current, engine: wan, currentEngine: source, locale: 'en' });
  assert.ok(result.applicable);
  assert.equal(result.workflow.submissionMode, 'i2v');
  assert.equal(result.setup.inputAssets.end_image_url?.[0]?.id, 'end.jpg');
  assert.equal(result.setup.parkedCreateReferences?.[0].asset.id, 'motion.mp4');
});

test('combined input duration keeps inputs within the target limit before quoting', () => {
  const source = engine('seedance-2-5'), target = engine('seedance-2-0');
  const current = createDraft();
  const clips = [0, 1, 2].map(index => ({
    ...readyReference(`clip-${index}.mp4`, 'video_urls', 'video'), durationSec: 8,
  }));
  const tracks = [0, 1].map(index => ({
    ...readyReference(`track-${index}.wav`, 'audio_urls', 'audio'), durationSec: 9,
  }));
  current.inputAssets = { video_urls: clips, audio_urls: tracks };
  const limited = preparePickerScenario({ current, currentEngine: source, engine: target, locale: 'en' });
  assert.deepEqual(limited.setup.inputAssets, { video_urls: [clips[0]], audio_urls: [tracks[0]] });
  assert.equal(limited.setup.parkedCreateReferences?.length, 3);
  const picker = buildWorkspacePickerOptions({ current, engines: [source, target], locale: 'en', memberTier: 'Member' });
  assert.equal(picker[target.id].request?.inputs?.length, 2);
  const back = preparePickerScenario({ current: limited.setup, currentEngine: target, engine: source, locale: 'en' });
  assert.deepEqual(back.setup.inputAssets, current.inputAssets);

  const repeated = preparePickerScenario({
    current: { ...current, inputAssets: { video_urls: [clips[0], { ...clips[0], id: 'duplicate' }] } },
    currentEngine: source, engine: target, locale: 'en',
  });
  assert.equal(repeated.setup.inputAssets.video_urls?.filter(Boolean).length, 2, 'server counts repeated URLs once for Seedance Create');
});

test('timed keyframes stay together through draft persistence and never become ordinary still references', () => {
  const flux = engine('flux-3-max'), wan = engine('wan-3-prime');
  const field = 'reference_image_urls';
  const current = {
    ...createDraft(), form: coerceFormState(flux, 'ref2v', null),
    inputAssets: { [field]: [null, readyReference('opening.jpg', field, 'image'), null, readyReference('closing.jpg', field, 'image')] },
  };
  current.form.extraInputValues = { keyframe_indexes: '0, 96', keyframe_slot_indexes: '1:0, 3:96' };
  const away = preparePickerScenario({ current, currentEngine: flux, engine: wan, locale: 'en' });
  assert.equal(away.workflow.submissionMode, 't2v');
  assert.equal(away.setup.inputAssets[field], undefined);
  assert.equal(away.setup.parkedCreateReferences?.length, 2);
  const persisted = serializeWorkspaceModelSetup(away.setup);
  assert.ok(persisted.ok);
  const back = preparePickerScenario({ current: persisted.setup, currentEngine: wan, engine: flux, locale: 'en' });
  assert.equal(back.workflow.submissionMode, 'ref2v');
  assert.deepEqual(back.setup.inputAssets[field], current.inputAssets[field]);
  assert.equal(back.setup.form.extraInputValues.keyframe_indexes, '0, 96');
  for (const slotValue of [back.setup.form.extraInputValues.keyframe_slot_indexes, undefined]) {
    const slots = parseEditorKeyframeSlots(slotValue, '0, 96', back.setup.inputAssets[field], 10, 120);
    assert.deepEqual(slots.map(slot => slot.assetSlot), [0, 1, 2, 3]);
    assert.equal(slots[1]?.frameIndex, 0);
    assert.equal(slots[3]?.frameIndex, 96);
  }
  assert.ok(!back.blockingReasons.length);
});

test('a Kling 4 video subject can return to Create without driving Kling Omni into Modify', () => {
  const kling4 = engine('kling-v4'), omni = engine('kling-o3-pro');
  const image = { ...readyReference('space.jpg', 'image_urls', 'image'), assetId: 'owned-space' };
  const video = { ...readyReference('subject.mp4', 'klingElements.video', 'video'), assetId: 'owned-subject' };
  const element = { id: 'person', frontal: null, references: [], video };
  const current = {
    ...createDraft(), form: coerceFormState(kling4, 'ref2v', null),
    inputAssets: { image_urls: [image] }, klingElements: [element],
  };
  const onOmni = preparePickerScenario({ current, currentEngine: kling4, engine: omni, locale: 'en' });
  assert.ok(onOmni.applicable);
  assert.equal(onOmni.workflow.submissionMode, 'ref2v');
  assert.deepEqual(onOmni.setup.klingElements, []);
  assert.equal(onOmni.setup.inputAssets.image_urls?.[0]?.id, image.id);

  const persisted = serializeWorkspaceModelSetup(onOmni.setup);
  assert.ok(persisted.ok);
  const back = preparePickerScenario({ current: persisted.setup, currentEngine: omni, engine: kling4, locale: 'en' });
  assert.ok(back.applicable);
  assert.equal(back.workflow.submissionMode, 'ref2v');
  assert.equal(back.setup.klingElements[0]?.id, element.id);
  assert.equal(back.setup.klingElements[0]?.video?.assetId, video.assetId);

  const compatible = engine('kling-v4-flash');
  const onFlash = preparePickerScenario({ current, currentEngine: kling4, engine: compatible, locale: 'en' });
  assert.equal(onFlash.workflow.submissionMode, 'ref2v');
  assert.equal(onFlash.setup.klingElements[0]?.video?.assetId, video.assetId);
});

test('Create model switches enable audio through a model without a toggle, while an explicit choice still applies', () => {
  const source = engine('seedance-2-5'), noToggle = engine('kling-v4'), target = engine('wan-3-prime');
  const current = createDraft();
  assert.equal(current.form.audio, false);
  const onFixed = preparePickerScenario({ current, currentEngine: source, engine: noToggle, locale: 'fr' });
  assert.equal(onFixed.supportsAudioToggle, false);
  assert.equal(onFixed.setup.form.audio, true);
  const back = preparePickerScenario({ current: onFixed.setup, currentEngine: noToggle, engine: target, locale: 'fr' });
  assert.equal(back.supportsAudioToggle, true);
  assert.equal(back.setup.form.audio, true);
  const explicit = preparePickerScenario({ current: back.setup, currentEngine: target, engine: target, locale: 'fr', overrides: { audio: false } });
  assert.equal(explicit.setup.form.audio, false);
  const switched = preparePickerScenario({ current: explicit.setup, currentEngine: target, engine: source, locale: 'fr' });
  assert.equal(switched.setup.form.audio, true);
});
