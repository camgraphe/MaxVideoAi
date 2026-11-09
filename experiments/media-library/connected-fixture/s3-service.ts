import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, rename, rm, appendFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { sha, crc32, verifySignature, storageEnvironment } from './s3-signature';
export type ObjectRecord = {
    key: string;
    path: string;
    mimeType: string;
    cacheControl: string;
    sha256: string;
    bytes: number;
    role: string;
    publicResource?: boolean;
    requiresGrant?: boolean;
};
export async function startStorage(root: string, appOrigin: string) {
    await mkdir(root, { recursive: true });
    const objects = new Map<string, ObjectRecord>();
    const deniedGrants = new Set<string>();
    const failedKeys = new Set<string>();
    const delays = new Map<string, number>();
    const lastGrants = new Map<string, string>();
    const manifestPath = join(root, 'public-byte-manifest.json'), journalPath = join(root, 's3-journal.jsonl');
    let nextUploadFailure: { prefix: string; kind: string } | undefined;
    let serial = Promise.resolve();
    function manifest() { const data = JSON.stringify({ canonicalBase: storageEnvironment.S3_PUBLIC_BASE_URL, objects: [...objects.values()] }, null, 2); serial = serial.then(() => writeFile(manifestPath, data)); return serial; }
    async function put(key: string, bytes: Buffer, mimeType: string, role: string, cacheControl = 'private, max-age=3600') {
        if (!/^(user-assets|user-asset-thumbs|media-assets|renders)\//.test(key) || key.split('/').some(s => s === '..' || s === '.' || !s) || key.includes('\\'))
            throw new Error('InvalidKey');
        const path = join(root, sha(key) + extname(key)), tmp = path + '.tmp';
        await writeFile(tmp, bytes);
        await rename(tmp, path);
        const record = { key, path, mimeType, cacheControl, sha256: sha(bytes), bytes: bytes.length, role };
        objects.set(key, record);
        await manifest();
        return record;
    }
    const server = createServer(async (req, res) => {
        const started = performance.now();
        let key = '', sent = 0;
        const method = req.method ?? '';
        res.on('close', () => { void appendFile(journalPath, JSON.stringify({ at: new Date().toISOString(), method, keyHash: sha(key), role: objects.get(key)?.role ?? 'unknown', status: res.statusCode, range: req.headers.range ?? null, bodyBytesQueued: sent, completed: res.writableFinished, ms: performance.now() - started }) + '\n'); });
        const fail = (status: number, code: string) => {
            const body = method === 'HEAD' ? '' : `<Error><Code>${code}</Code><Message>Fixture request refused</Message><RequestId>fixture</RequestId></Error>`;
            sent = Buffer.byteLength(body);
            res.writeHead(status, { 'Content-Type': 'application/xml', 'Cache-Control': 'no-store', 'Content-Length': sent });
            res.end(body);
        };
        try {
            if (req.headers.host !== new URL(origin).host) {
                fail(403, 'InvalidHost');
                return;
            }
            const url = new URL(req.url ?? '/', origin);
            if (req.headers.origin && req.headers.origin !== appOrigin) {
                fail(403, 'InvalidOrigin');
                return;
            }
            if (req.headers.origin) {
                res.setHeader('Access-Control-Allow-Origin', appOrigin);
                res.setHeader('Vary', 'Origin');
                res.setHeader('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Content-Type,Accept-Ranges,ETag');
            }
            if (method === 'OPTIONS') {
                res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,HEAD,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'content-type,range,x-amz-checksum-crc32,x-amz-sdk-checksum-algorithm' }).end();
                return;
            }
            if (!url.pathname.startsWith('/fixture-bucket/')) {
                fail(403, 'InvalidBucket');
                return;
            }
            key = decodeURIComponent(url.pathname.slice('/fixture-bucket/'.length));
            if (!/^(user-assets|user-asset-thumbs|media-assets|renders)\//.test(key) || key.split('/').some(s => !s || s === '..' || s === '.') || key.includes('\\')) {
                fail(403, 'InvalidKey');
                return;
            }
            const chunks: Buffer[] = [];
            let count = 0;
            for await (const part of req) {
                count += part.length;
                if (count > 100 * 1024 * 1024) {
                    fail(413, 'EntityTooLarge');
                    req.destroy();
                    return;
                }
                chunks.push(part);
            }
            const body = Buffer.concat(chunks);
            if (req.headers['content-encoding']?.includes('aws-chunked')) {
                fail(501, 'UnsupportedStreamingBody');
                return;
            }
            const grant = verifySignature(req, url, body);
            if (grant.presigned)
                lastGrants.set(key, grant.fingerprint);
            if (deniedGrants.has(grant.fingerprint) || failedKeys.has(key)) {
                fail(403, 'AccessDenied');
                return;
            }
            if (delays.has(key))
                await new Promise(resolve => setTimeout(resolve, delays.get(key)));
            if (method === 'PUT') {
                const checksumFields = [...Object.keys(req.headers), ...url.searchParams.keys()].map(key => key.toLowerCase()).filter(key => key.startsWith('x-amz-checksum-'));
                if (checksumFields.some(key => key !== 'x-amz-checksum-crc32') || (req.headers['x-amz-sdk-checksum-algorithm'] && req.headers['x-amz-sdk-checksum-algorithm'] !== 'CRC32') || req.headers['content-md5']) { fail(501, 'UnsupportedChecksum'); return; }
                const checksum = req.headers['x-amz-checksum-crc32'] ?? url.searchParams.get('x-amz-checksum-crc32');
                if (checksum && checksum !== crc32(body)) {
                    fail(400, 'BadDigest');
                    return;
                }
                if (nextUploadFailure && key.startsWith(nextUploadFailure.prefix)
                    && String(req.headers['content-type']).startsWith(nextUploadFailure.kind + '/')) {
                    nextUploadFailure = undefined;
                    fail(403, 'AccessDenied');
                    return;
                }
                if (req.headers['if-none-match'] === '*' && objects.has(key)) {
                    fail(412, 'PreconditionFailed');
                    return;
                }
                const obj = await put(key, body, String(req.headers['content-type'] ?? 'application/octet-stream'), 'uploaded', String(req.headers['cache-control'] ?? 'private, no-store'));
                res.writeHead(200, { 'Content-Length': '0', ETag: `"${obj.sha256}"`, 'x-amz-checksum-crc32': crc32(body) }).end();
                return;
            }
            if (method === 'DELETE') {
                const old = objects.get(key);
                if (old) {
                    objects.delete(key);
                    await rm(old.path, { force: true });
                    await manifest();
                }
                res.writeHead(204).end();
                return;
            }
            if (method !== 'GET' && method !== 'HEAD') {
                fail(405, 'MethodNotAllowed');
                return;
            }
            const obj = objects.get(key);
            if (!obj) {
                fail(404, 'NoSuchKey');
                return;
            }
            res.setHeader('Content-Type', obj.mimeType);
            res.setHeader('Content-Length', obj.bytes);
            res.setHeader('Cache-Control', obj.cacheControl);
            res.setHeader('ETag', `"${obj.sha256}"`);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Last-Modified', 'Mon, 09 Nov 2026 00:00:00 GMT');
            if (url.searchParams.has('response-content-disposition'))
                res.setHeader('Content-Disposition', url.searchParams.get('response-content-disposition')!);
            if (method === 'HEAD') {
                res.writeHead(200).end();
                return;
            }
            let bytes = await readFile(obj.path), status = 200;
            if (req.headers.range) {
                const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
                let start = match?.[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match?.[2]));
                let end = match?.[1] ? (match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1) : bytes.length - 1;
                if (!match || (!match[1] && !match[2]) || !Number.isFinite(start) || start >= bytes.length || end < start) {
                    res.writeHead(416, { 'Content-Range': `bytes */${bytes.length}`, 'Content-Length': '0' }).end();
                    return;
                }
                res.setHeader('Content-Range', `bytes ${start}-${end}/${bytes.length}`);
                bytes = bytes.subarray(start, end + 1);
                res.setHeader('Content-Length', bytes.length);
                status = 206;
            }
            sent = bytes.length;
            res.writeHead(status).end(bytes);
        }
        catch (error) {
            fail(403, error instanceof Error && /^[a-zA-Z]+$/.test(error.message) ? error.message : 'InvalidRequest');
        }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(server.address() as {
        port: number;
    }).port}`;
    await manifest();
    return { origin, put, objects, manifestPath, journalPath, lastGrants, deniedGrants, failedKeys, delays,
        failNextUpload(owner: string, kind: 'image' | 'video' | 'audio') {
            if (nextUploadFailure) throw new Error('FailureAlreadyArmed');
            nextUploadFailure = { prefix: `user-assets/by-content/${sha(owner).slice(0, 32)}/`, kind };
        },
        async resetTo(keys: Set<string>) {
            nextUploadFailure = undefined;
            for (const [key, record] of objects)
                if (!keys.has(key)) {
                    objects.delete(key);
                    await rm(record.path, { force: true });
                }
            deniedGrants.clear();
            failedKeys.clear();
            delays.clear();
            lastGrants.clear();
            await manifest();
        },
        async setPublicKeys(keys: Set<string>, privateKeys: Set<string>) {
            for (const [key, record] of objects) {
                record.publicResource = keys.has(key);
                record.requiresGrant = privateKeys.has(key);
            }
            await manifest();
            return [...objects.values()].filter(record => record.publicResource).length;
        }, async close() { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
