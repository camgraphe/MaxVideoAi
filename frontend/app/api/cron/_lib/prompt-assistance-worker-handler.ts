import type {NextRequest} from 'next/server';
import {authorizeCronRequest} from '@/server/vercel-cron';

export async function handlePromptAssistanceWorkerCron(req:NextRequest,dependencies:{env?:NodeJS.ProcessEnv;run?:()=>Promise<boolean>}={}){
  const env=dependencies.env??process.env;
  if(!env.CRON_SECRET?.trim()||!authorizeCronRequest(req.headers,{cronSecret:env.CRON_SECRET,vercelEnv:env.VERCEL,deploymentId:env.VERCEL_DEPLOYMENT_ID}).ok)
    return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401});
  if(env.PROMPT_ASSISTANCE_WORKERS_ENABLED!=='true')return Response.json({ok:true,enabled:false,handled:false});
  // Preview wakeups are scoped to their own deployment's admissions. Its cron
  // must not consume the shared production queue while a candidate is reviewed.
  if(env.VERCEL_ENV==='preview')return Response.json({ok:true,enabled:true,handled:false,reason:'PREVIEW_WAKEUP_ONLY'});
  try{
    const run=dependencies.run??(await import('@/server/prompt-assistance/worker')).runPromptAssistanceWorkerOnce;
    return Response.json({ok:true,enabled:true,handled:await run()});
  }catch{return Response.json({ok:false,error:'PROMPT_WORKER_UNAVAILABLE'},{status:503});}
}
