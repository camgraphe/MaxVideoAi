/** Explicit, guarded setup for an already-retained fixture; never a product read path. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { completeFixtureJobs } from './job-fixture';
import { storageEnvironment } from './s3-signature';
async function main() {
  if(process.argv[2]==='--worker') {
    const [root,seedPath,reportPath]=process.argv.slice(3);
    const db=await import(pathToFileURL(join(root,'frontend/src/lib/db.ts')).href);
    try {const result=await completeFixtureJobs(root,JSON.parse(await readFile(seedPath,'utf8')),db,reportPath);console.log(JSON.stringify({jobs:result.jobs.length,inputSha256:result.inputSha256}));}
    finally {await db.getDb().end();}
    return;
  }
  const path=resolve(process.argv[2]??'.superpowers/sdd/2026-11-09-media-library-integration/task-8-connection-baseline.json');
  const c=JSON.parse(await readFile(path,'utf8')),url=new URL(c.databaseUrl);
  assert.equal(url.hostname,'localhost');assert.ok(url.searchParams.get('host')?.includes('/libqa-'));
  assert.match(c.temporaryRoot,/\/library-connected-[^/]+$/);
  const req=createRequire(resolve('package.json'));
  const child=spawnSync(process.execPath,[req.resolve('tsx/cli'),'--tsconfig',join(c.temporaryRoot,'frontend/tsconfig.json'),resolve('experiments/media-library/connected-fixture/complete-jobs.ts'),'--worker',c.temporaryRoot,c.seedPath,join(c.runDir,'jobs-complement.json')],{cwd:c.temporaryRoot,encoding:'utf8',env:{PATH:`${dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin`,NODE_ENV:'test',DATABASE_URL:c.databaseUrl,...storageEnvironment,AWS_ENDPOINT_URL_S3:c.storageOrigin}});
  process.stdout.write(child.stdout);process.stderr.write(child.stderr);process.exitCode=child.status??1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
