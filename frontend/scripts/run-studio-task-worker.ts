import {runStudioTaskWorkerOnce} from '../src/server/studio/tasks/worker';
import {getDb} from '../src/lib/db';
import {setTimeout} from 'node:timers/promises';
async function main(){
  const once=process.argv.includes('--once');let stopping=false;
  process.once('SIGTERM',()=>{stopping=true;});process.once('SIGINT',()=>{stopping=true;});
  try{do{const handled=await runStudioTaskWorkerOnce();if(once)break;if(!handled&&!stopping)await setTimeout(2000);}while(!stopping);}
  finally{await getDb().end();}
}
main().catch(()=>{console.error('Studio task worker stopped. Inspect the owned task and provider journal before resuming.');process.exitCode=1;});
