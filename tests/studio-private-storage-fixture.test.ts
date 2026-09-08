import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import {
  STUDIO_PRIVATE_MEDIA_HOST,
  STUDIO_PRIVATE_MEDIA_KEYS,
  STUDIO_PRIVATE_STORAGE_ENV,
  serveStudioPrivateMediaRequest,
  validateStudioPrivateMediaRequest,
} from './helpers/studio-private-storage-fixture';
import { STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const tsxLoader = requireFrontend.resolve('tsx');

type ProductionSignature = {
  url: string;
  ownedForOwner: string | null;
  ownedForOtherOwner: string | null;
};

async function signWithProduction(
  key: string,
  owner: string,
  expiresInSeconds = 300,
): Promise<ProductionSignature> {
  const source = `
    import storage from './frontend/server/storage.ts';
    const { createSignedDownloadUrl, ownedMediaStorageKeyForUrl } = storage;
    const keepAlive = setInterval(() => undefined, 1_000);
    void (async () => {
      const key = process.env.STUDIO_FIXTURE_KEY;
      const owner = process.env.STUDIO_FIXTURE_OWNER;
      const otherOwner = process.env.STUDIO_FIXTURE_OTHER_OWNER;
      const expires = process.env.STUDIO_FIXTURE_EXPIRES;
      if (!key || !owner || !otherOwner || !expires) throw new Error('Missing isolated fixture input.');
      const url = await createSignedDownloadUrl(key, { expiresInSeconds: Number(expires) });
      process.stdout.write(JSON.stringify({
        url,
        ownedForOwner: ownedMediaStorageKeyForUrl({ url, userId: owner }),
        ownedForOtherOwner: ownedMediaStorageKeyForUrl({ url, userId: otherOwner }),
      }));
    })().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    }).finally(() => clearInterval(keepAlive));
  `;
  const otherOwner = owner === STUDIO_FIXTURE_OWNERS[0]
    ? STUDIO_FIXTURE_OWNERS[1]
    : STUDIO_FIXTURE_OWNERS[0];
  const child = spawn(
    process.execPath,
    ['--import', tsxLoader, '--input-type=module', '--eval', source],
    {
      cwd: resolve('.'),
      env: {
        PATH: dirname(process.execPath),
        NODE_ENV: 'test',
        NODE_PATH: resolve('frontend/node_modules'),
        TSX_TSCONFIG_PATH: resolve('frontend/tsconfig.json'),
        AWS_EC2_METADATA_DISABLED: 'true',
        STUDIO_FIXTURE_KEY: key,
        STUDIO_FIXTURE_OWNER: owner,
        STUDIO_FIXTURE_OTHER_OWNER: otherOwner,
        STUDIO_FIXTURE_EXPIRES: String(expiresInSeconds),
        ...STUDIO_PRIVATE_STORAGE_ENV,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (value) => { stdout += value.toString(); });
  child.stderr.on('data', (value) => { stderr += value.toString(); });
  const code = await new Promise<number | null>((resolveExit, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(() => reject(new Error('Production storage signer exceeded 30 seconds.')));
    }, 30_000);
    child.once('error', (error) => finish(() => reject(error)));
    child.once('exit', (exitCode) => finish(() => resolveExit(exitCode)));
  });
  assert.equal(code, 0, stderr);
  return JSON.parse(stdout) as ProductionSignature;
}

function signingDate(url: string): Date {
  const value = new URL(url).searchParams.get('X-Amz-Date');
  assert.match(value ?? '', /^\d{8}T\d{6}Z$/u);
  return new Date(`${value!.slice(0, 4)}-${value!.slice(4, 6)}-${value!.slice(6, 8)}T${value!.slice(9, 11)}:${value!.slice(11, 13)}:${value!.slice(13, 15)}Z`);
}

function mutate(value: string): string {
  return `${value[0] === 'a' ? 'b' : 'a'}${value.slice(1)}`;
}

test('accepts a real production GET token for a known object and serves exact bytes and ranges', async () => {
  const key = STUDIO_PRIVATE_MEDIA_KEYS.a;
  const signed = await signWithProduction(key, STUDIO_FIXTURE_OWNERS[0]);
  const parsed = new URL(signed.url);
  assert.equal(parsed.protocol, 'https:');
  assert.equal(parsed.host, STUDIO_PRIVATE_MEDIA_HOST);
  assert.equal(signed.ownedForOwner, key);
  assert.equal(signed.ownedForOtherOwner, null);

  const now = new Date(signingDate(signed.url).getTime() + 1_000);
  const validation = await validateStudioPrivateMediaRequest({ url: signed.url, method: 'GET', now });
  assert.deepEqual(validation, {
    ok: true,
    key,
    expiresAt: new Date(signingDate(signed.url).getTime() + 300_000),
  });

  const expected = await readFile('tests/fixtures/studio-media/pattern-a.mp4');
  const full = await serveStudioPrivateMediaRequest({ url: signed.url, method: 'GET', now });
  assert.equal(full.status, 200);
  assert.deepEqual(full.body, expected);

  const ranged = await serveStudioPrivateMediaRequest({
    url: signed.url,
    method: 'GET',
    range: 'bytes=17-31',
    now,
  });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers['content-range'], `bytes 17-31/${expected.length}`);
  assert.deepEqual(ranged.body, expected.subarray(17, 32));
});

