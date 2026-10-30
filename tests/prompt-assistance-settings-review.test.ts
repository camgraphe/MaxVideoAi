import assert from 'node:assert/strict';
import test from 'node:test';
import {createPreviewState,previewReducer,canApplyProposal,canUndoProposal,canReviewProposal,canApplyReviewedProposal} from '../frontend/src/lib/prompt-assistance/preview-state';
import {applicationSettingChanges,type ProposalApplicationContext} from '../frontend/src/lib/prompt-assistance/application-review';

const context=(settings={aspectRatio:'auto',durationSec:7},compatibilityKey='same source/editor/engine'):ProposalApplicationContext=>({compatibilityKey,settings});
function proposal(){
 let state=createPreviewState('account:video:create','initial',context());
 state=previewReducer(state,{type:'send',id:1,message:'A funny vertical clip'});
 return previewReducer(state,{type:'reply',id:1,text:'A funny vertical 7-second clip',reply:'Choose 9:16.'});
}
const change=(state:ReturnType<typeof proposal>,fingerprint='portrait',applicationContext=context({aspectRatio:'9:16',durationSec:7}))=>previewReducer(state,{type:'sync',scope:state.scope,fingerprint,applicationContext});

test('settings-only stale proposals need an explicit review and apply text with current settings',()=>{
 let state=change(proposal());
 assert.equal(canApplyProposal(state),false);
 assert.equal(canReviewProposal(state),true);
 assert.equal(canApplyReviewedProposal(state),false);
 assert.deepEqual(applicationSettingChanges(state.proposal!.applicationContext!,state.applicationContext!),[{key:'aspectRatio',before:'auto',current:'9:16'}]);
 state=previewReducer(state,{type:'review'});
 assert.equal(canApplyProposal(state),false,'review must never silently restamp the proposal');
 assert.equal(canApplyReviewedProposal(state),true);
 assert.equal(canApplyReviewedProposal({...state,proposal:{...state.proposal!,text:'Unreviewed replacement'}}),false);
 assert.equal(canApplyReviewedProposal({...state,proposal:{...state.proposal!,requestId:'different request'}}),false);
 state=previewReducer(state,{type:'edit',text:'A revised vertical clip'});
 assert.equal(canApplyReviewedProposal(state),true,'the reviewed proposal is editable');
 state=previewReducer(state,{type:'appliedReviewed',previous:'Original manual prompt',fingerprint:'applied'});
 assert.equal(state.mode,'prompt');assert.equal(canUndoProposal(state),true);
 assert.equal(state.applicationContext!.settings.aspectRatio,'9:16');
 assert.equal(state.undo!.text,'Original manual prompt');assert.equal(state.review,null);
});

test('a reviewed token cannot cross a context change, pending send, new reply or new chat',()=>{
 let state=previewReducer(change(proposal()),{type:'review'});
 state=change(state,'another setting',context({aspectRatio:'9:16',durationSec:8}));
 assert.equal(canApplyReviewedProposal(state),false);assert.equal(state.review,null);
 const ignored=previewReducer(state,{type:'appliedReviewed',previous:'Do not overwrite',fingerprint:'wrong'});
 assert.equal(ignored,state);
 state=previewReducer(state,{type:'review'});assert.equal(canApplyReviewedProposal(state),true);
 state=previewReducer(state,{type:'send',id:2,message:'Another turn'});
 assert.equal(canReviewProposal(state),false);assert.equal(canApplyReviewedProposal(state),false);
 state=previewReducer(state,{type:'reply',id:2,text:'Another proposal',reply:'Done'});
 assert.equal(state.review,null);assert.equal(canApplyProposal(state),true);
 state=previewReducer(state,{type:'newChat'});assert.equal(state.proposal,null);assert.equal(state.review,null);
});

test('hard-context changes remain incompatible even after reverting and switching account clears proposals',()=>{
 let state=proposal();
 state=change(state,'different editor',context({aspectRatio:'auto',durationSec:7},'changed manual editor'));
 state=change(state,'portrait',context({aspectRatio:'9:16',durationSec:7}));
 assert.equal(canReviewProposal(state),false,'reverted hard context must not resurrect compatibility');
 state=previewReducer(state,{type:'review'});assert.equal(canApplyReviewedProposal(state),false);
 state=previewReducer(state,{type:'sync',scope:'other:video:create',fingerprint:'other',applicationContext:context()});
 assert.equal(state.proposal,null);assert.equal(state.review,null);
});

