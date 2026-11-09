import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { storageEnvironment } from './s3-signature';
async function main() {
    const c = JSON.parse(await readFile(resolve('.superpowers/sdd/2026-11-09-media-library-integration/task-8-connection.json'), 'utf8'));
    const url = new URL(c.databaseUrl);
    assert.equal(url.hostname, 'localhost');
    assert.ok(url.searchParams.get('host')?.includes('/libqa-'));
    url.searchParams.set('options', '-c default_transaction_read_only=on');
    const path = join(c.temporaryRoot, 'fixture-readonly.ts');
    await writeFile(path, `import assert from 'node:assert/strict';import{getDb,query}from'./frontend/src/lib/db';import{browseLibrary}from'./frontend/server/media-library/browse';import{listLibraryAssetPage}from'./frontend/server/media-library/asset-listing';import{listRecentOutputPage}from'./frontend/server/media-library/job-outputs';async function main(){assert.equal((await query('SHOW transaction_read_only'))[0].transaction_read_only,'on');await assert.rejects(query('CREATE TABLE fixture_forbidden_write(id int)'),error=>error.code==='25006');const userId=${JSON.stringify(c.owners.a)};const browse=await browseLibrary({userId,scope:{view:'all',sort:'recent'},limit:30});const saved=await listLibraryAssetPage({userId,limit:30},{ensureSchema:false});const outputs=await listRecentOutputPage({userId,limit:30},{ensureSchema:false});assert.ok(browse.assets.length<=30&&saved.items.length<=30&&outputs.items.length<=30);console.log(JSON.stringify({readOnly:true,browse:browse.assets.length,saved:saved.items.length,outputs:outputs.items.length}));await getDb().end();}main().catch(error=>{console.error(error);process.exitCode=1;});`);
    const req = createRequire(resolve('package.json'));
    const environment = { PATH: `${dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin`, NODE_ENV: 'test', DATABASE_URL: url.toString(), ...storageEnvironment, AWS_ENDPOINT_URL_S3: c.storageOrigin };
    const child = spawn(process.execPath, [req.resolve('tsx/cli'), '--tsconfig', join(c.temporaryRoot, 'frontend/tsconfig.json'), path], { cwd: c.temporaryRoot, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout!.on('data', b => log += b);
    child.stderr!.on('data', b => log += b);
    const code = await new Promise<number | null>((r, j) => { child.once('exit', r); child.once('error', j); });
    await writeFile(join(c.runDir, 'readonly-readers.log'), log);
    await rm(path);
    console.log(log);
    process.exitCode = code ?? 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
