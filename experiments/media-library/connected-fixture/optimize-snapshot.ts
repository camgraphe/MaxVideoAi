/** Build an existing owned fixture snapshot. No browser, deployments or source rewrites. */
import { spawn } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { storageEnvironment } from './s3-signature';
async function main() {
    const connectionPath = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? '.superpowers/sdd/2026-11-09-media-library-integration/task-8-connection.json');
    const startAfterBuild = !process.argv.includes('--no-start');
    const connection = JSON.parse(await readFile(connectionPath, 'utf8'));
    assert.match(connection.temporaryRoot, /\/library-connected-[^/]+$/);
    // Stop only the runner-owned app; PG, auth, storage and controls stay intact.
    const stop = await fetch(connection.controlOrigin + '/app/stop', { method: 'POST', headers: { Authorization: `Bearer ${connection.controlToken}` } });
    assert.equal(stop.status, 200, 'Owned app must stop before build');
    const environment = { PATH: `${dirname(process.execPath)}:/opt/homebrew/bin:/usr/bin:/bin`, HOME: connection.temporaryRoot, TMPDIR: process.env.TMPDIR ?? '/tmp', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: connection.authOrigin, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'studio-disposable-auth-fixture-anon', NEXT_PUBLIC_SITE_URL: connection.origin, SITE_URL: connection.origin, NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS: 'false', NEXT_PUBLIC_ENV_LABEL: 'Disposable Library verification', DATABASE_URL: connection.databaseUrl, ...storageEnvironment, AWS_ENDPOINT_URL_S3: connection.storageOrigin };
    if (!connection.databaseUrl)
        throw new Error('The private connection file must include its disposable socket database URL.');
    const configPath = join(connection.temporaryRoot, 'frontend/next.config.js');
    const config = await readFile(configPath, 'utf8');
    // Do not run concurrently with a dev instance sharing .next. The runner must stop it first.
    const logPath = join(connection.runDir, 'build.log');
    const child = spawn('npm', ['run', 'build'], { cwd: join(connection.temporaryRoot, 'frontend'), env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout!.on('data', b => void appendFile(logPath, b));
    child.stderr!.on('data', b => void appendFile(logPath, b));
    const code = await new Promise<number | null>((r, j) => { child.once('exit', r); child.once('error', j); });
    await writeFile(join(connection.runDir, 'build-result.json'), JSON.stringify({ command: 'npm run build', exitCode: code, node: process.version, mode: 'production', startAfterBuild, gates: 'normal prebuild/lint/types/postbuild', source: connection.revision, configUnchanged: config === (await readFile(configPath, 'utf8')) }, null, 2));
    if (code === 0 && startAfterBuild) {
        const started = await fetch(connection.controlOrigin + '/app/start', { method: 'POST', headers: { Authorization: `Bearer ${connection.controlToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'production' }) });
        assert.equal(started.status, 200);
        connection.mode = 'production';
        await writeFile(connectionPath, JSON.stringify(connection, null, 2), { mode: 0o600 });
    }
    console.log(`Build exit ${code}; ${logPath}`);
    process.exitCode = code ?? 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
