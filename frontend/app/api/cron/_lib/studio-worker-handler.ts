import type {NextRequest} from 'next/server';
import type {StudioWorkerKind} from '@/server/studio/worker-host';
import {authorizeCronRequest} from '@/server/vercel-cron';
export async function handleStudioWorkerCron(req:NextRequest,kind:StudioWorkerKind,dependencies:{env?:NodeJS.ProcessEnv;run?:()=>Promise<boolean>}={}) {
  const env=dependencies.env??process.env;
  if(!env.CRON_SECRET?.trim()||!authorizeCronRequest(req.headers,{cronSecret:env.CRON_SECRET,vercelEnv:env.VERCEL,deploymentId:env.VERCEL_DEPLOYMENT_ID}).ok)
    return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401});
  if(env.STUDIO_VERCEL_WORKERS_ENABLED!=='true')return Response.json({ok:true,enabled:false,handled:false});
  try {
    const run=dependencies.run??(kind==='task'?(await import('@/server/studio/tasks/worker')).runStudioTaskWorkerOnce:(await import('@/server/studio/media-analysis/worker')).runStudioAnalysisWorkerOnce);
    return Response.json({ok:true,enabled:true,handled:await run()});
  }catch{return Response.json({ok:false,error:'STUDIO_WORKER_UNAVAILABLE'},{status:503});}
}