test('treats the signed URL as an object token while production key extraction keeps owners distinct', async () => {
  const key = STUDIO_PRIVATE_MEDIA_KEYS.foreign;
  const signed = await signWithProduction(key, STUDIO_FIXTURE_OWNERS[1]);
  assert.equal(signed.ownedForOwner, key);
  assert.equal(signed.ownedForOtherOwner, null);
  const validation = await validateStudioPrivateMediaRequest({
    url: signed.url,
    method: 'GET',
    now: new Date(signingDate(signed.url).getTime() + 1_000),
  });
  assert.equal(validation.ok, true);
  if (validation.ok) assert.equal(validation.key, key);
});

test('rejects unsigned, tampered, duplicate, unknown, foreign and non-GET requests', async () => {
  const key = STUDIO_PRIVATE_MEDIA_KEYS.a;
  const { url } = await signWithProduction(key, STUDIO_FIXTURE_OWNERS[0]);
  const signedAt = signingDate(url);
  const now = new Date(signedAt.getTime() + 1_000);
  const cases: Array<{ name: string; url: string; method?: string; reason: string }> = [];

  const unsigned = new URL(url);
  unsigned.search = '';
  cases.push({ name: 'unsigned', url: unsigned.href, reason: 'query' });

  const tamperedKey = new URL(url);
  tamperedKey.pathname = `/${STUDIO_PRIVATE_MEDIA_KEYS.b}`;
  cases.push({ name: 'tampered key', url: tamperedKey.href, reason: 'signature' });

  const unknownKey = new URL(url);
  unknownKey.pathname = `/media-assets/${STUDIO_FIXTURE_OWNERS[0]}/studio-private/not-a-fixture.mp4`;
  cases.push({ name: 'unknown key', url: unknownKey.href, reason: 'key' });

  const tamperedQuery = new URL(url);
  tamperedQuery.searchParams.set('X-Amz-Expires', '301');
  cases.push({ name: 'tampered query', url: tamperedQuery.href, reason: 'signature' });

  const tamperedSignature = new URL(url);
  const changedSignature = mutate(tamperedSignature.searchParams.get('X-Amz-Signature')!);
  assert.match(changedSignature, /^[a-f0-9]{64}$/u);
  tamperedSignature.searchParams.set('X-Amz-Signature', changedSignature);
  cases.push({ name: 'tampered signature', url: tamperedSignature.href, reason: 'signature' });

  const duplicated = new URL(url);
  duplicated.searchParams.append('X-Amz-Date', duplicated.searchParams.get('X-Amz-Date')!);
  cases.push({ name: 'duplicate query', url: duplicated.href, reason: 'query' });

  const unknown = new URL(url);
  unknown.searchParams.set('ignored', 'true');
  cases.push({ name: 'unknown query', url: unknown.href, reason: 'query' });

  const foreignHost = new URL(url);
  foreignHost.hostname = 'foreign.invalid';
  cases.push({ name: 'foreign host', url: foreignHost.href, reason: 'host' });

  const insecure = new URL(url);
  insecure.protocol = 'http:';
  cases.push({ name: 'insecure protocol', url: insecure.href, reason: 'host' });

  const invalidDate = new URL(url);
  invalidDate.searchParams.set('X-Amz-Date', '20261340T250000Z');
  cases.push({ name: 'invalid UTC date', url: invalidDate.href, reason: 'date' });

  cases.push({ name: 'HEAD from signed GET', url, method: 'HEAD', reason: 'method' });

  for (const entry of cases) {
    const result = await validateStudioPrivateMediaRequest({
      url: entry.url,
      method: entry.method ?? 'GET',
      now,
    });
    assert.deepEqual(result, { ok: false, reason: entry.reason }, entry.name);
  }

  const refusedHead = await serveStudioPrivateMediaRequest({ url, method: 'HEAD', now });
  assert.equal(refusedHead.status, 405);
  assert.equal(refusedHead.headers.allow, 'GET');
  assert.equal(refusedHead.body.length, 0);
  const refusedTamper = await serveStudioPrivateMediaRequest({ url: tamperedSignature.href, method: 'GET', now });
  assert.equal(refusedTamper.status, 403);
  assert.equal(refusedTamper.body.length, 0);
});

test('rejects expired and overlong production signatures', async () => {
  const key = STUDIO_PRIVATE_MEDIA_KEYS.a;
  const short = await signWithProduction(key, STUDIO_FIXTURE_OWNERS[0], 1);
  assert.deepEqual(await validateStudioPrivateMediaRequest({
    url: short.url,
    method: 'GET',
    now: new Date(signingDate(short.url).getTime() + 1_000),
  }), { ok: false, reason: 'expired' });

  const future = await signWithProduction(key, STUDIO_FIXTURE_OWNERS[0]);
  assert.deepEqual(await validateStudioPrivateMediaRequest({
    url: future.url,
    method: 'GET',
    now: new Date(signingDate(future.url).getTime() - 300_001),
  }), { ok: false, reason: 'date' });

  const overlong = await signWithProduction(key, STUDIO_FIXTURE_OWNERS[0], 7_200);
  assert.deepEqual(await validateStudioPrivateMediaRequest({
    url: overlong.url,
    method: 'GET',
    now: new Date(signingDate(overlong.url).getTime() + 1_000),
  }), { ok: false, reason: 'expiry' });
});
