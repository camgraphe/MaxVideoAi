import type {PromptAssistanceResult} from '@/lib/prompt-assistance/contract';
import type {PromptSessionSnapshot} from '@/lib/prompt-assistance/session';

/** Keep pre-deployment tabs' strict decoders usable without rewriting saved evidence or history. */
export function publicPromptResult(result:PromptAssistanceResult,inlineAnalysis:boolean):PromptAssistanceResult {
  if(inlineAnalysis||!result.reply)return result;
  const reply={...result.reply};delete reply.analysisRequest;
  return {...result,reply};
}
export function publicPromptSession(snapshot:PromptSessionSnapshot,inlineAnalysis:boolean):PromptSessionSnapshot {
  if(inlineAnalysis)return snapshot;
  return {...snapshot,turns:snapshot.turns.map(turn=>{
    if(!('analysisRequest' in turn))return turn;
    const legacy={...turn};delete legacy.analysisRequest;return legacy;
  })};
}
