import {after} from 'next/server';
export type StudioWorkerKind='task'|'analysis';
export type StudioWorkerScope={userId:string;projectId:string;requestId:string};
/** Wake only the saved owned work. Durable cron recovery covers a lost wake-up. */
export function scheduleStudioWorker(kind:StudioWorkerKind,scope:StudioWorkerScope) {
  if(process.env.STUDIO_VERCEL_WORKERS_ENABLED!=='true')return;
  after(async()=>{
    try {
      if(kind==='task')await (await import('./tasks/worker')).runStudioTaskWorkerOnce({scope});
      else await (await import('./media-analysis/worker')).runStudioAnalysisWorkerOnce({scope});
    }catch{console.error('[studio-worker] saved work awaits cron recovery',{kind});}
  });
}