test('unknown restored baseline cannot be reviewed; a valid restore retains ordinary Apply',()=>{
 let state=createPreviewState('account:video:create','initial',context());
 state=previewReducer(state,{type:'hydrate',scope:state.scope,fingerprint:'initial',messages:[],message:'',proposal:{text:'Saved proposal',valid:true}});
 assert.equal(canApplyProposal(state),true);
 state=change(state);assert.equal(canReviewProposal(state),false);
 state=previewReducer(state,{type:'review'});assert.equal(canApplyReviewedProposal(state),false);
 state=previewReducer(state,{type:'restored',message:'Saved message',text:'Recovered proposal',reply:'Recovered'});
 assert.equal(canReviewProposal(state),false);
});

test('duration aliases have one readable diff and video compatibility retains unknown source controls',async()=>{
 const {videoPromptReviewKey}=await import('../frontend/src/lib/prompt-assistance/application-review');
 assert.deepEqual(applicationSettingChanges(context({aspectRatio:'auto',durationSec:7}),{compatibilityKey:'same',settings:{aspectRatio:'auto',durationSec:8,durationOption:8}}).map(x=>x.key),['durationSec']);
 const before={form:{engineId:'wan-3',mode:'t2v',aspectRatio:'auto',extraInputValues:{source_job_id:'first'}},klingElements:[],cfgScale:1};
 assert.equal(videoPromptReviewKey(before),videoPromptReviewKey({...before,form:{...before.form,aspectRatio:'9:16'},cfgScale:0.5}));
 assert.notEqual(videoPromptReviewKey(before),videoPromptReviewKey({...before,form:{...before.form,extraInputValues:{source_job_id:'other'}}}));
});

test('workspace serialization preserves review identity despite reconstructed object property order',async()=>{
 const {videoPromptReviewKey}=await import('../frontend/src/lib/prompt-assistance/application-review');
 const {serializeWorkspaceModelSetup}=await import('../frontend/app/(core)/(workspace)/app/_lib/workspace-model-setups');
 const original={form:{engineId:'wan-3-prime',mode:'t2v',durationSec:6,durationOption:6,resolution:'720p',aspectRatio:'auto',fps:30,iterations:1,audio:false,extraInputValues:{}},inputAssets:{},klingElements:[{id:'same-element',frontal:null,references:[null,null,null],video:null}],prompt:'Same manual text',negativePrompt:'',multiPromptEnabled:false,multiPromptScenes:[],shotType:'customize',voiceIdsInput:'',cfgScale:null};
 const saved=serializeWorkspaceModelSetup(original);assert.ok(saved.ok);
 const context={form:original.form,klingElements:original.klingElements};
 assert.equal(videoPromptReviewKey({form:saved.setup.form,klingElements:saved.setup.klingElements}),videoPromptReviewKey(context));
 assert.notEqual(videoPromptReviewKey({...context,klingElements:[{...original.klingElements[0],id:'another-element'}]}),videoPromptReviewKey(context),'canonicalization must retain element identity');
 assert.notEqual(videoPromptReviewKey({...context,form:{...context.form,extraInputValues:{unknown_source:'changed'}}}),videoPromptReviewKey(context),'unknown inputs remain exact hard context');
});

test('canonical review keys ignore only object property order and retain all hard-context values',async()=>{
 const {applicationReviewKey}=await import('../frontend/src/lib/prompt-assistance/application-review');
 const source={id:'source-a',fieldId:'video_url',range:{startSec:1,endSec:3}};
 const context={model:'wan-3-prime',mode:'v2v',editor:'Keep this draft',extraInput:{unknownControl:'same'},references:[source,{id:'subject-a',fieldId:'image_url'}]};
 const reconstructed={references:[{range:{endSec:3,startSec:1},fieldId:'video_url',id:'source-a'},{fieldId:'image_url',id:'subject-a'}],extraInput:{unknownControl:'same'},editor:'Keep this draft',mode:'v2v',model:'wan-3-prime'};
 assert.equal(applicationReviewKey(context),applicationReviewKey(reconstructed));
 const variants=[{model:'wan-3'},{mode:'extend'},{editor:'New draft'},{extraInput:{unknownControl:'changed'}},{references:[{...source,id:'source-b'},context.references[1]]},{references:[source,{id:'subject-b',fieldId:'image_url'}]},{references:[{...source,range:{startSec:1,endSec:4}},context.references[1]]},{references:[...context.references].reverse()},{references:[source]},{extraInput:{unknownControl:'same',newControl:null}}];
 for(const change of variants)assert.notEqual(applicationReviewKey(context),applicationReviewKey({...context,...change}),JSON.stringify(change));
});

test('anticipated Apply/Undo fingerprints update hard context without invalidating the new Undo revision',()=>{
 let state=previewReducer(change(proposal()),{type:'review'});
 state=previewReducer(state,{type:'appliedReviewed',previous:'Original manual prompt',fingerprint:'applied'});
 state=previewReducer(state,{type:'sync',scope:state.scope,fingerprint:'applied',applicationContext:context({aspectRatio:'9:16',durationSec:7},'applied editor')});
 assert.equal(state.applicationContext!.compatibilityKey,'applied editor');assert.equal(canUndoProposal(state),true);assert.equal(canReviewProposal(state),false);
});

