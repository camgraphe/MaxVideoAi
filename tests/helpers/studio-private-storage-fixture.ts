import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { STUDIO_FIXTURE_OWNERS } from './studio-auth-fixture';
import { studioMediaByteResponse } from './studio-media-byte-fixture';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const { GetObjectCommand, S3Client } = requireFrontend('@aws-sdk/client-s3') as {
  GetObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
  S3Client: new (config: {
    endpoint: string;
    region: string;
    credentials: { accessKeyId: string; secretAccessKey: string };
    forcePathStyle: boolean;
  }) => unknown;
};
const { getSignedUrl } = requireFrontend('@aws-sdk/s3-request-presigner') as {
  getSignedUrl(
    client: unknown,
    command: unknown,
    options: { expiresIn: number; signingDate: Date },
  ): Promise<string>;
};

export const STUDIO_PRIVATE_STORAGE_ENV = Object.freeze({
  S3_BUCKET: 'maxvideoai-studio-private-fixture',
  S3_REGION: 'eu-west-3',
  S3_ACCESS_KEY_ID: 'STUDIOFIXTUREACCESSKEY',
  S3_SECRET_ACCESS_KEY: 'studio-fixture-secret-that-is-not-a-real-credential',
} as const);

const FIXTURE_ENDPOINT = `https://s3.${STUDIO_PRIVATE_STORAGE_ENV.S3_REGION}.amazonaws.com`;
export const STUDIO_PRIVATE_MEDIA_HOST =
  `${STUDIO_PRIVATE_STORAGE_ENV.S3_BUCKET}.s3.${STUDIO_PRIVATE_STORAGE_ENV.S3_REGION}.amazonaws.com`;

export const STUDIO_PRIVATE_MEDIA_KEYS = Object.freeze({
  a: `media-assets/${STUDIO_FIXTURE_OWNERS[0]}/studio-private/pattern-a.mp4`,
  b: `media-assets/${STUDIO_FIXTURE_OWNERS[0]}/studio-private/pattern-b.mp4`,
  foreign: `media-assets/${STUDIO_FIXTURE_OWNERS[1]}/studio-private/pattern-b.mp4`,
} as const);

type FixtureKey = typeof STUDIO_PRIVATE_MEDIA_KEYS[keyof typeof STUDIO_PRIVATE_MEDIA_KEYS];
type ValidationFailureReason = 'method' | 'url' | 'host' | 'key' | 'query' | 'date' | 'expiry' | 'expired' | 'signature';
export type StudioPrivateStorageValidation =
  | { ok: true; key: FixtureKey; expiresAt: Date }
  | { ok: false; reason: ValidationFailureReason };
export type StudioPrivateStorageFixtureResponse = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

const MAX_EXPIRY_SECONDS = 3_600;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
const FIXTURE_PATH_BY_KEY: Readonly<Record<FixtureKey, string>> = Object.freeze({
  [STUDIO_PRIVATE_MEDIA_KEYS.a]: resolve('tests/fixtures/studio-media/pattern-a.mp4'),
  [STUDIO_PRIVATE_MEDIA_KEYS.b]: resolve('tests/fixtures/studio-media/pattern-b.mp4'),
  [STUDIO_PRIVATE_MEDIA_KEYS.foreign]: resolve('tests/fixtures/studio-media/pattern-b.mp4'),
});
const KNOWN_KEYS = new Set<FixtureKey>(Object.keys(FIXTURE_PATH_BY_KEY) as FixtureKey[]);
const verificationClient = new S3Client({
  endpoint: FIXTURE_ENDPOINT,
  region: STUDIO_PRIVATE_STORAGE_ENV.S3_REGION,
  credentials: {
    accessKeyId: STUDIO_PRIVATE_STORAGE_ENV.S3_ACCESS_KEY_ID,
    secretAccessKey: STUDIO_PRIVATE_STORAGE_ENV.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

function parseUtcSigningDate(value: string): Date | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u);
  if (!match) return null;
  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  ));
  const canonical = `${date.getUTCFullYear().toString().padStart(4, '0')}`
    + `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`
    + `${date.getUTCDate().toString().padStart(2, '0')}T`
    + `${date.getUTCHours().toString().padStart(2, '0')}`
    + `${date.getUTCMinutes().toString().padStart(2, '0')}`
    + `${date.getUTCSeconds().toString().padStart(2, '0')}Z`;
  return Number.isFinite(date.getTime()) && canonical === value ? date : null;
}

