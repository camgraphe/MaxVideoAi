import {AgentApiError} from '@/server/agent-api/errors';
import type {StudioActionResult} from '@/lib/studio/conversation-action-contract';

type SelectionErrorCode='PARAMETER_INVALID'|'ENGINE_UNAVAILABLE'|'REFERENCE_INVALID';
const selectionCodes:readonly string[]=['PARAMETER_INVALID','ENGINE_UNAVAILABLE','REFERENCE_INVALID'];

/** Only explicit input-validation boundaries may produce this durable correction receipt. */
export class StudioPreparationInputError extends AgentApiError {
  constructor(code:SelectionErrorCode,message:string) {
    super(code,message,false,{type:'studio_preparation_input',version:1});
  }
}

/** Call only around synchronous selection validation, never catalog/ownership reads or mutations. */
export function validateStudioPreparationInput<T>(validate:()=>T):T {
  try{return validate();}catch(error){
    if(error instanceof AgentApiError&&selectionCodes.includes(error.code)&&!error.retryable&&!error.nextAction)
      throw new StudioPreparationInputError(error.code as SelectionErrorCode,error.message);
    throw error;
  }
}

export function isStudioPreparationCorrection(result:StudioActionResult):boolean {
  return !result.ok&&['image.prepare','video.prepare','voice.prepare','music.prepare','audio.prepare'].includes(result.action)
    &&selectionCodes.includes(result.error.code)&&result.error.retryable===false
    &&result.error.nextAction?.type==='studio_preparation_input'&&result.error.nextAction.version===1;
}
