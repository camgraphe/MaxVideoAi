import assert from 'node:assert/strict';
import test from 'node:test';
import {proposalApplicationContext,draftWithReviewSettings,applicationSettingChanges} from '../frontend/src/lib/prompt-assistance/application-review';
import {createPreviewState,previewReducer,canApplyProposal,canReviewProposal,canApplyReviewedProposal,canUndoProposal} from '../frontend/src/lib/prompt-assistance/preview-state';

const input={accountKey:'owner',scopeKey:'image:create',reviewKey:'full local image identity',text:'Original manual prompt',target:'prompt',perceptionRevision:0,
 live:{surface:'image' as const,workflow:'create' as const,engineId:'nano-banana-2-1',mode:'t2i',settings:{aspectRatio:'1:1',resolution:'2k',quality:null,numImages:1},references:[]}};

test('Image t2i ratio-only change requires explicit local review and retains Undo',()=>{
 const before=proposalApplicationContext(input);
 assert.ok(before,'reference-free Image t2i must retain its original compatibility proof');
 const after=proposalApplicationContext({...input,live:{...input.live,settings:{...input.live.settings,aspectRatio:'16:9'}}})!;
 assert.equal(before.compatibilityKey,after.compatibilityKey);
 assert.deepEqual(before.settings,{aspectRatio:'1:1'});
 let state=createPreviewState('owner:image:create','square',before);
 state=previewReducer(state,{type:'send',id:1,message:'Compose a square scene'});
 state=previewReducer(state,{type:'reply',id:1,text:'A square composition.',reply:'Ready',requestId:'original-request'});
 state=previewReducer(state,{type:'sync',scope:state.scope,fingerprint:'wide',applicationContext:after});
 assert.equal(canApplyProposal(state),false);assert.equal(canReviewProposal(state),true);assert.equal(canApplyReviewedProposal(state),false);
 assert.deepEqual(applicationSettingChanges(before,after),[{key:'aspectRatio',before:'1:1',current:'16:9'}]);
 state=previewReducer(state,{type:'review'});assert.equal(canApplyReviewedProposal(state),true);
 state=previewReducer(state,{type:'edit',text:'Explicitly edited composition.'});
 state=previewReducer(state,{type:'appliedReviewed',previous:'Original manual prompt',fingerprint:'applied'});
 assert.equal(state.applicationContext!.settings.aspectRatio,'16:9');assert.equal(canUndoProposal(state),true);
 assert.equal(state.undo!.text,'Original manual prompt');
});

test('Image restoration replaces only ratio and never restores cached video or nonratio controls',()=>{
 const draft={...input.live,text:input.text,target:'prompt' as const,settings:{aspectRatio:'16:9',resolution:'2k',seed:42,numImages:1}};
 assert.deepEqual(draftWithReviewSettings(draft,{aspectRatio:'1:1'})!.settings,{aspectRatio:'1:1',resolution:'2k',seed:42,numImages:1});
 assert.equal(draftWithReviewSettings(draft,{aspectRatio:'1:1',resolution:'4k',durationSec:7}),null,'unqualified cached settings must invalidate restoration');
});

test('Image compatibility keeps all nonratio parameters and strong identities exact',()=>{
 const before=proposalApplicationContext(input);assert.ok(before);
 for(const change of [{resolution:'4k'},{quality:'high'},{numImages:2},{seed:7},{customImageHeight:'1024'},{customImageWidth:'1024'},{background:'transparent'},{style:'natural'},{outputFormat:'png'},{enableWebSearch:true},{limitGenerations:true},{thinkingLevel:'high'},{watermark:true},{unknownFutureControl:null}]){
  const after=proposalApplicationContext({...input,live:{...input.live,settings:{...input.live.settings,...change}}});
  assert.ok(after);assert.notEqual(before.compatibilityKey,after.compatibilityKey,JSON.stringify(change));
 }
 for(const change of [{accountKey:'other'},{scopeKey:'other:image:create'},{text:'Later manual edit'},{perceptionRevision:1},{reviewKey:'different source, reference role or mask identity'},{live:{...input.live,engineId:'another-model'}},{live:{...input.live,readOnlyText:{negativePrompt:'different'}}}]){
  assert.notEqual(before.compatibilityKey,proposalApplicationContext({...input,...change})?.compatibilityKey,JSON.stringify(change));
 }
 for(const change of [{reviewKey:undefined},{accountKey:undefined},{target:'script'},{live:{...input.live,mode:'i2i',workflow:'edit' as const}},{live:{...input.live,references:[{fieldId:'image_urls',slot:0,label:'Image 1',ref:null}]}},{live:{...input.live,settings:{...input.live.settings,maskContent:'masked region'}}}]){
  assert.equal(proposalApplicationContext({...input,...change}),null,JSON.stringify(change));
 }
});

test('Image hard-context changes cannot be undone into review eligibility, while a second ratio needs a new confirmation',()=>{
 const before=proposalApplicationContext(input);assert.ok(before);
 let state=createPreviewState('owner:image:create','square',before);
 state=previewReducer(state,{type:'send',id:1,message:'Compose'});
 state=previewReducer(state,{type:'reply',id:1,text:'Square scene',reply:'Ready',requestId:'request'});
 const sync=(ratio:string,resolution='2k')=>{state=previewReducer(state,{type:'sync',scope:state.scope,fingerprint:ratio+resolution,applicationContext:proposalApplicationContext({...input,live:{...input.live,settings:{...input.live.settings,aspectRatio:ratio,resolution}}})});};
 sync('16:9');state=previewReducer(state,{type:'review'});assert.equal(canApplyReviewedProposal(state),true);
 sync('9:16');assert.equal(canApplyReviewedProposal(state),false);assert.equal(canReviewProposal(state),true);
 state=previewReducer(state,{type:'review'});assert.equal(canApplyReviewedProposal(state),true);
 sync('9:16','4k');sync('9:16');assert.equal(canReviewProposal(state),false);
});
