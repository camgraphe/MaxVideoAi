import {readFile,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {applyPrivateCanvasCleanup,previewPrivateCanvasCleanup} from './_lib/studio-private-canvas-cleanup';

async function main() {
  const args=process.argv.slice(2),value=(key:string)=>args[args.indexOf(key)+1];
  const applying=args.includes('--apply');
  if(!args.includes('--manifest')||!process.env.DATABASE_URL)throw new Error('Use DATABASE_URL and --manifest <path>; preview additionally requires --user <id> --ids <json-file>.');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
  const client=await pool.connect();
  const executor={query:async<T>(sql:string,values?:unknown[])=> (await client.query(sql,values)).rows as T[]};
  try {
    await client.query(applying?'BEGIN ISOLATION LEVEL READ COMMITTED':'BEGIN READ ONLY');
    await client.query("SET LOCAL lock_timeout='2s'");
    await client.query("SET LOCAL statement_timeout='10s'");
    if(applying){
      const plan=JSON.parse(await readFile(value('--manifest'),'utf8'));
      const result=await applyPrivateCanvasCleanup(executor,plan);
      await client.query('COMMIT');console.log(JSON.stringify(result));
    } else {
      if(!args.includes('--user')||!args.includes('--ids'))throw new Error('Preview needs explicit --user and --ids.');
      const projectIds=JSON.parse(await readFile(value('--ids'),'utf8'));
      const plan=await previewPrivateCanvasCleanup(executor,{userId:value('--user'),projectIds});
      await client.query('ROLLBACK');
      await writeFile(value('--manifest'),JSON.stringify(plan,null,2)+'\n',{mode:0o600});
      console.log(JSON.stringify({preview:true,projects:plan.projects.length}));
    }
  } catch(error){await client.query('ROLLBACK');throw error;} finally {client.release();await pool.end();}
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'CANVAS_RETIREMENT_FAILED');process.exitCode=1;});
