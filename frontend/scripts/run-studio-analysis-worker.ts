import {runStudioAnalysisWorkerOnce} from '../src/server/studio/media-analysis/worker';
import {getDb} from '../src/lib/db';
import {setTimeout} from 'node:timers/promises';

async function main(){
  const once=process.argv.includes('--once');let stopping=false;
  process.once('SIGTERM',()=>{stopping=true;});process.once('SIGINT',()=>{stopping=true;});
  try{do{const processed=await runStudioAnalysisWorkerOnce();if(once)break;if(!processed&&!stopping)await setTimeout(2000);}while(!stopping);}
  finally{await getDb().end();}
}
main().catch(()=>{console.error('Studio analysis worker stopped. Inspect the durable analysis state before retrying.');process.exitCode=1;});
