import assert from 'node:assert/strict';
import test from 'node:test';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

Object.assign(process.env, {
  S3_BUCKET: 'fixture-bucket',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'offline',
  S3_SECRET_ACCESS_KEY: 'offline-secret',
  S3_PUBLIC_BASE_URL: 'https://fixture.invalid',
  AWS_EC2_METADATA_DISABLED: 'true',
  AWS_CONFIG_FILE: '/dev/null',
  AWS_SHARED_CREDENTIALS_FILE: '/dev/null',
});

test('actual bodyless presign does not bind nonempty upload to empty CRC32 and preserves explicit checksum', async () => {
  const { createSignedUploadUrl } = await import('../frontend/server/storage');
  const params = {
    mime: 'video/mp4',
    userId: 'offline-owner',
    fileName: 'nonempty.mp4',
  };
  const grant = new URL((await createSignedUploadUrl(params)).url);
  assert.equal(grant.searchParams.get('x-amz-checksum-crc32'), null);
  const explicit = new URL(
    (
      await createSignedUploadUrl({
        ...params,
        checksumCRC32: 'Hog6yg==',
      } as any)
    ).url,
  );
  assert.equal(explicit.searchParams.get('x-amz-checksum-crc32'), 'Hog6yg==');
});
test('ordinary bodyful SDK PUT still computes the actual nonempty CRC32 offline', async () => {
  let sent: any;
  const client = new S3Client({
    region: 'us-east-1',
    credentials: { accessKeyId: 'offline', secretAccessKey: 'offline' },
    requestHandler: {
      handle: async (request: any) => {
        sent = request;
        return {
          response: { statusCode: 200, headers: {}, body: Buffer.alloc(0) },
        };
      },
    },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: 'fixture',
      Key: 'nonempty',
      Body: Buffer.from('fixture-nonempty-body'),
    }),
  );
  assert.equal(sent.headers['x-amz-checksum-crc32'], 'Hog6yg==');
  assert.notEqual(sent.headers['x-amz-checksum-crc32'], 'AAAAAA==');
  client.destroy();
});
