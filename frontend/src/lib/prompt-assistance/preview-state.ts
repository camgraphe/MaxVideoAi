export type PreviewMessage = { id: string; role: 'user' | 'assistant'; text: string };
export type PreviewState = {
  scope: string; fingerprint: string; revision: number; mode: 'prompt' | 'milo'; message: string;
  messages: PreviewMessage[];
  pending: { id: number; revision: number } | null;
  proposal: { text: string; revision: number } | null;
  undo: { text: string; revision: number } | null;
};
type Action =
  | { type: 'sync'; scope: string; fingerprint: string; keepMode?:boolean }
  | { type: 'hydrate'; scope:string; fingerprint:string; messages:PreviewMessage[]; message:string; proposal:{text:string;valid:boolean}|null }
  | { type: 'newChat' }
  | { type: 'mode'; mode: PreviewState['mode'] }
  | { type: 'message' | 'edit'; text: string }
  | { type: 'send'; id: number; message: string }
  | { type: 'reply'; id: number; text: string | null; reply: string }
  | { type: 'failed'; id: number; restore?:boolean }
  | { type: 'rejected'; message:string }
  | { type: 'restored'; message: string; text: string | null; reply: string }
  | { type: 'applied'; previous: string; fingerprint: string }
  | { type: 'undone'; fingerprint: string };

export const previewEnabled = (environment: string | undefined, flag: string | undefined) => environment === 'development' && flag === '1';
/** Historical name retained by the shared layout callers. Live mode has its own explicit gate. */
export const PROMPT_ASSISTANCE_PREVIEW = PROMPT_ASSISTANCE_LIVE || previewEnabled(process.env.NODE_ENV, process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_PREVIEW);
export const createPreviewState = (scope: string, fingerprint: string): PreviewState => ({ scope, fingerprint, revision: 0, mode: 'prompt', message: '', messages: [], pending: null, proposal: null, undo: null });
export const canApplyProposal = (state: PreviewState) => Boolean(state.proposal?.text.trim() && state.proposal.revision === state.revision && !state.pending);
export const canUndoProposal = (state: PreviewState) => state.undo !== null && state.undo.revision === state.revision;

export function previewReducer(state: PreviewState, action: Action): PreviewState {
  switch (action.type) {
    case 'sync':
      if (action.scope !== state.scope) return {...createPreviewState(action.scope, action.fingerprint),mode:action.keepMode?state.mode:'prompt'};
      return action.fingerprint === state.fingerprint ? state : { ...state, fingerprint: action.fingerprint, revision: state.revision + 1 };
    case 'mode': return { ...state, mode: action.mode };
    case 'newChat': return {...createPreviewState(state.scope,state.fingerprint),mode:state.mode};
    case 'hydrate': return action.scope!==state.scope?state:{...state,pending:null,undo:null,message:action.message,messages:action.messages,
      proposal:action.proposal?{text:action.proposal.text,revision:action.proposal.valid&&action.fingerprint===state.fingerprint?state.revision:-1}:null};
    case 'message': return { ...state, message: action.text };
    case 'edit': return state.proposal ? { ...state, proposal: { ...state.proposal, text: action.text } } : state;
    case 'send': return state.pending || !action.message.trim() ? state : { ...state, message: '', pending: { id: action.id, revision: state.revision }, messages: [...state.messages, { id: `${action.id}-user`, role: 'user', text: action.message }] };
    case 'reply':
      return state.pending?.id !== action.id ? state : { ...state, pending: null, proposal: action.text ? { text: action.text, revision: state.pending.revision } : state.proposal, messages: [...state.messages, { id: `${action.id}-assistant`, role: 'assistant', text: action.reply }] };
    case 'failed': {
      if(state.pending?.id!==action.id)return state;
      const failedId=`${action.id}-user`;
      return {...state,pending:null,...(action.restore?{message:state.message||state.messages.find(item=>item.id===failedId)?.text||'',messages:state.messages.filter(item=>item.id!==failedId)}:{})};
    }
    case 'rejected': return {...state,message:state.message||action.message};
    case 'restored': return {...state,pending:null,proposal:action.text?{text:action.text,revision:-1}:null,messages:[...state.messages,{id:'recovered-user',role:'user',text:action.message},{id:'recovered-assistant',role:'assistant',text:action.reply}]};
    case 'applied': return !canApplyProposal(state) ? state : { ...state, mode: 'prompt', revision: state.revision + 1, fingerprint: action.fingerprint, undo: { text: action.previous, revision: state.revision + 1 } };
    case 'undone': return !canUndoProposal(state) ? state : { ...state, revision: state.revision + 1, fingerprint: action.fingerprint, undo: null };
  }
}
import {PROMPT_ASSISTANCE_LIVE} from './contract';
