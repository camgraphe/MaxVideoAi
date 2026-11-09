import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { startStorage } from './s3-service';
import { sha, storageEnvironment } from './s3-signature';
async function main() {
    const req = createRequire(resolve('frontend/package.json'));
    const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = req('@aws-sdk/client-s3');
    const { getSignedUrl } = req('@aws-sdk/s3-request-presigner');
    const root = await mkdtemp(join(tmpdir(), 'library-s3-verify-'));
    const store = await startStorage(root, 'http://127.0.0.1:3000');
    const client = new S3Client({ endpoint: store.origin, region: storageEnvironment.S3_REGION, credentials: { accessKeyId: storageEnvironment.S3_ACCESS_KEY_ID, secretAccessKey: storageEnvironment.S3_SECRET_ACCESS_KEY } });
    const params = { Bucket: storageEnvironment.S3_BUCKET, Key: 'user-assets/test/protocol.bin' };
    const Body = Buffer.from('Real fixture payload — checksum, identity and byte ranges.');
    let checks = 0;
    try {
        await client.send(new PutObjectCommand({ ...params, Body, ContentType: 'application/octet-stream' }));
        checks++;
        const head = await client.send(new HeadObjectCommand(params));
        assert.equal(head.ContentLength, Body.length);
        checks++;
        const original = await client.send(new GetObjectCommand(params));
        assert.deepEqual(Buffer.from(await original.Body.transformToByteArray()), Body);
        checks++;
        const grant = await getSignedUrl(client, new GetObjectCommand(params), { expiresIn: 300 });
        const range = await fetch(grant, { headers: { Range: 'bytes=2-8' } });
        assert.equal(range.status, 206);
        assert.deepEqual(Buffer.from(await range.arrayBuffer()), Body.subarray(2, 9));
        checks++;
        assert.equal((await fetch(grant, { headers: { Range: 'bytes=99999-' } })).status, 416);
        checks++;
        assert.equal((await fetch(`${store.origin}/fixture-bucket/${params.Key}`)).status, 403);
        checks++;
        const altered = new URL(grant);
        altered.searchParams.set('X-Amz-Expires', '299');
        assert.equal((await fetch(altered)).status, 403);
        checks++;
        await assert.rejects(client.send(new PutObjectCommand({ ...params, Body, ChecksumCRC32: 'AAAAAA==' })), /BadDigest|Fixture request refused/);
        checks++;
        await assert.rejects(client.send(new PutObjectCommand({ ...params, Body, IfNoneMatch: '*' })), /PreconditionFailed|Fixture request refused/);
        checks++;
        const fingerprint = store.lastGrants.get(params.Key)!;
        store.deniedGrants.add(fingerprint);
        assert.equal((await fetch(grant)).status, 403);
        checks++;
        await client.send(new DeleteObjectCommand(params));
        await assert.rejects(client.send(new HeadObjectCommand(params)));
        checks++;
        const owner = '10000000-0000-4000-8000-000000000003';
        const upload = { Bucket: params.Bucket, Key: `user-assets/by-content/${sha(owner).slice(0,32)}/private-${sha(Body)}.png`, Body, ContentType:'image/png' };
        store.failNextUpload(owner, 'image');
        // A sibling kind does not consume the bounded failure.
        await client.send(new PutObjectCommand({...params, Key:'user-assets/test/sibling.mp3', Body, ContentType:'audio/mpeg'}));
        await assert.rejects(client.send(new PutObjectCommand(upload)), /AccessDenied|Fixture request refused/);
        assert.equal(store.objects.has(upload.Key),false);
        checks++;
        await client.send(new PutObjectCommand(upload));
        assert.equal(store.objects.get(upload.Key)?.bytes,Body.length);
        checks++;
        console.log(JSON.stringify({ checks, passed: checks, network: 'owned loopback SDK requests; no external service' }));
    }
    finally {
        client.destroy();
        await store.close();
        await rm(root, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
