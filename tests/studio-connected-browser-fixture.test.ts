import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  startStudioConnectedBrowserFixture,
} from './helpers/studio-connected-browser-fixture';
import { startStudioAuthFixture, STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';
import {
  STUDIO_PRIVATE_MEDIA_HOST,
  STUDIO_PRIVATE_MEDIA_KEYS,
  STUDIO_PRIVATE_STORAGE_ENV,
} from './helpers/studio-private-storage-fixture';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const { GetObjectCommand, S3Client } = requireFrontend('@aws-sdk/client-s3') as {
  GetObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
  S3Client: new (config: {
    endpoint: string;
    region: string;
    credentials: { accessKeyId: string; secretAccessKey: string };
    forcePathStyle: boolean;
  }) => { destroy(): void };
};
const { getSignedUrl } = requireFrontend('@aws-sdk/s3-request-presigner') as {
  getSignedUrl(
    client: unknown,
    command: unknown,
    options: { expiresIn: number; signingDate: Date },
  ): Promise<string>;
};

async function startPageServer() {
  const requests: Array<{ host: string | undefined; cookie: string | undefined }> = [];
  const server = createServer((request, response) => {
    requests.push({ host: request.headers.host, cookie: request.headers.cookie });
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><title>Owned browser fixture</title><p>local only</p>');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as AddressInfo).port;
  return {
    origin: `http://127.0.0.1:${port}`,
    browserOrigin: `http://localhost:${port}`,
    requests,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

async function signedFixtureUrl(signingDate: Date): Promise<string> {
  const client = new S3Client({
    endpoint: `https://s3.${STUDIO_PRIVATE_STORAGE_ENV.S3_REGION}.amazonaws.com`,
    region: STUDIO_PRIVATE_STORAGE_ENV.S3_REGION,
    credentials: {
      accessKeyId: STUDIO_PRIVATE_STORAGE_ENV.S3_ACCESS_KEY_ID,
      secretAccessKey: STUDIO_PRIVATE_STORAGE_ENV.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
  });
  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: STUDIO_PRIVATE_STORAGE_ENV.S3_BUCKET,
        Key: STUDIO_PRIVATE_MEDIA_KEYS.a,
      }),
      { expiresIn: 300, signingDate },
    );
  } finally {
    client.destroy();
  }
}

test('owned Chromium contexts isolate sessions, constrain network and validate private bytes', { timeout: 120_000 }, async () => {
  const app = await startPageServer();
  try {
    const foreign = await startPageServer();
    try {
      const auth = await startStudioAuthFixture({ appOrigin: app.browserOrigin });
      try {
        const signedAt = new Date('2026-09-08T12:00:00.000Z');
        const browserFixture = await startStudioConnectedBrowserFixture({
          runtime: { origin: app.origin, browserOrigin: app.browserOrigin, auth },
          signatureClock: () => new Date(signedAt.getTime() + 1_000),
        });
        try {
          const sessionA = auth.createSession(STUDIO_FIXTURE_OWNERS[0]);
          const ownerA = await browserFixture.newContext(sessionA);
          const expectedCookiesA = auth.cookiesFor(sessionA);
          await ownerA.page.goto(app.browserOrigin);
          assert.equal(await ownerA.page.title(), 'Owned browser fixture');
          assert.equal(await ownerA.page.evaluate(() => localStorage.length), 0);
          assert.ok(app.requests.some(({ host, cookie }) => host === new URL(app.browserOrigin).host
            && expectedCookiesA.every(({ name, value }) => cookie?.includes(`${name}=${value}`))));

          assert.equal(await ownerA.page.evaluate(
            async (url) => (await fetch(url)).status,
            `${auth.origin}/auth/v1/.well-known/jwks.json`,
          ), 200);
          assert.equal(await ownerA.page.evaluate(
            async (url) => (await fetch(url)).status,
            app.origin,
          ), 200);

          const signedUrl = await signedFixtureUrl(signedAt);
          const ranged = await ownerA.page.evaluate(async (url) => {
            const response = await fetch(url, { headers: { Range: 'bytes=17-31' } });
            return {
              status: response.status,
              contentRange: response.headers.get('content-range'),
              bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
            };
          }, signedUrl);
          const bytes = await readFile('tests/fixtures/studio-media/pattern-a.mp4');
          assert.equal(ranged.status, 206);
          assert.equal(ranged.contentRange, `bytes 17-31/${bytes.length}`);
          assert.deepEqual(ranged.bytes, [...bytes.subarray(17, 32)]);

          const unsigned = `https://${STUDIO_PRIVATE_MEDIA_HOST}/${STUDIO_PRIVATE_MEDIA_KEYS.a}`;
          assert.equal(await ownerA.page.evaluate(async (url) => (await fetch(url)).status, unsigned), 403);
          await assert.rejects(
            ownerA.page.evaluate(async (url) => (await fetch(url)).status, foreign.origin),
            /Failed to fetch/u,
          );
          assert.equal(foreign.requests.length, 0, 'blocked origins must not reach even a live local server');

          await ownerA.page.evaluate(() => localStorage.setItem('owner-a-only', 'present'));
          await ownerA.close();
          assert.equal(ownerA.page.isClosed(), true);

          const sessionB = auth.createSession(STUDIO_FIXTURE_OWNERS[1]);
          const ownerB = await browserFixture.newContext(sessionB);
          await ownerB.page.goto(app.browserOrigin);
          assert.equal(await ownerB.page.evaluate(() => localStorage.length), 0);
          await ownerB.close();

          assert.deepEqual(browserFixture.readPrivateRequests(), [
            {
              method: 'GET',
              range: 'bytes=17-31',
              status: 206,
              url: `https://${STUDIO_PRIVATE_MEDIA_HOST}/${STUDIO_PRIVATE_MEDIA_KEYS.a}`,
            },
            {
              method: 'GET',
              range: null,
              status: 403,
              url: `https://${STUDIO_PRIVATE_MEDIA_HOST}/${STUDIO_PRIVATE_MEDIA_KEYS.a}`,
            },
          ]);
        } finally {
          await browserFixture.close();
        }
        assert.equal(browserFixture.browser.isConnected(), false);
      } finally {
        await auth.close();
      }
    } finally {
      await foreign.close();
    }
  } finally {
    await app.close();
  }
});
