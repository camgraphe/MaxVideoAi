import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { uploadSourceVideo } from '../frontend/src/components/tools/background-removal/_lib/background-removal-workspace-helpers';
import { chunkedVideoUploadFixture } from './helpers/chunked-video-upload-fixture';
import { uploadSessionFixture } from './helpers/upload-session-fixture';

import {
  uploadVideoFile,
  shouldUseChunkedVideoUpload,
  VERCEL_FUNCTION_BODY_LIMIT_BYTES,
} from '../frontend/lib/client-video-upload.ts';

test('reference videos over the Vercel function payload limit use chunked upload', () => {
  const fourPointSixMb = Math.ceil(4.6 * 1024 * 1024);

  assert.equal(VERCEL_FUNCTION_BODY_LIMIT_BYTES, 4.5 * 1024 * 1024);
  assert.equal(shouldUseChunkedVideoUpload({ size: fourPointSixMb }), true);
  assert.equal(shouldUseChunkedVideoUpload({ size: 1024 * 1024 }), false);
});

test('background removal imports MOV videos larger than the function body limit',async()=>{
  const session=await uploadSessionFixture();
  const upload=chunkedVideoUploadFixture();
  const original=globalThis.fetch;
  globalThis.fetch=upload.request;
  try {
    const file=new File([new Uint8Array(5*1024*1024)],'reference.mov',{type:'video/quicktime'});
    const result=await uploadSourceVideo(file,'account-A');
    assert.equal(upload.completed,true);
    assert.equal(result.url,upload.asset.url);
    assert.equal(result.name,'reference.mov');
    assert.equal(result.mime,'video/quicktime');
  }finally{session.restore();globalThis.fetch=original;}
});

test('background removal stops a multipart upload when the authenticated account changes',async()=>{
  const session=await uploadSessionFixture();
  let release!:()=>void;
  let start!:()=>void;
  const part=new Promise<void>(resolve=>{release=resolve;});
  const started=new Promise<void>(resolve=>{start=resolve;});
  const upload=chunkedVideoUploadFixture(()=>{start();return part;});
  const original=globalThis.fetch;
  globalThis.fetch=upload.request;
  try {
    const file=new File([new Uint8Array(5*1024*1024)],'reference.mov',{type:'video/quicktime'});
    const pending=uploadSourceVideo(file,'account-A');
    await started;
    session.switchTo('account-B');release();
    await assert.rejects(pending,/UNAUTHORIZED/);
    assert.equal(upload.completed,false);
  }finally{release();session.restore();globalThis.fetch=original;}
});

test('workspace video reference uploads bypass the Next API body limit for large files', () => {
  const root = process.cwd();
  const hookSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets.ts'),
    'utf8'
  );
  const modalSource = fs.readFileSync(path.join(root, 'frontend/components/library/AssetLibraryModal.tsx'), 'utf8');

  assert.match(hookSource, /uploadVideoFile/);
  assert.match(modalSource, /uploadVideoFile/);
  assert.ok(fs.existsSync(path.join(root, 'frontend/app/api/uploads/video/multipart/start/route.ts')));
  assert.ok(fs.existsSync(path.join(root, 'frontend/app/api/uploads/video/multipart/part/route.ts')));
  assert.ok(fs.existsSync(path.join(root, 'frontend/app/api/uploads/video/multipart/complete/route.ts')));
  assert.ok(fs.existsSync(path.join(root, 'frontend/app/api/uploads/video/multipart/abort/route.ts')));
});

test('browser video upload routes keep single-request transport inside the shared uploader',()=>{
  const root=process.cwd();
  const files:string[]=[];
  function visit(directory:string) {
    for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true})) {
      const file=path.join(directory,entry.name);
      if(entry.isDirectory()&&!['node_modules','.next','server','api','scripts'].includes(entry.name))visit(file);
      else if(entry.isFile()&&/\.[jt]sx?$/.test(entry.name))files.push(file);
    }
  }
  visit('frontend');
  const directSenders:string[]=[];
  for(const file of files) {
    const source=fs.readFileSync(path.join(root,file),'utf8');
    if(/['"]\/api\/uploads\/video['"]/.test(source)&&/\b(?:fetch|authFetch|ownedAuthFetch|request)\s*\(/.test(source))directSenders.push(file);
    if(/\/api\/uploads\/(?:\$\{|['"]\s*\+)/.test(source))assert.match(source,/import\s*\{[^}]*\buploadVideoFile\b[^}]*\}\s*from\s*['"]@\/lib\/client-video-upload['"]/,file+' must route video files through the shared uploader');
  }
  assert.deepEqual(directSenders.sort(),['frontend/lib/client-video-upload.ts']);
});

test('audio source video uploads use the chunked video upload helper', () => {
  const root = process.cwd();
  const audioHelperSource = fs.readFileSync(
    path.join(root, 'frontend/app/(core)/(workspace)/app/audio/_lib/audio-workspace-helpers.ts'),
    'utf8'
  );

  assert.match(audioHelperSource, /from '@\/lib\/client-video-upload'/);
  assert.match(audioHelperSource, /uploadVideoFile\(file\)/);
});

test('large video uploads use chunked server relay instead of browser storage PUT', async () => {
  const file = new File([new Uint8Array(Math.ceil(4.6 * 1024 * 1024))], 'reference.mp4', {
    type: 'video/mp4',
  });
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Browser storage PUT should not be used');
  };

  try {
    const asset = await uploadVideoFile(file, {
      request: async (input, init) => {
        const url = String(input);
        calls.push(url);

        if (url === '/api/uploads/video/multipart/start') {
          assert.equal(init?.method, 'POST');
          return Response.json({
            ok: true,
            upload: {
              uploadId: 'upload_123',
              key: 'user-assets/user_1/reference.mp4',
              url: 'https://cdn.example.com/user-assets/user_1/reference.mp4',
              chunkSizeBytes: 3_670_016,
            },
          });
        }

        if (url === '/api/uploads/video/multipart/part') {
          assert.equal(init?.method, 'POST');
          assert.ok(init?.body instanceof FormData);
          const form = init.body;
          const partNumber = Number(form.get('partNumber'));
          assert.ok(partNumber >= 1);
          assert.ok(form.get('chunk') instanceof Blob);
          return Response.json({
            ok: true,
            part: { partNumber, etag: `"etag-${partNumber}"` },
          });
        }

        if (url === '/api/uploads/video/multipart/complete') {
          assert.equal(init?.method, 'POST');
          const payload = JSON.parse(String(init?.body));
          assert.equal(payload.uploadId, 'upload_123');
          assert.equal(payload.key, 'user-assets/user_1/reference.mp4');
          assert.ok(Array.isArray(payload.parts));
          assert.ok(payload.parts.length >= 2);
          return Response.json({
            ok: true,
            asset: {
              id: 'asset_123',
              url: 'https://cdn.example.com/user-assets/user_1/reference.mp4',
              mime: 'video/mp4',
              size: file.size,
              name: file.name,
            },
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      },
    });

    assert.equal(asset.id, 'asset_123');
    assert.deepEqual(
      calls.filter((url) => url.includes('/multipart/')),
      [
        '/api/uploads/video/multipart/start',
        '/api/uploads/video/multipart/part',
        '/api/uploads/video/multipart/part',
        '/api/uploads/video/multipart/complete',
      ]
    );
    assert.equal(calls.some((url) => url.includes('/api/uploads/video/direct')), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
