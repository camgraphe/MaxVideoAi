import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStudioPreviewEnvironment, parseStudioPreviewPort } from './_lib/studio-preview-environment.mjs';

// A local anonymous preview. No inherited database/provider/payment credentials.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'frontend');
const port = parseStudioPreviewPort(process.argv.slice(2));
for (const directory of [root, frontend]) {
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    if (existsSync(path.join(directory, name))) {
      throw new Error(`Preview refuses environment files in ${path.relative(root, directory) || 'root'}.`);
    }
  }
}
if (Number(process.versions.node.split('.')[0]) !== 22) {
  throw new Error('This preview uses the project Node 22 runtime. Run pnpm dlx node@22 scripts/studio-local-preview.mjs.');
}

const authPort = port + 1;
const auth = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', `http://127.0.0.1:${port}`);
  response.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info, x-supabase-api-version');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }
  response.writeHead(401, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ code: 'session_not_found', message: 'Anonymous local Studio preview.' }));
});
await new Promise((resolve, reject) => {
  auth.once('error', reject);
  auth.listen(authPort, '127.0.0.1', resolve);
});

const require = createRequire(import.meta.url);
const next = require.resolve('next/dist/bin/next', { paths: [frontend] });
const environment = createStudioPreviewEnvironment({ port, executable: process.execPath, inherited: process.env });
const child = spawn(process.execPath, [next, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: frontend,
  env: environment,
  stdio: 'inherit',
});
console.log(`Anonymous Studio preview: http://127.0.0.1:${port}/app/studio/projects`);
console.log('Local browser storage only; database, generation, payment and storage services are unconfigured.');
let closing = false;
function close(signal = 'SIGTERM') {
  if (closing) return;
  closing = true;
  child.kill(signal);
  auth.close();
}
process.on('SIGINT', () => close('SIGINT'));
process.on('SIGTERM', () => close());
child.once('error', (error) => {
  console.error(error.message);
  close();
  process.exitCode = 1;
});
child.once('exit', (code) => {
  auth.close();
  process.exitCode = code ?? 0;
});
