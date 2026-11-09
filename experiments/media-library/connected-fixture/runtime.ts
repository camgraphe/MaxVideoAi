import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, appendFile, realpath, symlink, rm, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createServer as createPortProbe } from 'node:net';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startDisposablePostgres } from '../../../tests/helpers/disposable-postgres';
import { startStudioAuthFixture } from '../../../tests/helpers/studio-auth-fixture';
import { startStorage } from './s3-service';
import { storageEnvironment, sha } from './s3-signature';
import { prepareSeed, owners } from './seed';
async function port() {
    const server = createPortProbe();
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const result = (server.address() as {
        port: number;
    }).port;
    await new Promise<void>(r => server.close(() => r()));
    return result;
}
async function exited(child: ChildProcess) { return new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); }); }
const failureCleanup: Array<() => Promise<unknown>> = [];
async function main() {
    assert.equal(process.versions.node.split('.')[0], '22');
    const root = resolve('.'), revision = spawnSync('git', ['rev-parse', '--verify', `${process.argv[2] ?? 'HEAD'}^{commit}`], { encoding: 'utf8' }).stdout.trim();
    assert.match(revision, /^[a-f0-9]{40}$/);
    let mode = process.argv.includes('--production') ? 'production' : 'development';
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'library-connected-'));
    failureCleanup.push(() => rm(temporaryRoot, { recursive: true, force: true }));
    const evidenceRoot = resolve(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : join(tmpdir(), 'media-library-evidence'));
    await mkdir(evidenceRoot, { recursive: true });
    const runDir = join(evidenceRoot, `runtime-${revision.slice(0, 10)}-${Date.now()}`);
    await mkdir(runDir);
    const archive = spawn('git', ['archive', '--format=tar', revision], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
    const tar = spawn('tar', ['-x', '-C', temporaryRoot], { stdio: ['pipe', 'ignore', 'inherit'] });
    archive.stdout!.pipe(tar.stdin!);
    const exported = await Promise.all([exited(archive), exited(tar)]);
    exported.forEach(code => assert.equal(code, 0));
    await symlink(await realpath(join(root, 'node_modules')), join(temporaryRoot, 'node_modules'), 'dir');
    await symlink(await realpath(join(root, 'frontend/node_modules')), join(temporaryRoot, 'frontend/node_modules'), 'dir');
    const appPort = await port(), origin = `http://127.0.0.1:${appPort}`;
    const database = await startDisposablePostgres('libqa');
    failureCleanup.push(() => database.cleanup());
    const settings = (await database.pool.query(`SELECT current_setting('server_version_num')::int AS version,current_setting('listen_addresses') AS listeners,current_setting('data_directory') AS directory,current_setting('unix_socket_directories') AS sockets`)).rows[0];
    assert.ok(settings.version >= 170000 && settings.version < 180000);
    assert.equal(settings.listeners, '');
    assert.equal(settings.directory, settings.sockets.replace(/\/socket$/, '/data'));
    const auth = await startStudioAuthFixture({ appOrigin: origin });
    failureCleanup.push(() => auth.close());
    const storage = await startStorage(join(runDir, 'objects'), origin);
    failureCleanup.push(() => storage.close());
    const seedPath = join(runDir, 'seed.json');
    const prepared = await prepareSeed(root, storage, seedPath);
    const initialKeys = new Set(storage.objects.keys());
    const environment = { PATH: `${dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin`, HOME: temporaryRoot, TMPDIR: tmpdir(), NODE_ENV: mode, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: auth.origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: auth.anonKey, NEXT_PUBLIC_SITE_URL: origin, SITE_URL: origin, NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS: 'false', NEXT_PUBLIC_ENV_LABEL: 'Disposable Library verification', DATABASE_URL: database.databaseUrl, ...storageEnvironment, AWS_ENDPOINT_URL_S3: storage.origin };
    const req = createRequire(join(root, 'frontend/package.json'));
    const tsx = createRequire(join(root, 'package.json')).resolve('tsx/cli');
    const setupDirectory = join(temporaryRoot, '.fixture-setup');
    await mkdir(setupDirectory);
    for (const name of ['bootstrap-worker.ts', 'job-fixture.ts', 's3-signature.ts'])
        await copyFile(join(root, 'experiments/media-library/connected-fixture', name), join(setupDirectory, name));
    const worker = join(setupDirectory, 'bootstrap-worker.ts');
    const setup = spawn(process.execPath, [tsx, '--tsconfig', join(temporaryRoot, 'frontend/tsconfig.json'), worker, temporaryRoot, seedPath], { cwd: temporaryRoot, env: { ...environment, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let setupLog = '';
    setup.stdout!.on('data', b => setupLog += b);
    setup.stderr!.on('data', b => setupLog += b);
    const setupCode = await exited(setup);
    await writeFile(join(runDir, 'bootstrap.log'), setupLog);
    if (setupCode !== 0)
        throw new Error(`Schema bootstrap failed; see ${join(runDir, 'bootstrap.log')}`);
    async function refreshPublicManifest() {
        const rows = (await database.pool.query(`SELECT source,url,thumb_url,preview_url,metadata FROM media_assets WHERE status='ready' AND deleted_at IS NULL UNION ALL SELECT 'job-output',COALESCE(storage_url,url),thumb_url,preview_url,metadata FROM job_outputs WHERE status='ready' UNION ALL SELECT source,url,metadata->>'thumbUrl',metadata->>'previewUrl',metadata FROM user_assets`)).rows;
        const publicUrls = new Set<string>(), privateUrls = new Set<string>();
        for (const row of rows)
            for (const url of [row.url, row.thumb_url, row.preview_url, row.metadata?.imageDisplay?.url, row.metadata?.playbackVideoUrl])
                if (typeof url === 'string')
                    (row.source === 'upload' ? privateUrls : publicUrls).add(url);
        const keys = new Set([...storage.objects.keys()].filter(key => { const url = storageEnvironment.S3_PUBLIC_BASE_URL + '/' + key; return publicUrls.has(url) && !privateUrls.has(url); }));
        return storage.setPublicKeys(keys, new Set([...storage.objects.keys()].filter(key => privateUrls.has(storageEnvironment.S3_PUBLIC_BASE_URL + '/' + key))));
    }
    await refreshPublicManifest();
    const controlToken = randomBytes(32).toString('hex');
    const capabilities = new Map<string, 'a' | 'b' | 'empty' | 'guest'>();
    let child: ChildProcess | undefined;
    let closing = false;
    const mint = (account: 'a' | 'b' | 'empty' | 'guest') => { const value = randomBytes(24).toString('hex'); capabilities.set(value, account); return `${origin}/api/fixture-session?cap=${value}`; };
    const control = createServer(async (request, response) => {
        try {
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Cache-Control', 'no-store');
            const send = (status: number, body: unknown) => response.writeHead(status).end(JSON.stringify(body));
            if (request.headers.host !== new URL(controlOrigin).host || request.headers.authorization !== `Bearer ${controlToken}` || request.headers.origin) {
                send(403, { error: 'Forbidden' });
                return;
            }
            let body: any = {};
            try {
                let raw = '';
                for await (const b of request) {
                    raw += b;
                    if (raw.length > 16384)
                        throw new Error('Large');
                }
                body = raw ? JSON.parse(raw) : {};
            }
            catch {
                send(400, { error: 'Invalid body' });
                return;
            }
            const path = new URL(request.url ?? '/', controlOrigin).pathname;
            if (path === '/session/consume' && request.method === 'POST') {
                const account = capabilities.get(body.cap);
                if (!account) {
                    send(410, { error: 'Retired capability' });
                    return;
                }
                capabilities.delete(body.cap);
                const session = account === 'guest' ? null : auth.createSession(owners[account]);
                send(200, { cookies: session ? auth.cookiesFor(session) : [], account });
                return;
            }
            if (path === '/session/mint' && request.method === 'POST' && ['a', 'b', 'empty', 'guest'].includes(body.account)) {
                send(200, { entry: mint(body.account) });
                return;
            }
            if (path === '/storage/fail-next-upload' && request.method === 'POST') {
                if (!['image', 'video', 'audio'].includes(body.kind)) { send(400, {error:'Invalid kind'}); return; }
                storage.failNextUpload(owners.a, body.kind);
                send(200, {ok:true, count:1});
                return;
            }
            if (path === '/storage/control' && request.method === 'POST') {
                if (!storage.objects.has(body.key)) {
                    send(404, { error: 'Unknown registered key' });
                    return;
                }
                if (body.action === 'expire-last') {
                    const fingerprint = storage.lastGrants.get(body.key);
                    if (!fingerprint) {
                        send(409, { error: 'No observed grant' });
                        return;
                    }
                    storage.deniedGrants.add(fingerprint);
                }
                else if (body.action === 'fail')
                    storage.failedKeys.add(body.key);
                else if (body.action === 'restore') {
                    storage.failedKeys.delete(body.key);
                    storage.delays.delete(body.key);
                }
                else if (body.action === 'delay' && Number.isInteger(body.ms) && body.ms >= 0 && body.ms <= 10000)
                    storage.delays.set(body.key, body.ms);
                else {
                    send(400, { error: 'Unknown action' });
                    return;
                }
                send(200, { ok: true });
                return;
            }
            if (path === '/source/add-late' && request.method === 'POST') {
                const row = prepared.seed.assets.find(asset => asset.id === 'fixture-000')!;
                const id = 'fixture-late-001', key = `user-assets/${owners.a}/late-001.webp`, url = storageEnvironment.S3_PUBLIC_BASE_URL + '/' + key;
                if ((await database.pool.query('SELECT 1 FROM media_assets WHERE id=$1', [id])).rowCount) {
                    send(409, { error: 'Late fixture already exists' });
                    return;
                }
                const original = storage.objects.get(new URL(row.url).pathname.slice('/fixture-bucket/'.length))!;
                await storage.put(key, await readFile(original.path), row.mimeType, 'original');
                await database.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,width,height,size_bytes,source,status,metadata,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'upload','ready',$10,now(),now())`, [id, 'ma_' + sha(id).slice(0, 32), owners.a, row.kind, url, row.mimeType, row.width, row.height, row.sizeBytes, JSON.stringify({ fileName: 'Later arriving synthetic source.webp' })]);
                await refreshPublicManifest();
                send(200, { ok: true, id });
                return;
            }
            if (path === '/source/control' && request.method === 'POST') {
                const row = prepared.seed.assets.find(a => a.id === body.id && a.userId === owners.a);
                if (!row) {
                    send(404, { error: 'Unknown source' });
                    return;
                }
                if (body.action === 'unavailable')
                    await database.pool.query("UPDATE media_assets SET status='unavailable' WHERE id=$1 AND user_id=$2", [row.id, owners.a]);
                else if (body.action === 'restore')
                    await database.pool.query("UPDATE media_assets SET status='ready',url=$3 WHERE id=$1 AND user_id=$2", [row.id, owners.a, row.url]);
                else if (body.action === 'replace') {
                    const replacement = prepared.seed.assets.find(a => a.kind === row.kind && a.id !== row.id && a.userId === owners.a)!;
                    await database.pool.query('UPDATE media_assets SET url=$3 WHERE id=$1 AND user_id=$2', [row.id, owners.a, replacement.url]);
                }
                else {
                    send(400, { error: 'Unknown action' });
                    return;
                }
                send(200, { ok: true });
                return;
            }
            if (path === '/app/stop' && request.method === 'POST') {
                await stopApp();
                send(200, { ok: true });
                return;
            }
            if (path === '/app/start' && request.method === 'POST' && ['development', 'production'].includes(body.mode)) {
                await stopApp();
                mode = body.mode;
                startApp();
                send(200, { ok: true, mode });
                return;
            }
            if (path === '/reset' && request.method === 'POST') {
                const tables = (await database.pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
                await database.pool.query('TRUNCATE ' + tables.map(row => '\"' + String(row.tablename).replace(/\"/g, '\"\"') + '\"').join(',') + ' RESTART IDENTITY CASCADE');
                const reset = spawn(process.execPath, [tsx, '--tsconfig', join(temporaryRoot, 'frontend/tsconfig.json'), worker, temporaryRoot, seedPath], { cwd: temporaryRoot, env: { ...environment, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
                let log = '';
                reset.stdout!.on('data', b => log += b);
                reset.stderr!.on('data', b => log += b);
                const code = await exited(reset);
                await writeFile(join(runDir, 'reset.log'), log);
                if (code === 0) {
                    await storage.resetTo(initialKeys);
                    await refreshPublicManifest();
                }
                send(code === 0 ? 200 : 500, { ok: code === 0 });
                return;
            }
            if (path === '/manifest/refresh' && request.method === 'POST') {
                send(200, { ok: true, publicObjects: await refreshPublicManifest() });
                return;
            }
            if (path === '/status') {
                send(200, { revision, mode, origin, pg: settings, objects: storage.objects.size });
                return;
            }
            if (path === '/stop' && request.method === 'POST') {
                send(200, { ok: true });
                setTimeout(() => void close().then(() => process.exit(0)), 100);
                return;
            }
            send(404, { error: 'Unknown control' });
        }
        catch {
            if (!response.headersSent)
                response.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify({ error: 'Fixture control failed' }));
        }
    });
    await new Promise<void>(r => control.listen(0, '127.0.0.1', r));
    const controlOrigin = `http://127.0.0.1:${(control.address() as {
        port: number;
    }).port}`;
    const bootstrapDir = join(temporaryRoot, 'frontend/app/api/fixture-session');
    await mkdir(bootstrapDir, { recursive: true });
    await writeFile(join(bootstrapDir, 'route.ts'), `import {NextRequest,NextResponse} from 'next/server';\nexport async function GET(req:NextRequest){if(req.headers.get('host')!==${JSON.stringify(new URL(origin).host)}|| (req.headers.get('origin') && req.headers.get('origin')!==${JSON.stringify(origin)}))return new NextResponse('Forbidden',{status:403}); const response=await fetch(${JSON.stringify(controlOrigin + '/session/consume')},{method:'POST',headers:{'Content-Type':'application/json',Authorization:${JSON.stringify('Bearer ' + controlToken)}},body:JSON.stringify({cap:req.nextUrl.searchParams.get('cap')}),cache:'no-store'}); if(!response.ok)return new NextResponse('Retired fixture entry',{status:410});const data=await response.json();const result=NextResponse.redirect(new URL('/app/library',${JSON.stringify(origin)}));result.headers.set('Cache-Control','no-store');for(const cookie of req.cookies.getAll()){if(/^sb-127-auth-token(?:\\.\\d+)?$/.test(cookie.name))result.cookies.set(cookie.name,'',{path:'/',sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:0});}for(const cookie of data.cookies)result.cookies.set(cookie.name,cookie.value,{path:'/',sameSite:'lax',secure:process.env.NODE_ENV==='production'});return result;}\n`);
    const logPath = join(runDir, 'next.log');
    let logs = '';
    let pendingLog = '';
    const captureLog = (chunk: Buffer) => {
        pendingLog += chunk.toString();
        const lines = pendingLog.split('\n');
        pendingLog = lines.pop() ?? '';
        for (const line of lines) {
            const safe = line.replace(/((?:GET|POST|HEAD|PUT|DELETE|PATCH) \S+?)\?\S+/g, '$1?<redacted-query>').replace(/(https?:\/\/[^\s"']+?)\?[^\s"']+/g, '$1?<redacted-query>');
            logs = (logs + safe + '\n').slice(-20000);
            void appendFile(logPath, safe + '\n');
        }
    };
    const next = req.resolve('next/dist/bin/next');
    if (mode === 'production')
        throw new Error('Optimized build is not prepared yet; use functional development runtime first.');
    function startApp() { logs = ''; const args = mode === 'development' ? ['--require', join(root, 'tests/helpers/studio-node-realpath.cjs'), next, 'dev'] : [next, 'start']; child = spawn(process.execPath, [...args, '--hostname', '127.0.0.1', '--port', String(appPort)], { cwd: join(temporaryRoot, 'frontend'), env: { ...environment, NODE_ENV: mode, ...(mode === 'development' ? { STUDIO_INTEGRATION_RUNTIME: '1' } : {}) }, stdio: ['ignore', 'pipe', 'pipe'], detached: true }); child.stdout!.on('data', captureLog); child.stderr!.on('data', captureLog); }
    async function stopApp() {
        if (child?.pid && child.exitCode === null && child.signalCode === null) {
            const done = exited(child);
            try {
                process.kill(-child.pid, 'SIGTERM');
            }
            catch { }
            await Promise.race([done, delay(5000)]);
            if (child.exitCode === null && child.signalCode === null)
                try {
                    process.kill(-child.pid, 'SIGKILL');
                }
                catch { }
        }
    }
    startApp();
    async function close() {
        if (closing)
            return;
        closing = true;
        await stopApp();
        control.closeAllConnections();
        await new Promise<void>(r => control.close(() => r()));
        await storage.close();
        await auth.close();
        await database.cleanup();
        await rm(temporaryRoot, { recursive: true, force: true });
    }
    failureCleanup.push(close);
    process.once('SIGINT', () => void close().then(() => process.exit(0)));
    process.once('SIGTERM', () => void close().then(() => process.exit(0)));
    let ready = false;
    for (let i = 0; i < 240; i++) {
        if (child!.exitCode !== null)
            throw new Error(`Next exited: ${logPath}`);
        if (logs.includes('Ready in')) {
            try {
                const r = await fetch(`${origin}/api/media-library/assets`, { signal: AbortSignal.timeout(3000) });
                if (r.status === 401) {
                    ready = true;
                    break;
                }
            }
            catch { }
        }
        await delay(500);
    }
    if (!ready) {
        throw new Error(`No real unauthenticated readiness: ${logPath}`);
    }
    const harnessFiles = ['runtime.ts', 'seed.ts', 's3-service.ts', 's3-signature.ts', 'bootstrap-worker.ts', 'job-fixture.ts', 'optimize-snapshot.ts', 'verify-storage.ts', 'verify-connected.ts', 'verify-readonly.ts'];
    const hashes = Object.fromEntries(await Promise.all(harnessFiles.map(async (name) => [name, sha(await readFile(join(root, 'experiments/media-library/connected-fixture', name)))])));
    const connection = { revision, mode, databaseUrl: database.databaseUrl, origin, controlOrigin, controlToken, bootstrapEntry: mint('a'), owners, runDir, temporaryRoot, manifestPath: storage.manifestPath, storageJournalPath: storage.journalPath, seedPath, seedSha256: prepared.sha256, harnessHashes: hashes, lockSha256: sha(await readFile(join(temporaryRoot, 'pnpm-lock.yaml'))), installedLockSha256: sha(await readFile(join(root, 'pnpm-lock.yaml'))), node: process.version, pg: settings, authOrigin: auth.origin, storageOrigin: storage.origin, controls: ['POST /storage/fail-next-upload {kind:image|video|audio} (owner A, one real content-addressed PUT refused403)', 'POST /session/mint {account:a|b|empty|guest}', 'POST /storage/control {key,action:expire-last|fail|restore|delay,ms?}', 'POST /source/control {id,action:unavailable|restore|replace}', 'POST /source/add-late (one deterministic later arrival)', 'POST /manifest/refresh (SQL-authorized public-resource flags)', 'POST /app/stop', 'POST /app/start {mode:development|production}', 'POST /reset (restores deterministic SQL seed; reload browser afterward)', 'POST /stop'], limits: ['Native generic download is not locally representable.', 'Public synthetic Image/Media bytes require IAB fulfillment from registered manifest.', 'No external providers, payments or production data.'] };
    const connectionPath = join(root, '.superpowers/sdd/2026-11-09-media-library-integration/task-8-connection.json');
    await writeFile(connectionPath, JSON.stringify(connection, null, 2), { mode: 0o600 });
    const { controlToken: _, bootstrapEntry: __, databaseUrl: ___, ...publicConnection } = connection;
    await writeFile(join(runDir, 'runtime-manifest.json'), JSON.stringify(publicConnection, null, 2));
    console.log(`READY ${connectionPath}`);
}
main().catch(async (error) => {
    console.error(error);
    for (const cleanup of failureCleanup.reverse())
        await cleanup().catch(() => undefined);
    process.exit(1);
});