test('restoration cannot attach review proof validated before a hard-context race',()=>{
 let state=createPreviewState('account:video:create','initial',context());
 const revision=state.compatibilityRevision;
 state=change(state,'other source',context({aspectRatio:'auto',durationSec:7},'other source'));
 state=change(state,'returned source',context());
 state=previewReducer(state,{type:'hydrate',scope:state.scope,fingerprint:state.fingerprint,compatibilityRevision:revision,messages:[],message:'',proposal:{text:'Saved proposal',valid:false,applicationContext:context({aspectRatio:'auto',durationSec:7})}});
 state=change(state,'portrait',context({aspectRatio:'9:16',durationSec:7}));assert.equal(canReviewProposal(state),false);
});

test('the complete hard-context digest input binds source metadata, editor, operation and account',async()=>{
 const {proposalApplicationContext}=await import('../frontend/src/lib/prompt-assistance/application-review');
 const input={accountKey:'owner',scopeKey:'video:create',reviewKey:JSON.stringify({assets:{id:'source',duration:7},operation:'create'}),text:'Private manual text',target:'prompt',perceptionRevision:0,live:{surface:'video' as const,workflow:'create' as const,engineId:'wan-3',mode:'t2v',settings:{aspectRatio:'auto',durationSec:7,sourceGenerationContext:'unavailable'},references:[],readOnlyText:{negativePrompt:'No captions'}}};
 const original=proposalApplicationContext(input)!;
 assert.equal(original.compatibilityKey,proposalApplicationContext({...input,live:{...input.live,settings:{...input.live.settings,aspectRatio:'9:16'}}})!.compatibilityKey);
 const variants=[{accountKey:'other'},{scopeKey:'video:modify'},{target:'script'},{text:'Later manual work'},{perceptionRevision:1},{reviewKey:JSON.stringify({assets:{id:'source',duration:8},operation:'create'})},{reviewKey:JSON.stringify({assets:{id:'source',duration:7},operation:'extend'})},{live:{...input.live,engineId:'wan-3-prime'}},{live:{...input.live,mode:'i2v'}},{live:{...input.live,readOnlyText:{negativePrompt:'No music'}}},{live:{...input.live,settings:{...input.live.settings,sourceGenerationContext:'another source'}}}];
 for(const change of variants)assert.notEqual(original.compatibilityKey,proposalApplicationContext({...input,...change})!.compatibilityKey,JSON.stringify(change));
 assert.deepEqual(original.settings,{aspectRatio:'auto',durationSec:7});
 assert.equal(proposalApplicationContext({...input,reviewKey:undefined}),null);
});

test('automatic duration choices remain meaningful while numeric selection aliases are deduplicated',()=>{
 const before={compatibilityKey:'same',settings:{durationSec:7,durationOption:7}};
 assert.deepEqual(applicationSettingChanges(before,{compatibilityKey:'same',settings:{durationSec:7,durationOption:'auto'}}),[{key:'durationSec',before:7,current:'auto'}]);
});

test('supported numeric seconds aliases are deduplicated only when truly equivalent',()=>{
 const base={compatibilityKey:'same',settings:{durationSec:5,durationOption:5}};
 assert.deepEqual(applicationSettingChanges(base,{compatibilityKey:'same',settings:{durationSec:5,durationOption:'5s'}}),[]);
 assert.deepEqual(applicationSettingChanges(base,{compatibilityKey:'same',settings:{durationSec:5,durationOption:'source'}}),[{key:'durationSec',before:5,current:'source'}]);
 assert.ok(applicationSettingChanges(base,{compatibilityKey:'same',settings:{durationSec:5,durationOption:'6s'}}).length,'a contradictory option is not an equivalent alias');
 assert.ok(applicationSettingChanges(base,{compatibilityKey:'same',settings:{durationSec:5,durationOption:'unknown-policy'}}).length,'unknown duration choices are not discarded');
});

test('the video app guide describes only the available settings review path and preserves hard boundaries',async()=>{
 const {promptAssistanceAppGuide}=await import('../frontend/src/server/prompt-assistance/app-guide');
 const video=promptAssistanceAppGuide('video');
 assert.match(video,/If Review & use is available/);assert.match(video,/Use with current settings/);assert.match(video,/does not require another Milo message/);
 assert.match(video,/source, reference, model, operation or manual editor.*not bypassable/i);
 assert.match(video,/never promise.*Review & use/i);
 for(const surface of ['image','audio'] as const)assert.ok(!promptAssistanceAppGuide(surface).includes('Review & use'));
});
