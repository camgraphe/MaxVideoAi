import {applicationSettingChanges,type ProposalApplicationContext} from './application-review';
import type {PromptAnalysisRequest} from './analysis-request';
export type PreviewMessage = { id: string; role: 'user' | 'assistant'; text: string; deliveryFailed?:boolean; analysisRequest?:PromptAnalysisRequest };
export type PreviewState = {
  scope: string; fingerprint: string; revision: number; mode: 'prompt' | 'milo'; message: string;
  messages: PreviewMessage[];
  applicationContext: ProposalApplicationContext | null; compatibilityRevision: number;
  review: { proposalId: number; revision: number; fingerprint: string; text: string; requestId?:string } | null;
  pending: { id: number; revision: number; applicationContext: ProposalApplicationContext | null; compatibilityRevision: number } | null;
  proposal: { text: string; revision: number; id?: number; requestId?:string; applicationContext?: ProposalApplicationContext | null; compatibilityRevision?: number; appliedReview?: { context: ProposalApplicationContext; compatibilityRevision: number } } | null;
  undo: { text: string; revision: number } | null;
};
type Action =
  | { type: 'sync'; scope: string; fingerprint: string; keepMode?:boolean; applicationContext?:ProposalApplicationContext|null }
  | { type: 'hydrate'; scope:string; fingerprint:string; compatibilityRevision?:number; messages:PreviewMessage[]; message:string; proposal:{text:string;valid:boolean;requestId?:string;applicationContext?:ProposalApplicationContext|null}|null }
  | { type: 'newChat'; message?:string }
  | { type: 'mode'; mode: PreviewState['mode'] }
  | { type: 'message' | 'edit'; text: string }
  | { type: 'send'; id: number; message: string }
  | { type: 'reply'; id: number; text: string | null; reply: string; requestId?:string; analysisRequest?:PromptAnalysisRequest }
  | { type: 'failed'; id: number; restore?:boolean }
  | { type: 'rejected'; message:string }
  | { type: 'restored'; message: string; text: string | null; reply: string; requestId?:string; analysisRequest?:PromptAnalysisRequest }
  | { type: 'review' }
  | { type: 'appliedReviewed'; previous: string; fingerprint: string; applicationContext?:ProposalApplicationContext|null }
  | { type: 'applied'; previous: string; fingerprint: string; applicationContext?:ProposalApplicationContext|null }
  | { type: 'undone'; fingerprint: string };

export const previewEnabled = (environment: string | undefined, flag: string | undefined) => environment === 'development' && flag === '1';
/** Historical name retained by the shared layout callers. Live mode has its own explicit gate. */
export const PROMPT_ASSISTANCE_PREVIEW = PROMPT_ASSISTANCE_LIVE || previewEnabled(process.env.NODE_ENV, process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_PREVIEW);
export const createPreviewState = (scope: string, fingerprint: string, applicationContext:ProposalApplicationContext|null=null): PreviewState => ({ scope, fingerprint, applicationContext, compatibilityRevision:0, review:null, revision: 0, mode: 'prompt', message: '', messages: [], pending: null, proposal: null, undo: null });
export const canApplyProposal = (state: PreviewState) => Boolean(state.proposal?.text.trim() && state.proposal.revision === state.revision && !state.pending);
export const canUndoProposal = (state: PreviewState) => state.undo !== null && state.undo.revision === state.revision;

/** Explicit Use may establish a fresh in-memory baseline, without rewriting the request's proof. */
export function proposalReviewContext(state:PreviewState):ProposalApplicationContext|null {
  const baseline=state.proposal?.appliedReview??(state.proposal?.applicationContext?{context:state.proposal.applicationContext,compatibilityRevision:state.proposal.compatibilityRevision}:null);
  return baseline&&baseline.compatibilityRevision===state.compatibilityRevision
    &&baseline.context.compatibilityKey===state.applicationContext?.compatibilityKey?baseline.context:null;
}
/** Review is a separate permission; an old proposal never becomes ordinarily applicable. */
export const canReviewProposal = (state:PreviewState) => {
  const baseline=proposalReviewContext(state);
  return Boolean(state.proposal?.text.trim() && state.proposal.id !== undefined && !state.pending
    && state.proposal.revision !== state.revision && baseline && state.applicationContext
    && applicationSettingChanges(baseline,state.applicationContext).length);
};
export const canApplyReviewedProposal = (state:PreviewState) => Boolean(canReviewProposal(state) && state.review
  && state.review.proposalId === state.proposal?.id && state.review.revision === state.revision
  && state.review.fingerprint === state.fingerprint && state.review.requestId === state.proposal?.requestId && state.review.text === state.proposal.text);