function uniqueQuery(url: URL): Map<string, string> | null {
  const query = new Map<string, string>();
  for (const [name, value] of url.searchParams) {
    if (query.has(name)) return null;
    query.set(name, value);
  }
  return query;
}

function sameQuery(actual: Map<string, string>, expected: Map<string, string>): boolean {
  if (actual.size !== expected.size) return false;
  for (const [name, value] of expected) {
    if (actual.get(name) !== value) return false;
  }
  return true;
}

/**
 * Validates only a short-lived GetObject URL without response overrides/download filename.
 * Account/session authorization stays in the product route.
 */
export async function validateStudioPrivateMediaRequest(input: {
  url: string;
  method: string;
  now?: Date;
}): Promise<StudioPrivateStorageValidation> {
  if (input.method !== 'GET') return { ok: false, reason: 'method' };
  let actualUrl: URL;
  try {
    actualUrl = new URL(input.url);
  } catch {
    return { ok: false, reason: 'url' };
  }
  if (actualUrl.protocol !== 'https:'
    || actualUrl.host !== STUDIO_PRIVATE_MEDIA_HOST
    || actualUrl.username
    || actualUrl.password
    || actualUrl.hash) {
    return { ok: false, reason: 'host' };
  }

  const encodedKey = actualUrl.pathname.startsWith('/') ? actualUrl.pathname.slice(1) : '';
  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    return { ok: false, reason: 'key' };
  }
  if (!KNOWN_KEYS.has(key as FixtureKey) || actualUrl.pathname !== `/${key}`) {
    return { ok: false, reason: 'key' };
  }

  const actualQuery = uniqueQuery(actualUrl);
  if (!actualQuery || actualQuery.size === 0) return { ok: false, reason: 'query' };
  const rawSigningDate = actualQuery.get('X-Amz-Date');
  const rawExpiry = actualQuery.get('X-Amz-Expires');
  if (rawSigningDate === undefined || rawExpiry === undefined) return { ok: false, reason: 'query' };
  const signedAt = parseUtcSigningDate(rawSigningDate);
  const now = input.now ?? new Date();
  if (!signedAt || !(now instanceof Date) || !Number.isFinite(now.getTime())
    || signedAt.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS) {
    return { ok: false, reason: 'date' };
  }
  if (!/^[1-9]\d*$/u.test(rawExpiry)) return { ok: false, reason: 'expiry' };
  const expiresInSeconds = Number(rawExpiry);
  if (!Number.isSafeInteger(expiresInSeconds)
    || expiresInSeconds < 1
    || expiresInSeconds > MAX_EXPIRY_SECONDS) {
    return { ok: false, reason: 'expiry' };
  }
  const expiresAt = new Date(signedAt.getTime() + expiresInSeconds * 1_000);
  if (expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' };

  const expectedUrl = new URL(await getSignedUrl(
    verificationClient,
    new GetObjectCommand({ Bucket: STUDIO_PRIVATE_STORAGE_ENV.S3_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds, signingDate: signedAt },
  ));
  const expectedQuery = uniqueQuery(expectedUrl);
  if (!expectedQuery) throw new Error('Studio private storage SDK produced duplicate query fields.');
  if (!sameQuery(actualQuery, expectedQuery)) {
    const sameNames = actualQuery.size === expectedQuery.size
      && [...expectedQuery.keys()].every((name) => actualQuery.has(name));
    return { ok: false, reason: sameNames ? 'signature' : 'query' };
  }
  return { ok: true, key: key as FixtureKey, expiresAt };
}

function refusal(status: 403 | 405): StudioPrivateStorageFixtureResponse {
  return {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'content-length': '0',
      ...(status === 405 ? { allow: 'GET' } : {}),
    },
    body: Buffer.alloc(0),
  };
}

export async function serveStudioPrivateMediaRequest(input: {
  url: string;
  method: string;
  range?: string | null;
  now?: Date;
}): Promise<StudioPrivateStorageFixtureResponse> {
  const validation = await validateStudioPrivateMediaRequest(input);
  if (!validation.ok) return refusal(validation.reason === 'method' ? 405 : 403);
  const bytes = await readFile(FIXTURE_PATH_BY_KEY[validation.key]);
  return studioMediaByteResponse(bytes, { method: 'GET', range: input.range });
}
