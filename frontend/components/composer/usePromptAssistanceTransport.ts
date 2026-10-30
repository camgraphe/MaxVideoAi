'use client';
import {assistanceNextActionSchema,type AssistanceNextAction} from '@/lib/studio/assistance-contract';
import {useEffect,useMemo,useRef,useState} from 'react';
import {promptAssistanceReplySchema,type PromptAssistanceRequest,type PromptAssistanceResult} from '@/lib/prompt-assistance/contract';
import {promptSessionSnapshotSchema,type PromptSessionSnapshot} from '@/lib/prompt-assistance/session';
import {readPromptChat,writePromptChat,promptChatStorageKey,readLegacyPromptRecovery,clearLegacyPromptRecovery,legacyPromptScopeKey,readAnalysisIdentity,type PromptChatLocal} from './prompt-chat-storage';

type Pending={sessionId:string;requestId:string;uiId:number|null};
type Restore=(snapshot:PromptSessionSnapshot|null,local:PromptChatLocal|undefined)=>Promise<()=>void>;
export function usePromptAssistanceTransport(scopeKey:string,enabled:boolean,onResult:(result:PromptAssistanceResult,uiId:number|null)=>void,options?:{scope:string;onRestore:Restore}){
  const owner=useMemo(()=>({key:scopeKey,active:false,sessionId:'',pending:null as Pending|null,controller:null as AbortController|null,waiting:false,loading:enabled,local:undefined as PromptChatLocal|undefined,latestRequestId:'',localEpoch:0,legacy:false,exhausted:null as string|null}),[scopeKey,enabled]);
  const current=useRef(owner);current.current=owner;
  const callbacks=useRef({onResult,options});callbacks.current={onResult,options};
  const [view,setView]=useState({owner,chatId:'',exhausted:null as string|null,loading:enabled,loadError:false,waiting:false,recovery:false,error:null as string|null,nextAction:null as AssistanceNextAction|null,fundingRevision:null as number|null});
  const storageKey=promptChatStorageKey(scopeKey);
  const active=()=>owner.active&&current.current===owner;
  const update=(values:Partial<Omit<typeof view,'owner'>>)=>{if(active())setView(previous=>({...previous,...values,owner,chatId:owner.sessionId,exhausted:owner.exhausted}));};
  function save(){if(owner.sessionId)writePromptChat(storageKey,{sessionId:owner.sessionId,pending:owner.pending?{sessionId:owner.sessionId,requestId:owner.pending.requestId}:null,local:owner.local,legacy:owner.legacy});}
  async function restore(){
    if(!active()||owner.loading&&owner.controller)return;
    owner.loading=true;const controller=new AbortController();owner.controller=controller;update({loading:true,loadError:false,error:null});
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    try{
      let snapshot:PromptSessionSnapshot|null=null;
      if(callbacks.current.options&&!owner.legacy){
        const url=`/api/prompt-assistance?sessionId=${owner.sessionId}&scope=${encodeURIComponent(callbacks.current.options.scope)}`;
        const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});const data=await response.json();
        if(!response.ok||!data.ok){if(!['SESSION_NOT_FOUND','SESSION_SCOPE_CHANGED'].includes(data.error))throw Error(data.error??'RESTORE_FAILED');}
        else snapshot=promptSessionSnapshotSchema.parse(data.result);
        if(!active()||controller.signal.aborted)return;
        if(snapshot&&(snapshot.sessionId!==owner.sessionId||snapshot.scope!==callbacks.current.options.scope))throw Error('INVALID_RESPONSE');
        if(snapshot){
          const done=new Set(snapshot.turns.map(turn=>turn.requestId));
          if(owner.pending&&done.has(owner.pending.requestId))owner.pending=null;
          if(snapshot.pending)owner.pending={sessionId:owner.sessionId,requestId:snapshot.pending.requestId,uiId:null};
          owner.latestRequestId=snapshot.turns.at(-1)?.requestId??'';
          owner.exhausted=snapshot.status==='active'?null:snapshot.status==='full'?'SESSION_FULL':'SESSION_EXPIRED';

        }
        const commit=await callbacks.current.options.onRestore(snapshot,owner.local);
        if(!active()||controller.signal.aborted)return;
        commit();
      }
      save();update({recovery:!!owner.pending,error:owner.pending?'RECOVERY_AVAILABLE':owner.exhausted});
    }catch(error){if(active())update({loadError:true,error:error instanceof Error&&['AUTH_REQUIRED','UNAUTHORIZED'].includes(error.message)?'AUTH_REQUIRED':'RESTORE_FAILED'});}
    finally{window.clearTimeout(timeout);if(owner.controller===controller){owner.controller=null;owner.loading=false;update({loading:false});}}
  }
  useEffect(()=>{
    owner.active=true;
    if(enabled){
      const saved=readPromptChat(storageKey)??readLegacyPromptRecovery(scopeKey);owner.legacy=!!saved?.legacy&&!!callbacks.current.options;owner.exhausted=owner.legacy?'LEGACY_SESSION':null;owner.sessionId=saved?.sessionId??crypto.randomUUID();owner.local=saved?.local;
      owner.pending=saved?.pending?{...saved.pending,uiId:null}:null;save();
      setView({owner,chatId:owner.sessionId,exhausted:owner.exhausted,loading:!!callbacks.current.options,loadError:false,waiting:false,recovery:!!owner.pending,error:owner.pending?'RECOVERY_AVAILABLE':owner.exhausted,nextAction:null,fundingRevision:null});
      if(saved&&callbacks.current.options&&!owner.legacy)void restore();
      else if(callbacks.current.options){
        void callbacks.current.options.onRestore(null,owner.local).then(commit=>{if(active()){commit();owner.loading=false;update({loading:false});}}).catch(()=>{owner.loading=false;update({loading:false,loadError:true,error:'RESTORE_FAILED'});});
      }else owner.loading=false;
    }else{owner.loading=false;setView(previous=>({...previous,owner,loading:false}));}
    return()=>{owner.active=false;owner.controller?.abort();owner.controller=null;};
    // One owner per account/workflow. Callbacks are read through refs, never a reason to reopen a chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[owner,enabled,storageKey]);
  async function perform(body:unknown,pending:Pending){
    if(!active()||owner.waiting||owner.loading)return;
    owner.waiting=true;owner.controller=new AbortController();update({waiting:true,error:null,nextAction:null});
    const controller=owner.controller,timeout=window.setTimeout(()=>controller.abort(),100_000);
    try{
      const response=await fetch('/api/prompt-assistance',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});const payload=await response.json();
      if(!response.ok||!payload.ok){
        const rejected=['ASSISTANCE_SELECTION_CHANGED','INVALID_REQUEST','BODY_TOO_LARGE','SAME_ORIGIN_REQUIRED','AUTH_REQUIRED','UNAUTHORIZED','EMAIL_VERIFICATION_REQUIRED','ASSISTANCE_DISABLED','SESSION_EXPIRED','SESSION_FULL','SESSION_SCOPE_CHANGED','REQUEST_CLOSED','REQUEST_PENDING','ASSISTANCE_RECOVERY_REQUIRED'].includes(payload.error);
        if(rejected&&active()){
          // A rejected recovery did not establish the original request's outcome.
          // Keep its identity until the server returns an explicit terminal result.
          if((body as {action?:string}).action==='recover'){
            update({recovery:true,error:payload.error});return;
          }
          owner.pending=null;
          if(['SESSION_EXPIRED','SESSION_FULL','SESSION_SCOPE_CHANGED'].includes(payload.error)){
            owner.exhausted=payload.error;
          }
          save();update({recovery:false,error:payload.error});
          callbacks.current.onResult({sessionId:pending.sessionId,requestId:pending.requestId,draftRevision:0,target:'prompt',message:(body as {request?:{message:string}}).request?.message??'',state:'failed',safeToRetry:true,error:payload.error} as PromptAssistanceResult,pending.uiId);return;
        }
        throw new Error(payload.error??'ASSISTANCE_UNAVAILABLE');
      }
      const result=payload.result as PromptAssistanceResult;
      if(result.sessionId!==pending.sessionId||result.requestId!==pending.requestId||!['pending','unknown','complete','failed'].includes(result.state))throw new Error('INVALID_RESPONSE');
      const action=assistanceNextActionSchema.safeParse(result.nextAction);result.nextAction=action.success?action.data:undefined;
      if(result.state==='complete')promptAssistanceReplySchema.parse(result.reply);
      if(!active())return;
      if(result.state==='complete'||result.state==='failed'){
        owner.pending=null;
        if(result.state==='complete')owner.latestRequestId=result.requestId;
        save();update({recovery:false,error:result.state==='failed'?result.error??'ASSISTANCE_UNAVAILABLE':null,nextAction:result.state==='failed'&&result.safeToRetry===true?result.nextAction??null:null,fundingRevision:result.assistance?.revision??null});
        if(owner.legacy){
          clearLegacyPromptRecovery(scopeKey,result.requestId);
          callbacks.current.onResult(result,pending.uiId);
          update({error:result.state==='failed'?result.error??'ASSISTANCE_UNAVAILABLE':owner.exhausted});
        }else if(pending.uiId===null&&callbacks.current.options){
          // Restore earlier completed turns, then retain a failed request's retry text and notice.
          owner.controller=null;await restore();if(!active())return;
          if(result.state==='failed'){callbacks.current.onResult(result,null);update({error:result.error??'ASSISTANCE_UNAVAILABLE',nextAction:result.safeToRetry===true?result.nextAction??null:null});}
        }else callbacks.current.onResult(result,pending.uiId);
      }else update({recovery:true,error:result.state==='unknown'?'USAGE_UNRESOLVED':'REQUEST_PENDING'});
    }catch(error){if(active())update({recovery:true,error:error instanceof Error&&error.name==='AbortError'?'WAIT_STOPPED':error instanceof Error?error.message:'ASSISTANCE_UNAVAILABLE'});}
    finally{window.clearTimeout(timeout);owner.waiting=false;if(owner.controller===controller)owner.controller=null;update({waiting:false});}
  }
  function send(request:Omit<PromptAssistanceRequest,'sessionId'|'requestId'>,uiId:number){
    if(!enabled||!active()||owner.pending||owner.waiting||owner.loading||view.loadError||owner.exhausted)return false;
    owner.sessionId ||= crypto.randomUUID();const pending={sessionId:owner.sessionId,requestId:crypto.randomUUID(),uiId};owner.pending=pending;save();update({recovery:false,error:null});
    void perform({action:'message',request:{...request,sessionId:pending.sessionId,requestId:pending.requestId}},pending);return true;
  }
  function pendingAnalysis(){return !!readAnalysisIdentity(`milo-analysis:${options?`${scopeKey}:${owner.sessionId}`:scopeKey}`)||(owner.legacy&&!!readAnalysisIdentity(`milo-analysis:${legacyPromptScopeKey(scopeKey)}`));}
  function newChat(){
    if(!active()||owner.pending||owner.waiting||owner.loading||pendingAnalysis())return false;
    owner.localEpoch++;owner.sessionId=crypto.randomUUID();owner.local=undefined;owner.latestRequestId='';owner.legacy=false;owner.exhausted=null;save();update({error:null,loadError:false,nextAction:null});return true;
  }
  const visible=view.owner===owner?view:{...view,chatId:'',exhausted:null,loading:enabled,loadError:false,waiting:false,recovery:false,error:null,nextAction:null,fundingRevision:null};
  return {...visible,analysisPending:pendingAnalysis(),legacyScopeKey:owner.legacy?legacyPromptScopeKey(scopeKey):undefined,chatKey:options?`${scopeKey}:${visible.chatId}`:scopeKey,newChat,
    localEpoch:()=>owner.localEpoch,
    revokeReviewProof:()=>{if(!active())return;owner.localEpoch++;const proof=owner.local?.proposal?.review;if(proof){proof.compatible=false;save();}},
    saveLocal:(local:Omit<PromptChatLocal,'latestRequestId'>,expectedEpoch:number)=>{if(expectedEpoch===owner.localEpoch&&active()&&!owner.loading&&!visible.loading&&!visible.loadError){owner.local={...local,latestRequestId:owner.latestRequestId};save();}},
    session:()=>{owner.sessionId ||= crypto.randomUUID();save();return owner.sessionId;},send,
    reload:()=>void restore(),recover:()=>{if(owner.pending)void perform({action:'recover',sessionId:owner.pending.sessionId,requestId:owner.pending.requestId},owner.pending);},stop:()=>owner.controller?.abort(),
  };
}
