import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
export const storageEnvironment = { S3_BUCKET: 'fixture-bucket', S3_REGION: 'us-east-1', S3_ACCESS_KEY_ID: 'FIXTURE_ACCESS_ONLY', S3_SECRET_ACCESS_KEY: 'FIXTURE_SECRET_ONLY', S3_PUBLIC_BASE_URL: 'https://media.maxvideoai.com/fixture-bucket', S3_UPLOAD_ACL: 'private', AWS_EC2_METADATA_DISABLED: 'true', AWS_CONFIG_FILE: '/dev/null', AWS_SHARED_CREDENTIALS_FILE: '/dev/null' };
export const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const hmac = (key: string | Buffer, value: string) => createHmac('sha256', key).update(value).digest();
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
export function verifySignature(request: IncomingMessage, url: URL, body: Buffer) {
    const query = url.searchParams;
    if ([...new Set(query.keys())].some(key => query.getAll(key).length !== 1))
        throw new Error('DuplicateQuery');
    const presigned = query.has('X-Amz-Signature');
    const authorization = request.headers.authorization ?? '';
    const credential = presigned ? query.get('X-Amz-Credential') : /Credential=([^, ]+)/.exec(authorization)?.[1];
    const signedHeaders = presigned ? query.get('X-Amz-SignedHeaders') : /SignedHeaders=([^, ]+)/.exec(authorization)?.[1];
    const signature = presigned ? query.get('X-Amz-Signature') : /Signature=([a-f0-9]+)/.exec(authorization)?.[1];
    const date = (presigned ? query.get('X-Amz-Date') : request.headers['x-amz-date']) as string;
    if ((!presigned && !authorization.startsWith('AWS4-HMAC-SHA256 ')) || (presigned && query.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256') || !credential || !signedHeaders || !signature || !/^\d{8}T\d{6}Z$/.test(date ?? ''))
        throw new Error('MissingSignature');
    const [access, day, region, service, terminal, extra] = credential.split('/');
    if (access !== storageEnvironment.S3_ACCESS_KEY_ID || region !== 'us-east-1' || service !== 's3' || terminal !== 'aws4_request' || extra || day !== date.slice(0, 8))
        throw new Error('InvalidCredential');
    const millis = Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`);
    const expiry = presigned ? Number(query.get('X-Amz-Expires')) : 900;
    if (!Number.isFinite(millis) || !Number.isInteger(expiry) || expiry <= 0 || expiry > 3600 || millis > Date.now() + 30000 || millis + expiry * 1000 < Date.now())
        throw new Error('ExpiredSignature');
    const headers = signedHeaders.split(';');
    if (!headers.includes('host') || headers.join(';') !== [...new Set(headers)].sort().join(';'))
        throw new Error('InvalidSignedHeaders');
    const canonicalHeaders = headers.map(name => {
        const value = request.headers[name];
        if (!value || Array.isArray(value))
            throw new Error('MissingSignedHeader');
        return `${name}:${value.trim().replace(/\s+/g, ' ')}\n`;
    }).join('');
    const canonicalQuery = [...query].filter(([k]) => k !== 'X-Amz-Signature').map(([k, v]) => [encode(k), encode(v)]).sort(([a, av], [b, bv]) => a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('&');
    const payload = (request.headers['x-amz-content-sha256'] as string) || query.get('X-Amz-Content-Sha256') || (presigned ? 'UNSIGNED-PAYLOAD' : sha(body));
    if (payload !== 'UNSIGNED-PAYLOAD' && payload !== sha(body))
        throw new Error('PayloadMismatch');
    const canonical = [request.method, url.pathname, canonicalQuery, canonicalHeaders, signedHeaders, payload].join('\n');
    const scope = `${day}/${region}/${service}/aws4_request`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${storageEnvironment.S3_SECRET_ACCESS_KEY}`, day), region), service), 'aws4_request');
    const expected = hmac(signingKey, `AWS4-HMAC-SHA256\n${date}\n${scope}\n${sha(canonical)}`).toString('hex');
    if (!/^[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
        throw new Error('SignatureDoesNotMatch');
    return { fingerprint: sha(signature), presigned };
}
export function crc32(body: Buffer) {
    let crc = 0xffffffff;
    for (const byte of body) {
        crc ^= byte;
        for (let i = 0; i < 8; i++)
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return result.toString('base64');
}
