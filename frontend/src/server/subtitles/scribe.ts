import {z} from 'zod';
export const SCRIBE_ENDPOINT='fal-ai/elevenlabs/speech-to-text/scribe-v2';
export const scribeSettingsSchema=z.object({language:z.string().min(2).max(24).regex(/^[A-Za-z0-9-]+$/).optional(),keyterms:z.array(z.string().trim().min(1).max(50)).max(100).default([])}).strict();
export type ScribeSettings=z.infer<typeof scribeSettingsSchema>;
export type ScribeDependencies={
  submit:(endpoint:string,input:Record<string,unknown>)=>Promise<{request_id:string}>;
  status:(endpoint:string,requestId:string,signal?:AbortSignal)=>Promise<{status:string}>;
  result:(endpoint:string,requestId:string,signal?:AbortSignal)=>Promise<{data:unknown}>;
};
export class SubtitleProviderRejected extends Error{constructor(message='SUBTITLE_PROVIDER_REJECTED'){super(message);this.name='SubtitleProviderRejected';}}
const defaults:ScribeDependencies={
  // The SDK queue client retries POSTs internally. Paid submission is deliberately one HTTP attempt.
  submit:async(endpoint,input)=>{
    const {ENV}=await import('@/lib/env');
    if(!ENV.FAL_API_KEY)throw new SubtitleProviderRejected('SUBTITLE_PROVIDER_UNAVAILABLE');
    const response=await fetch(`https://queue.fal.run/${endpoint}`,{method:'POST',headers:{Authorization:`Key ${ENV.FAL_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(30_000)});
    if(!response.ok){if([400,401,403,404,422,429].includes(response.status))throw new SubtitleProviderRejected();throw new Error('SUBTITLE_PROVIDER_ACCEPTANCE_UNKNOWN');}
    return response.json();
  },
  status:async(endpoint,requestId,signal)=>(await import('@/lib/fal-client')).getFalClient().queue.status(endpoint,{requestId,logs:false,abortSignal:signal}),
  result:async(endpoint,requestId,signal)=>(await import('@/lib/fal-client')).getFalClient().queue.result(endpoint,{requestId,abortSignal:signal}),
};
export function createScribeAdapter(dependencies:ScribeDependencies=defaults){
  async function submit(input:{audioUrl:string;language?:string;keyterms?:string[]}){
    const {audioUrl,...settings}=input;const parsed=scribeSettingsSchema.parse(settings);const url=new URL(audioUrl);
    if(url.protocol!=='https:'||url.username||url.password)throw new Error('SUBTITLE_AUDIO_URL_INVALID');
    const result=await dependencies.submit(SCRIBE_ENDPOINT,{audio_url:audioUrl,...parsed.language?{language_code:parsed.language}:{},keyterms:parsed.keyterms,diarize:true,tag_audio_events:false});
    if(!result.request_id||result.request_id.length>512)throw new Error('SUBTITLE_PROVIDER_REQUEST_ID_MISSING');
    return {requestId:result.request_id};
  }
  async function poll(requestId:string,signal?:AbortSignal):Promise<{state:'pending'}|{state:'completed';data:unknown}|{state:'failed';message:string}>{
    if(!requestId||requestId.length>512)throw new Error('SUBTITLE_PROVIDER_REQUEST_ID_INVALID');signal?.throwIfAborted();
    const status=await dependencies.status(SCRIBE_ENDPOINT,requestId,signal);
    if(status.status==='IN_QUEUE'||status.status==='IN_PROGRESS')return {state:'pending'};
    if(status.status!=='COMPLETED')throw new Error('SUBTITLE_PROVIDER_STATUS_UNEXPECTED');
    signal?.throwIfAborted();
    try{const result=await dependencies.result(SCRIBE_ENDPOINT,requestId,signal);signal?.throwIfAborted();return {state:'completed',data:result.data};}
    catch(error){if(error&&typeof error==='object'&&'status' in error&&[400,422].includes(Number(error.status)))return {state:'failed',message:'SUBTITLE_PROVIDER_REJECTED'};throw error;}
  }
  return {submit,poll};
}
export const scribeAdapter=createScribeAdapter();
