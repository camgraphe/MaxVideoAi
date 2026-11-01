'use client';
import {type AssistanceNextAction} from '@/lib/studio/assistance-contract';
import {useEffect,useMemo,useRef,useState} from 'react';
import {promptAssistanceReplySchema,type PromptAssistanceRequest,type PromptAssistanceResult} from '@/lib/prompt-assistance/contract';
import {promptSessionSnapshotSchema,lastCompletedPromptRequestId,type PromptSessionSnapshot} from '@/lib/prompt-assistance/session';
import {readPromptChat,writePromptChat,revokePromptChatReview,promptChatStorageKey,readLegacyPromptRecovery,clearLegacyPromptRecovery,legacyPromptScopeKey,readAnalysisIdentity,type PromptChatLocal,type PromptPendingReview} from './prompt-chat-storage';

import {promptReplyHttp,validatedPromptReply,pollPromptReply,PromptReplyHttpError} from './prompt-assistance-polling';
import {readPreviousReply,writePreviousReply,clearPreviousReply,samePreviousReply,privatePreviousReply,previousReplyAccount,type PreviousReplyRef} from './prompt-previous-reply-storage';
type Pending={sessionId:string;requestId:string;uiId:number|null;deadlineAt?:string};
type Restore=(snapshot:PromptSessionSnapshot|null,local:PromptChatLocal|undefined,pendingReview?:PromptPendingReview)=>Promise<()=>void>;
export function usePromptAssistanceTransport(scopeKey:string,enabled:boolean,onResult:(result:PromptAssistanceResult,uiId:number|null)=>void,options?:{scope:string;accountKey?:string;onRestore:Restore}){
  const accountKey=previousReplyAccount(scopeKey,options?.accountKey),serverScope=options?.scope??'';
  const blockedScopes=useRef(new Set<string>());
  const owner=useMemo(()=>({key:scopeKey,accountKey,serverScope,active:false,sessionId:'',pending:null as Pending|null,pendingReview:undefined as PromptPendingReview|undefined,controller:null as AbortController|null,waiting:false,loading:enabled,local:undefined as PromptChatLocal|undefined,latestRequestId:'',localEpoch:0,chatEpoch:0,previousRef:null as PreviousReplyRef|null,previousViewRef:null as PreviousReplyRef|null,terminalRequest:null as {sessionId:string;requestId:string}|null,previousController:null as AbortController|null,persistenceError:false,cacheError:blockedScopes.current.has(scopeKey),legacy:false,exhausted:null as string|null}),[scopeKey,enabled,accountKey,serverScope]);
  const current=useRef(owner);current.current=owner;
  const callbacks=useRef({onResult,options});callbacks.current={onResult,options};
  const [view,setView]=useState({owner,chatId:'',exhausted:null as string|null,loading:enabled,loadError:false,cacheError:false,waiting:false,recovery:false,phase:undefined as PromptAssistanceResult['phase'],previousRef:null as PreviousReplyRef|null,previousOpen:false,previousWaiting:false,previousResult:null as PromptAssistanceResult|null,previousError:null as string|null,persistenceError:false,error:null as string|null,nextAction:null as AssistanceNextAction|null,fundingRevision:null as number|null});
  const storageKey=promptChatStorageKey(scopeKey);
  const active=()=>owner.active&&current.current===owner;
  const update=(values:Partial<Omit<typeof view,'owner'>>)=>{if(active())setView(previous=>({...previous,...values,owner,chatId:owner.sessionId,exhausted:owner.exhausted,previousRef:owner.previousRef,persistenceError:owner.persistenceError}));};
  function closePreviousReply(){
    owner.previousController?.abort();owner.previousController=null;owner.previousViewRef=null;
    update({previousOpen:false,previousWaiting:false,previousResult:null,previousError:null});
  }
  function remember(ref:PreviousReplyRef,expected?:PreviousReplyRef|null){
    const previous=owner.previousRef;
    if(!writePreviousReply(accountKey,ref,expected))owner.persistenceError=true;
    owner.previousRef=readPreviousReply(accountKey)??ref;
    // An open view belongs to one identity even when admission or another tab replaces the account pointer.
    if(!samePreviousReply(previous,owner.previousRef))closePreviousReply();else update({});
  }
  function rememberStatus(pending:Pending,result:PromptAssistanceResult){
    const previous=readPreviousReply(accountKey);
    if(previous&&samePreviousReply(previous,pending))remember({...previous,deadlineAt:previous.deadlineAt??result.deadlineAt,status:result.state==='complete'||result.state==='failed'?'terminal':result.state==='unknown'?'unknown':'pending'},previous);
  }
  function observePendingRequest(value:unknown){
    if(!enabled||!active())return;
    const pointer=privatePreviousReply(value,scopeKey),previous=readPreviousReply(accountKey);
    if(!pointer)return;
    if(owner.terminalRequest?.sessionId===pointer.sessionId&&owner.terminalRequest.requestId===pointer.requestId)return;
    if(previous&&samePreviousReply(previous,pointer)&&previous.status==='terminal')return;
    if(previous&&previous.status!=='terminal'&&!samePreviousReply(previous,pointer))return;
    const same=previous&&samePreviousReply(previous,pointer);
    remember({...pointer,deadlineAt:same?previous.deadlineAt??pointer.deadlineAt:pointer.deadlineAt,status:same&&previous.status==='unknown'?'unknown':'pending'},previous??undefined);
  }
  function snapshot(){return {sessionId:owner.sessionId,pending:owner.pending?{sessionId:owner.pending.sessionId,requestId:owner.pending.requestId}:null,pendingReview:owner.pendingReview,local:owner.local,legacy:owner.legacy};}
  function save(){return !!owner.sessionId&&writePromptChat(storageKey,snapshot());}
  function persistRevocation(revokePending=true){
    if(owner.local?.proposal?.review)owner.local.proposal.review.compatible=false;
    if(revokePending&&owner.pendingReview)owner.pendingReview.compatible=false;
    const result=revokePromptChatReview(storageKey,snapshot(),!!owner.pending||pendingAnalysis(),revokePending);
    if(result.kind==='saved'){owner.local=result.record.local;owner.pendingReview=result.record.pendingReview;}
    else if(result.kind==='discarded'){owner.local=undefined;owner.pendingReview=undefined;}
    owner.cacheError=result.kind!=='saved';if(owner.cacheError)blockedScopes.current.add(scopeKey);else blockedScopes.current.delete(scopeKey);update({cacheError:owner.cacheError});
  }
  async function restore(){
    if(!active()||owner.loading&&owner.controller)return;
    const sessionId=owner.sessionId,chatEpoch=owner.chatEpoch;
    const valid=()=>active()&&owner.sessionId===sessionId&&owner.chatEpoch===chatEpoch;
    owner.loading=true;const controller=new AbortController();owner.controller=controller;update({loading:true,loadError:false,error:null});
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    try{
      let snapshot:PromptSessionSnapshot|null=null;
      if(callbacks.current.options&&!owner.legacy){
        const url=`/api/prompt-assistance?sessionId=${owner.sessionId}&scope=${encodeURIComponent(callbacks.current.options.scope)}`;
        const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});const data=await response.json();
        if(!response.ok||!data.ok){if(!['SESSION_NOT_FOUND','SESSION_SCOPE_CHANGED'].includes(data.error))throw Error(data.error??'RESTORE_FAILED');}
        else snapshot=promptSessionSnapshotSchema.parse(data.result);
        if(!valid()||controller.signal.aborted)return;
        if(snapshot&&(snapshot.sessionId!==owner.sessionId||snapshot.scope!==callbacks.current.options.scope))throw Error('INVALID_RESPONSE');
        if(snapshot){
          const done=new Set(snapshot.turns.map(turn=>turn.requestId));
          if(owner.pending&&done.has(owner.pending.requestId)){owner.terminalRequest={sessionId:owner.pending.sessionId,requestId:owner.pending.requestId};const previous=readPreviousReply(accountKey);if(previous&&samePreviousReply(previous,owner.pending)){clearPreviousReply(accountKey,previous);owner.previousRef=null;}owner.pending=null;}
          if(snapshot.pending){owner.pending={sessionId:owner.sessionId,requestId:snapshot.pending.requestId,uiId:null};if(!owner.previousRef)remember({version:1,scopeKey,serverScope:callbacks.current.options.scope,sessionId:owner.pending.sessionId,requestId:owner.pending.requestId,status:'pending'} as PreviousReplyRef);}
          owner.latestRequestId=lastCompletedPromptRequestId(snapshot);
          owner.exhausted=snapshot.status==='active'?null:snapshot.status==='full'?'SESSION_FULL':'SESSION_EXPIRED';

        }
        // A session snapshot may retain an older proposal after a text-less reply.
        // Only the original identity's terminal text can promote its Send-time proof.
        let pendingReview:PromptPendingReview|undefined;
        const baseline=owner.pendingReview;
        if(snapshot?.proposal&&baseline?.compatible&&baseline.requestId===owner.latestRequestId&&baseline.draftFingerprint===snapshot.proposal.draftFingerprint){
          const response=await fetch(`/api/prompt-assistance?sessionId=${owner.sessionId}&requestId=${baseline.requestId}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
          const data=await response.json();
          if(!valid()||controller.signal.aborted)return;
          if(!response.ok||!data.ok)throw Error(data.error??'RESTORE_FAILED');
          const result=data.result as PromptAssistanceResult;
          if(result.sessionId!==owner.sessionId||result.requestId!==baseline.requestId||result.state!=='complete')throw Error('INVALID_RESPONSE');
          const reply=promptAssistanceReplySchema.parse(result.reply);
          if(reply.text&&reply.text===snapshot.proposal.text)pendingReview=baseline;
        }
        const commit=await callbacks.current.options.onRestore(snapshot,owner.local,pendingReview);
        if(!valid()||controller.signal.aborted)return;
        commit();
      }
      save();update({recovery:!!owner.pending,error:owner.pending?'RECOVERY_AVAILABLE':owner.exhausted});
    }catch(error){if(valid())update({loadError:true,error:error instanceof Error&&['AUTH_REQUIRED','UNAUTHORIZED'].includes(error.message)?'AUTH_REQUIRED':'RESTORE_FAILED'});}
    finally{window.clearTimeout(timeout);if(owner.controller===controller){owner.controller=null;owner.loading=false;update({loading:false});}}
  }
  useEffect(()=>{
    owner.active=true;owner.previousRef=readPreviousReply(accountKey);
    if(enabled){
      const saved=readPromptChat(storageKey)??readLegacyPromptRecovery(scopeKey);owner.legacy=!!saved?.legacy&&!!callbacks.current.options;owner.exhausted=owner.legacy?'LEGACY_SESSION':null;owner.sessionId=saved?.sessionId??crypto.randomUUID();owner.local=saved?.local;owner.pendingReview=owner.legacy?undefined:saved?.pendingReview;
      owner.pending=saved?.pending?{...saved.pending,uiId:null}:null;if(owner.pending&&!owner.previousRef)remember({version:1,scopeKey,serverScope:callbacks.current.options?.scope??'',sessionId:owner.pending.sessionId,requestId:owner.pending.requestId,status:'pending'});if(owner.cacheError)persistRevocation();else save();
      setView({owner,chatId:owner.sessionId,exhausted:owner.exhausted,loading:!!callbacks.current.options,loadError:false,cacheError:owner.cacheError,waiting:false,recovery:!!owner.pending,phase:undefined,previousRef:owner.previousRef,previousOpen:false,previousWaiting:false,previousResult:null,previousError:null,persistenceError:owner.persistenceError,error:owner.pending?'RECOVERY_AVAILABLE':owner.exhausted,nextAction:null,fundingRevision:null});
      if(saved&&callbacks.current.options&&!owner.legacy)void restore();
      else if(callbacks.current.options){
        const sessionId=owner.sessionId,epoch=owner.chatEpoch;void callbacks.current.options.onRestore(null,owner.local).then(commit=>{if(active()&&sessionId===owner.sessionId&&epoch===owner.chatEpoch){commit();owner.loading=false;update({loading:false});}}).catch(()=>{if(active()&&sessionId===owner.sessionId&&epoch===owner.chatEpoch){owner.loading=false;update({loading:false,loadError:true,error:'RESTORE_FAILED'});}});
      }else owner.loading=false;
    }else{owner.loading=false;setView(previous=>({...previous,owner,loading:false}));}
    return()=>{owner.active=false;owner.controller?.abort();owner.controller=null;owner.previousController?.abort();owner.previousController=null;};
    // One owner per account/workflow. Callbacks are read through refs, never a reason to reopen a chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[owner,enabled,storageKey]);
  async function perform(body:unknown,pending:Pending){
    if(!active()||owner.waiting||owner.loading)return;
    const epoch=owner.chatEpoch;
    const valid=()=>active()&&owner.chatEpoch===epoch&&owner.sessionId===pending.sessionId&&owner.pending===pending;
    const controller=new AbortController();owner.controller=controller;owner.waiting=true;update({waiting:true,error:null,nextAction:null});
    try{
      let result=validatedPromptReply(await promptReplyHttp('/api/prompt-assistance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)},controller.signal),pending);
      if(!valid()||controller.signal.aborted)return;
      pending.deadlineAt??=result.deadlineAt;rememberStatus(pending,result);update({phase:result.phase});
      result=await pollPromptReply(pending,controller.signal,status=>{if(valid()){rememberStatus(pending,status);update({phase:status.phase});}},result);
      if(!valid()||controller.signal.aborted)return;
      if(result.state==='complete'||result.state==='failed'){
        owner.terminalRequest={sessionId:result.sessionId,requestId:result.requestId};
        rememberStatus(pending,result);
        const previous=readPreviousReply(accountKey);if(previous&&samePreviousReply(previous,pending)){if(!clearPreviousReply(accountKey,previous))owner.persistenceError=true;owner.previousRef=null;}
        owner.pending=null;
        if(result.state==='complete')owner.latestRequestId=result.requestId;
        save();update({recovery:false,phase:undefined,error:result.state==='failed'?result.error??'ASSISTANCE_UNAVAILABLE':null,nextAction:result.state==='failed'&&result.safeToRetry===true?result.nextAction??null:null,fundingRevision:result.assistance?.revision??null});
        const sameChat=()=>active()&&owner.chatEpoch===epoch&&owner.sessionId===pending.sessionId;
        if(owner.legacy){clearLegacyPromptRecovery(scopeKey,result.requestId);callbacks.current.onResult(result,pending.uiId);update({error:result.state==='failed'?result.error??'ASSISTANCE_UNAVAILABLE':owner.exhausted});}
        else if(pending.uiId===null&&callbacks.current.options){
          owner.controller=null;await restore();if(!sameChat())return;
          if(result.state==='failed'){callbacks.current.onResult(result,null);update({error:result.error??'ASSISTANCE_UNAVAILABLE',nextAction:result.safeToRetry===true?result.nextAction??null:null});}
        }else callbacks.current.onResult(result,pending.uiId);
      }else update({recovery:true,error:result.state==='unknown'?'USAGE_UNRESOLVED':'REQUEST_PENDING'});
    }catch(error){
      if(!valid())return;
      const code=error instanceof Error?error.message:'ASSISTANCE_UNAVAILABLE';
      const rejected=error instanceof PromptReplyHttpError&&['ASSISTANCE_SELECTION_CHANGED','INVALID_REQUEST','BODY_TOO_LARGE','SAME_ORIGIN_REQUIRED','AUTH_REQUIRED','UNAUTHORIZED','EMAIL_VERIFICATION_REQUIRED','ASSISTANCE_DISABLED','SESSION_EXPIRED','SESSION_FULL','SESSION_SCOPE_CHANGED','REQUEST_CLOSED','REQUEST_PENDING','ASSISTANCE_RECOVERY_REQUIRED'].includes(code);
      if(rejected&&(body as {action?:string}).action!=='recover'){
        owner.pending=null;
        const blocker=code==='REQUEST_PENDING'?privatePreviousReply(error.pendingRequest,scopeKey):null;
        const previous=readPreviousReply(accountKey);
        // A rejected admission has no worker. Replace only this attempted identity with the owned blocker.
        if(blocker){if(previous&&samePreviousReply(previous,pending))clearPreviousReply(accountKey,previous);remember(blocker);}
        else if(previous&&samePreviousReply(previous,pending)){clearPreviousReply(accountKey,previous);owner.previousRef=null;}
        if(['SESSION_EXPIRED','SESSION_FULL','SESSION_SCOPE_CHANGED'].includes(code))owner.exhausted=code;
        save();update({recovery:false,error:code,phase:undefined});
        callbacks.current.onResult({sessionId:pending.sessionId,requestId:pending.requestId,draftRevision:0,target:'prompt',message:(body as {request?:{message:string}}).request?.message??'',state:'failed',safeToRetry:true,error:code} as PromptAssistanceResult,pending.uiId);
      }else update({recovery:true,error:error instanceof Error&&error.name==='AbortError'?'WAIT_STOPPED':code});
    }finally{
      if(owner.controller===controller){owner.controller=null;owner.waiting=false;update({waiting:false});}
      else if(active()&&owner.chatEpoch===epoch&&!owner.controller){owner.waiting=false;update({waiting:false});}
    }
  }
  async function checkPreviousReply(pointer=owner.previousRef){
    if(!active()||!pointer||owner.previousController||!samePreviousReply(owner.previousRef,pointer)||owner.pending&&samePreviousReply(pointer,owner.pending))return;
    const controller=new AbortController(),epoch=owner.chatEpoch;owner.previousController=controller;owner.previousViewRef=pointer;
    const valid=()=>active()&&owner.chatEpoch===epoch&&owner.previousController===controller&&samePreviousReply(readPreviousReply(accountKey),pointer);
    update({previousOpen:true,previousWaiting:true,previousError:null,previousResult:null});
    try{
      let result=validatedPromptReply(await promptReplyHttp('/api/prompt-assistance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'recover',sessionId:pointer.sessionId,requestId:pointer.requestId})},controller.signal),pointer);
      if(!valid())return;
      rememberStatus({...pointer,uiId:null},result);update({previousResult:result});
      result=await pollPromptReply({...pointer,deadlineAt:pointer.deadlineAt??result.deadlineAt},controller.signal,status=>{if(valid()){rememberStatus({...pointer,uiId:null},status);update({previousResult:status});}},result);
      if(valid()){rememberStatus({...pointer,uiId:null},result);update({previousResult:result,previousError:result.state==='failed'?result.error??'ASSISTANCE_UNAVAILABLE':null});}
    }catch(error){if(valid())update({previousError:error instanceof Error&&error.name==='AbortError'?'WAIT_STOPPED':error instanceof Error?error.message:'ASSISTANCE_UNAVAILABLE'});}
    finally{if(owner.previousController===controller){owner.previousController=null;update({previousWaiting:false});}}
  }
  function send(request:Omit<PromptAssistanceRequest,'sessionId'|'requestId'>,uiId:number,review?:()=>Promise<Omit<PromptPendingReview,'requestId'>>){
    if(!enabled||!active()||owner.pending||owner.waiting||owner.loading||view.loadError||owner.exhausted||owner.previousRef&&owner.previousRef.status!=='terminal')return false;
    owner.sessionId ||= crypto.randomUUID();const pending={sessionId:owner.sessionId,requestId:crypto.randomUUID(),uiId};owner.pending=pending;owner.pendingReview=undefined;remember({version:1,scopeKey,serverScope:callbacks.current.options?.scope??'',sessionId:pending.sessionId,requestId:pending.requestId,status:'admitting'});save();update({recovery:false,error:null});
    const epoch=owner.localEpoch,chatEpoch=owner.chatEpoch;
    void (async()=>{
      try{
        const proof=await review?.();
        if(!active()||owner.pending!==pending||chatEpoch!==owner.chatEpoch)return;
        if(proof&&epoch===owner.localEpoch){owner.pendingReview={...proof,requestId:pending.requestId};if(!save())persistRevocation();}
      }catch{/* A failed digest grants no review permission; retain ordinary request recovery. */}
      if(active()&&owner.pending===pending&&chatEpoch===owner.chatEpoch)await perform({action:'message',request:{...request,sessionId:pending.sessionId,requestId:pending.requestId}},pending);
    })();return true;
  }
  function pendingAnalysis(){return !!readAnalysisIdentity(`milo-analysis:${options?`${scopeKey}:${owner.sessionId}`:scopeKey}`)||(owner.legacy&&!!readAnalysisIdentity(`milo-analysis:${legacyPromptScopeKey(scopeKey)}`));}
  function newChat(unsentMessage=''){
    if(!active()||pendingAnalysis())return false;
    owner.controller?.abort();owner.controller=null;owner.previousController?.abort();owner.previousController=null;owner.previousViewRef=null;
    owner.chatEpoch++;owner.localEpoch++;owner.sessionId=crypto.randomUUID();owner.local={message:unsentMessage,proposal:null,latestRequestId:''};owner.pending=null;owner.waiting=false;owner.loading=false;owner.pendingReview=undefined;owner.latestRequestId='';owner.legacy=false;owner.exhausted=null;
    const saved=save();if(saved){owner.cacheError=false;blockedScopes.current.delete(scopeKey);}else owner.persistenceError=true;
    update({error:null,loadError:false,loading:false,waiting:false,recovery:false,phase:undefined,previousOpen:false,previousWaiting:false,previousResult:null,nextAction:null,cacheError:owner.cacheError});return true;
  }
  const visible=view.owner===owner?view:{...view,chatId:'',exhausted:null,loading:enabled,loadError:false,cacheError:false,waiting:false,recovery:false,phase:undefined,previousRef:null,previousOpen:false,previousWaiting:false,previousResult:null,previousError:null,persistenceError:false,error:null,nextAction:null,fundingRevision:null};
  const previousViewRef=owner.previousViewRef;
  return {...visible,observePendingRequest,recheckPreviousReply:()=>{if(previousViewRef&&owner.previousViewRef===previousViewRef)void checkPreviousReply(previousViewRef);},accountPending:!!owner.previousRef&&owner.previousRef.status!=='terminal',previousAvailable:!!owner.previousRef&&(!owner.pending||!samePreviousReply(owner.previousRef,owner.pending)),checkPreviousReply,closePreviousReply,stopPreviousReply:()=>owner.previousController?.abort(),analysisPending:pendingAnalysis(),legacyScopeKey:owner.legacy?legacyPromptScopeKey(scopeKey):undefined,chatKey:options?`${scopeKey}:${visible.chatId}`:scopeKey,newChat,
    localEpoch:()=>owner.localEpoch,
    messageForNewChat:(message:string)=>owner.loading?(message||owner.local?.message||''):message,
    saveMessage:(message:string)=>{if(active()&&!owner.loading){owner.local={...owner.local,message,proposal:owner.local?.proposal??null,latestRequestId:owner.latestRequestId};if(!save()){owner.persistenceError=true;update({});}}},
    revokeReviewProof:(includePending=false)=>{if(!active())return;owner.localEpoch++;const proof=owner.local?.proposal?.review;if(proof)proof.compatible=false;if(includePending&&owner.pendingReview)owner.pendingReview.compatible=false;if(proof||includePending&&owner.pendingReview)persistRevocation(includePending);},
    saveLocal:(local:Omit<PromptChatLocal,'latestRequestId'>,expectedEpoch:number)=>{if(expectedEpoch===owner.localEpoch&&active()&&!owner.loading&&!visible.loading&&!visible.loadError){owner.local={...local,latestRequestId:owner.latestRequestId};if(local.proposal&&owner.pendingReview?.requestId===owner.latestRequestId)owner.pendingReview=undefined;if(owner.cacheError)persistRevocation();else save();}},
    session:()=>{owner.sessionId ||= crypto.randomUUID();save();return owner.sessionId;},send,
    reload:()=>void restore(),recover:()=>{if(owner.pending)void perform({action:'recover',sessionId:owner.pending.sessionId,requestId:owner.pending.requestId},owner.pending);},stop:()=>owner.controller?.abort(),
  };
}
