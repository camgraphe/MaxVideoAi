import review from '@/config/video-modify-review.json';

export type VideoWorkflowPreference=Readonly<{
  rank:number; basis:'owner_observation'; reviewedAt:string; scope:string;
}>;

/** An observed preference never grants availability or changes another mode's ranking. */
export function videoWorkflowPreference(engineId:string,mode:string):VideoWorkflowPreference|undefined {
  if(mode!==review.mode)return undefined;
  const index=review.order.indexOf(engineId);
  return index<0?undefined:{rank:index+1,basis:'owner_observation',reviewedAt:review.reviewedAt,scope:review.scope};
}

export function currentVideoWorkflowPreferenceRank(engineId:string,mode:string|undefined,asOf=new Date()):number {
  const preference=mode?videoWorkflowPreference(engineId,mode):undefined;
  if(!preference)return Number.POSITIVE_INFINITY;
  const age=(asOf.getTime()-Date.parse(review.effectiveAt))/86_400_000;
  return age>=0&&age<90?preference.rank:Number.POSITIVE_INFINITY;
}
