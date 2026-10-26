import { createHash } from 'node:crypto';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';

export type PrivateSourceTarget = { bucket: string; region: string };
export type PrivateSourcePorts = {
  target: PrivateSourceTarget;
  sign(key: string, options: { method: 'GET'; expiresInSeconds: number }): Promise<string>;
  now?: () => number;
  close?: () => void;
};
export type BoundPrivateReference = { slotId: string; key: string; sha256: string; size: number; mime: string };
const fail = (code: string): never => { throw new Error('IMPORT_NINE01_' + code); };
/** Separate explicit source credentials; never swap or infer the owned-media storage environment. */
export function createNine01PrivateSourcePorts(raw: unknown): PrivateSourcePorts {
  const parsed = z.object({ bucket: z.string(), region: z.string(), accessKeyId: z.string().regex(/^[A-Z0-9]{16,128}$/),
    secretAccessKey: z.string().min(16).max(4096) }).safeParse(raw);
  if (!parsed.success) return fail('SOURCE_CONFIG');
  const config = parsed.data, target = { bucket: config.bucket, region: config.region };
  privateSourceTargetFingerprint(target);
  const client = new S3Client({ region: target.region, endpoint: `https://s3.${target.region}.amazonaws.com`, forcePathStyle: false,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }, maxAttempts: 1 });
  return { target,
    async sign(key, options) {
      if (options.method !== 'GET' || options.expiresInSeconds !== 300) return fail('SOURCE_SIGN');
      try { return await getSignedUrl(client, new GetObjectCommand({ Bucket: target.bucket, Key: key }), { expiresIn: 300 }); }
      catch { return fail('SOURCE_SIGN'); }
    },
    close: () => client.destroy(),
  };
}
export function privateSourceTargetFingerprint(target: PrivateSourceTarget): string {
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(target.bucket) || !/^[a-z]{2}-[a-z]+-\d$/.test(target.region)) fail('TARGET');
  return createHash('sha256').update(JSON.stringify([target.bucket, target.region])).digest('hex');
}

/** Structural binding only. Historical authenticity also requires the accepted body and hashed native sources. */
export function verifyPrivateSourceGrant(value: string, key: string, target: PrivateSourceTarget, atMs: number,
  recorded?: { issuedAt: string; expiresAt: string }, fresh = false) {
  privateSourceTargetFingerprint(target);
  let url: URL;
  try { url = new URL(value); } catch { return fail('GRANT_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
    || url.hostname !== `${target.bucket}.s3.${target.region}.amazonaws.com` || url.pathname !== '/' + key) fail('GRANT_TARGET');
  const allowed = new Set(['X-Amz-Algorithm', 'X-Amz-Content-Sha256', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-Expires',
    'X-Amz-Signature', 'X-Amz-SignedHeaders', 'X-Amz-Security-Token', 'x-amz-checksum-mode', 'x-id']);
  for (const name of url.searchParams.keys()) {
    if (!allowed.has(name) || url.searchParams.getAll(name).length !== 1) fail('GRANT_QUERY');
  }
  const date = url.searchParams.get('X-Amz-Date') ?? '';
  const ttlValue = url.searchParams.get('X-Amz-Expires') ?? '';
  if (!/^\d{8}T\d{6}Z$/.test(date) || !/^[1-9]\d{0,4}$/.test(ttlValue)) fail('GRANT_EXPIRY');
  const ttl = Number(ttlValue);
  const issued = Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`);
  if (!Number.isFinite(issued) || ttl > (fresh ? 300 : 86400)) fail('GRANT_EXPIRY');
  const issuedAt = new Date(issued).toISOString();
  if (issuedAt.replace(/[-:]/g, '').replace('.000', '') !== date) fail('GRANT_EXPIRY');
  const expiresAt = new Date(issued + ttl * 1000).toISOString();
  if (!Number.isFinite(atMs) || atMs < issued || atMs >= issued + ttl * 1000
    || fresh && atMs - issued >= 60_000 || recorded && (recorded.issuedAt !== issuedAt || recorded.expiresAt !== expiresAt)) fail('GRANT_EXPIRY');
  const credential = (url.searchParams.get('X-Amz-Credential') ?? '').split('/');
  if (url.searchParams.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256'
    || url.searchParams.get('X-Amz-SignedHeaders') !== 'host'
    || !/^[a-f0-9]{64}$/.test(url.searchParams.get('X-Amz-Signature') ?? '')
    || credential.length !== 5 || !/^[A-Z0-9]{16,128}$/.test(credential[0])
    || credential.slice(1).join('/') !== `${date.slice(0, 8)}/${target.region}/s3/aws4_request`
    || url.searchParams.has('X-Amz-Content-Sha256') && url.searchParams.get('X-Amz-Content-Sha256') !== 'UNSIGNED-PAYLOAD'
    || url.searchParams.has('x-id') && url.searchParams.get('x-id') !== 'GetObject'
    || url.searchParams.has('x-amz-checksum-mode') && url.searchParams.get('x-amz-checksum-mode') !== 'ENABLED'
    || url.searchParams.has('X-Amz-Security-Token') && !(url.searchParams.get('X-Amz-Security-Token') ?? '').match(/^.{1,4096}$/)) fail('GRANT_SIGNATURE_SHAPE');
  return { issuedAt, expiresAt };
}

/** The key is reconstructed from an admitted manifest, never obtained by parsing an arbitrary URL. */
export async function readPrivateStagingReference(reference: BoundPrivateReference, ports: PrivateSourcePorts,
  fetcher: typeof fetch = fetch): Promise<Buffer> {
  if (!Number.isSafeInteger(reference.size) || reference.size < 1 || reference.size > 20 * 1024 * 1024) fail('REFERENCE_SIZE');
  const key = reference.key;
  const target = { ...ports.target };
  const fingerprint = privateSourceTargetFingerprint(target);
  if (!/^editorial\/drafts\/launch-media\/nine-01\/[a-f0-9]{32}\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}-[a-f0-9]{64}\.(png|jpg|webp)$/.test(key)) fail('REFERENCE_KEY');
  let url: string;
  try { url = await ports.sign(key, { method: 'GET', expiresInSeconds: 300 }); }
  catch { return fail('SOURCE_SIGN'); }
  if (privateSourceTargetFingerprint(ports.target) !== fingerprint) fail('TARGET_CHANGED');
  verifyPrivateSourceGrant(url, key, target, (ports.now ?? Date.now)(), undefined, true);
  let response: Response;
  try { response = await fetcher(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30_000) }); }
  catch { return fail('REFERENCE_READ'); }
  if (!response.body) return fail('REFERENCE_READ');
  if (!response.ok || response.redirected || response.url && response.url !== url
    || Number(response.headers.get('content-length') ?? 0) > reference.size) fail('REFERENCE_READ');
  const reader = response.body.getReader(), chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      let part: ReadableStreamReadResult<Uint8Array>;
      try { part = await reader.read(); } catch { return fail('REFERENCE_READ'); }
      if (part.done) break;
      size += part.value.byteLength;
      if (size > reference.size) fail('REFERENCE_SIZE');
      chunks.push(Buffer.from(part.value));
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const bytes = Buffer.concat(chunks);
  if (size !== reference.size || createHash('sha256').update(bytes).digest('hex') !== reference.sha256) fail('REFERENCE_HASH');
  return bytes;
}
