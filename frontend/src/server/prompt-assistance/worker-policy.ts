import {query,type QueryExecutor} from '@/lib/db';

export const PROMPT_REQUEST_BUDGET_MS=600_000;
export const PROMPT_WORKER_LEASE_MS=180_000;
export const PROMPT_WORKER_HEARTBEAT_MS=30_000;
export const PROMPT_WORKER_GRACE_MS=30_000;
export const PROMPT_WORKER_ATTEMPTS=2;
export const promptWorkersEnabled=()=>process.env.PROMPT_ASSISTANCE_WORKERS_ENABLED==='true';
/** Stable production owner, deployment-scoped Preview owner; no browser input. */
export function promptExecutionOwner(env:NodeJS.ProcessEnv=process.env):string{
  if(env.VERCEL_ENV==='production')return 'production';
  if(env.VERCEL_ENV==='preview'){
    if(!env.VERCEL_DEPLOYMENT_ID)throw new Error('WORKER_UNAVAILABLE');
    return `preview:${env.VERCEL_DEPLOYMENT_ID}`;
  }
  return 'local';
}
/** Read-only preflight. Migration is explicit, never a request-time bootstrap. */
export async function promptWorkersReady(db:QueryExecutor={query}){
  const row=(await db.query<{ready:boolean}>(`SELECT
    (SELECT count(*)=5 FROM pg_attribute WHERE attrelid=to_regclass('public.prompt_assistance_requests')
      AND NOT attisdropped AND attname IN ('execution_version','execution_deadline_at','execution_owner','worker_started_at','worker_attempts'))
    AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.prompt_assistance_requests') AND conname='prompt_assistance_execution_shape')
    AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.prompt_assistance_requests') AND tgname='prompt_assistance_execution_identity' AND tgenabled<>'D') ready`))[0];
  return row?.ready===true;
}
