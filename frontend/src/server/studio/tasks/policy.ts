import {studioAssistancePolicy} from '../assistance-policy';
import type {StudioTaskStatus} from '@/lib/studio/task-budget-contract';
export function studioTasksEnabled(env:Readonly<Record<string,string|undefined>>=process.env) {
  const assistance=studioAssistancePolicy(env);
  return env.STUDIO_CONVERSATION_TASKS_ENABLED==='true'&&env.STUDIO_CONVERSATION_ACTIONS_ENABLED==='true'&&assistance.enabled&&assistance.credits===true;
}
export class StudioTaskStop extends Error {
  constructor(public readonly reason:Exclude<NonNullable<StudioTaskStatus['error']>,'cancelled'|'closed'>,message:string){super(message);this.name='StudioTaskStop';}
}
