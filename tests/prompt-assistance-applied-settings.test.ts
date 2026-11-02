import assert from 'node:assert/strict';
import test from 'node:test';
import {createPreviewState,previewReducer,canApplyProposal,canReviewProposal,canApplyReviewedProposal,canUndoProposal} from '../frontend/src/lib/prompt-assistance/preview-state';
const original={compatibilityKey:'owner/video/create/model/ref/yoga',settings:{aspectRatio:'9:16'}};
const applied={compatibilityKey:'owner/video/create/model/ref/bakery',settings:{aspectRatio:'9:16'}};
function prepare(){let s=createPreviewState('owner:create','yoga',original);s=previewReducer(s,{type:'send',id:1,message:'Bakery'});return previewReducer(s,{type:'reply',id:1,text:'Bakery',reply:'Ready'});}
function apply(s=prepare()){return previewReducer(s,{type:'applied',previous:'Yoga',fingerprint:'bakery',applicationContext:applied});}
const sync=(s:ReturnType<typeof prepare>,key='bakery',context=applied)=>previewReducer(s,{type:'sync',scope:s.scope,fingerprint:key,applicationContext:context});
const ratio=(s:ReturnType<typeof prepare>)=>sync(s,'landscape',{...applied,settings:{aspectRatio:'16:9'}});
test('explicit application establishes a separate post-apply review baseline, preserving historical proof and Undo',()=>{
 let s=sync(apply());assert.deepEqual(s.proposal!.applicationContext,original);assert.equal(canApplyProposal(s),true);assert.equal(canUndoProposal(s),true);
 s=ratio(s);assert.equal(canApplyProposal(s),false);assert.equal(canReviewProposal(s),true);
 s=previewReducer(s,{type:'review'});assert.equal(canApplyReviewedProposal(s),true);
 s=previewReducer(s,{type:'appliedReviewed',previous:'Bakery',fingerprint:'landscape',applicationContext:{...applied,settings:{aspectRatio:'16:9'}}});
 assert.equal(s.undo,null);assert.deepEqual(s.proposal!.applicationContext,original);
 s=sync(s,'portrait-again',applied);assert.equal(canReviewProposal(s),true);
});
for(const hard of ['manual edit','model','reference','workflow','perception'])test(`post-apply review cannot survive ${hard} and reversion`,()=>{
 let s=sync(apply());s=sync(s,'changed',{...applied,compatibilityKey:hard});s=sync(s);s=ratio(s);assert.equal(canReviewProposal(s),false);assert.equal(canApplyProposal(s),false);assert.equal(canUndoProposal(s),false);
});
test('restored ordinary suggestion gets review only after explicit reapplication; Undo revokes baseline',()=>{
 let s=createPreviewState('owner:create','bakery',applied);s=previewReducer(s,{type:'hydrate',scope:s.scope,fingerprint:'bakery',messages:[],message:'',proposal:{text:'Bakery',valid:true}});
 assert.equal(canReviewProposal(ratio(s)),false);
 s=previewReducer(s,{type:'applied',previous:'Bakery',fingerprint:'bakery',applicationContext:applied});assert.equal(canReviewProposal(ratio(s)),true);assert.equal(canUndoProposal(s),false);
 s=sync(apply());s=previewReducer(s,{type:'undone',fingerprint:'yoga'});s=sync(s);assert.equal(canReviewProposal(ratio(s)),false);
});
