import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import type {StudioAssistantModel} from '../../frontend/src/lib/studio/assistance-contract';

export type StudioLiveRequest={id:string;model:StudioAssistantModel;message:string;referenceKeys?:string[]};
type ReadQueueFile=(path:string,encoding:'utf8')=>Promise<string>;

export function parseStudioLiveRequests(raw:string):StudioLiveRequest[] {
  const requests=JSON.parse(raw) as unknown;
  if(!Array.isArray(requests)||requests.some(r=>!r||typeof r!=='object'
    ||typeof r.id!=='string'||!r.id||typeof r.message!=='string'||!r.message
    ||!['gpt-6.1-sol','gpt-6-luna'].includes(r.model)
    ||(r.referenceKeys!==undefined&&(!Array.isArray(r.referenceKeys)||r.referenceKeys.some((key:unknown)=>typeof key!=='string'||!key)))))
    throw new Error('Invalid live requests');
  return requests;
}

export async function readStudioLiveQueue(path:string,previous:StudioLiveRequest[],requestIndex:number,read:ReadQueueFile=readFile) {
  // The producer appends first, then writes .done. Observe that marker before
  // reading the final queue so completion cannot race an unseen final append.
  let done=false;
  try{await read(path+'.done','utf8');done=true;}catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
  }
  const requests=parseStudioLiveRequests(await read(path,'utf8'));
  if(requests.length<previous.length||previous.some((request,index)=>!isDeepStrictEqual(request,requests[index])))
    throw new Error('Live requests must be append-only; earlier requests cannot be modified or removed.');
  return {requests,drained:done&&requestIndex>=requests.length};
}