export function previewReducer(state: PreviewState, action: Action): PreviewState {
  switch (action.type) {
    case 'sync':
      if (action.scope !== state.scope) return {...createPreviewState(action.scope, action.fingerprint,action.applicationContext),mode:action.keepMode?state.mode:'prompt'};
      return action.fingerprint === state.fingerprint ? (state.applicationContext?.compatibilityKey===(action.applicationContext??null)?.compatibilityKey?state:{...state,applicationContext:action.applicationContext??null,review:null,compatibilityRevision:state.compatibilityRevision+1}) : { ...state, fingerprint: action.fingerprint, revision: state.revision + 1, review:null, applicationContext:action.applicationContext??null,
        compatibilityRevision:state.compatibilityRevision+(state.applicationContext?.compatibilityKey===(action.applicationContext??null)?.compatibilityKey?0:1) };
    case 'mode': return { ...state, mode: action.mode };
    case 'newChat': return {...createPreviewState(state.scope,state.fingerprint,state.applicationContext),mode:state.mode,message:action.message??''};
    case 'hydrate': return action.scope!==state.scope?state:{...state,pending:null,undo:null,review:null,message:action.message,messages:action.messages,
      proposal:action.proposal?{text:action.proposal.text,id:0,requestId:action.proposal.requestId,applicationContext:action.compatibilityRevision===state.compatibilityRevision?action.proposal.applicationContext:null,compatibilityRevision:state.compatibilityRevision,revision:action.proposal.valid&&action.fingerprint===state.fingerprint?state.revision:-1}:null};
    case 'message': return { ...state, message: action.text };
    case 'edit': return state.proposal ? { ...state, proposal: { ...state.proposal, text: action.text },review:state.review?{...state.review,text:action.text}:null } : state;
    case 'send': return state.pending || !action.message.trim() ? state : { ...state, message: '', review:null,pending: { id: action.id, revision: state.revision,applicationContext:state.applicationContext,compatibilityRevision:state.compatibilityRevision }, messages: [...state.messages, { id: `${action.id}-user`, role: 'user', text: action.message }] };
    case 'reply':
      return state.pending?.id !== action.id ? state : { ...state, pending: null, review:null,proposal: action.text ? { text: action.text, id:action.id,requestId:action.requestId,revision: state.pending.revision,applicationContext:state.pending.applicationContext,compatibilityRevision:state.pending.compatibilityRevision } : state.proposal, messages: [...state.messages, { id: `${action.id}-assistant`, role: 'assistant', text: action.reply, ...(action.analysisRequest?{analysisRequest:action.analysisRequest}:{}) }] };
    case 'failed': {
      if(state.pending?.id!==action.id)return state;
      const failedId=`${action.id}-user`;
      return {...state,pending:null,...(action.restore?{message:state.message||state.messages.find(item=>item.id===failedId)?.text||'',messages:state.messages.filter(item=>item.id!==failedId)}:{messages:state.messages.map(item=>item.id===failedId?{...item,deliveryFailed:true}:item)})};
    }
    case 'rejected': return {...state,message:state.message||action.message};
    case 'restored': return {...state,pending:null,review:null,proposal:action.text?{text:action.text,revision:-1}:null,messages:[...state.messages,{id:'recovered-user',role:'user',text:action.message},{id:'recovered-assistant',role:'assistant',text:action.reply,...(action.analysisRequest?{analysisRequest:action.analysisRequest}:{})}]};
    case 'review': return !canReviewProposal(state)?state:{...state,review:{proposalId:state.proposal!.id!,revision:state.revision,fingerprint:state.fingerprint,text:state.proposal!.text,requestId:state.proposal!.requestId}};
    case 'appliedReviewed':
    case 'applied': {
      if (!(action.type === 'appliedReviewed' ? canApplyReviewedProposal(state) : canApplyProposal(state))) return state;
      const revision = state.revision + 1;
      // Own application keeps ordinary validity; historical settings-review proof stays unchanged.
      // Reaffirming identical text must not replace a useful Undo with a no-op.
      const undo = action.previous === state.proposal!.text
        ? canUndoProposal(state) ? { ...state.undo!, revision } : null
        : { text: action.previous, revision };
      // Only explicit application can bind the applied text to its current hard context.
      // The anticipated sync may advance compatibility once for our own editor write.
      const appliedReview=action.applicationContext?{context:action.applicationContext,compatibilityRevision:state.compatibilityRevision
        +(state.applicationContext?.compatibilityKey===action.applicationContext.compatibilityKey?0:1)}:undefined;
      return { ...state, mode: 'prompt', review: null, revision, fingerprint: action.fingerprint,
        proposal: { ...state.proposal!, revision, ...(appliedReview?{appliedReview}:{}) }, undo };
    }
    case 'undone': return !canUndoProposal(state) ? state : { ...state, revision: state.revision + 1, fingerprint: action.fingerprint, undo: null, proposal:state.proposal?{...state.proposal,appliedReview:undefined}:null };
  }
}
import {PROMPT_ASSISTANCE_LIVE} from './contract';
