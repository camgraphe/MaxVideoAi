import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';

const frontend = resolve('frontend');
const base = 'https://image-ownership-fixture.s3.us-east-1.amazonaws.com';
const owner = '00000000-0000-4000-8000-00000000000a';
const other = '00000000-0000-4000-8000-00000000000b';
const original = `${base}/user-assets/${owner}/private.png`;

async function load() {
  const fixture = {
    reads: [] as string[],
    uploads: [] as string[],
    ownedAssets: [] as Array<{ url: string; mime_type: string; size_bytes: number; width: number; height: number }>,
    storageOriginals: new Map<string, Buffer>(),
    marketingPublic: false,
    bytes: await createRequire(resolve(frontend, 'package.json'))('sharp')({
      create: { width: 2, height: 2, channels: 3, background: '#abcdef' },
    }).png().toBuffer() as Buffer,
  };
  const stubs: Record<string, string> = {
    '@/lib/db': 'export const query = async (_sql, [userId, urls]) => fixture.ownedAssets.filter(asset => userId === "' + owner + '" && urls.includes(asset.url));',
    '@/lib/schema': 'export const ensureAssetSchema = async () => {};',
    '@/server/marketing-media/access': 'export const canReadMarketingFile = async () => fixture.marketingPublic;',
    '@/server/storage': `
      export * from './server/storage-read';
      export {isAllowedAssetHost} from './server/asset-url-policy';
      export const isStorageConfigured = () => true;
      export const recordUserAsset = async () => {};
      export const getStorageObjectBuffer = async key => {
        const bytes = fixture.storageOriginals.get(key);
        if (!bytes) throw new Error("unexpected original read");
        return bytes;
      };
      export const uploadImageToStorage = async input => {
        fixture.uploads.push(input.userId);
        return {url: '${base}/normalized-references/' + input.userId + '/copy.jpg', mime: input.mime};
      };
    `,
  };
  const result = await build({
    absWorkingDir: frontend,
    stdin: { contents: `
      export {prepareImageGenerationReferences} from './src/server/images/image-generation-references';
      export {normalizeReferenceImageForEngine} from './src/server/images/image-reference-normalization';
      export {resolveImageGenerationRequestContext} from './src/server/images/image-generation-request-context';
    `, resolveDir: frontend, loader: 'ts' },
    tsconfig: resolve(frontend, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs',
    write: false, packages: 'external',
    plugins: [{ name: 'offline-image-ownership', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
  });
  const module = { exports: {} as any };
  runInNewContext(result.outputFiles[0].text, {
    module, exports: module.exports, fixture, require: createRequire(resolve(frontend, 'package.json')),
    process: { cwd: () => frontend, env: {
      S3_BUCKET: 'image-ownership-fixture', S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'fixture-key', S3_SECRET_ACCESS_KEY: 'fixture-secret', S3_PUBLIC_BASE_URL: base,
      VERCEL_BRANCH_URL: 'maxvideoai-approved-branch.vercel.app',
    } },
    URL, Buffer, AbortController, AbortSignal, Response, setTimeout, clearTimeout, console,
    fetch: async (url: string) => {
      fixture.reads.push(String(url));
      const parsed = new URL(url);
      assert.equal(parsed.origin, base);
      assert.ok(parsed.searchParams.get('X-Amz-Signature'), 'private reads require a real fixture signature');
      return new Response(fixture.bytes, { headers: { 'content-type': 'image/png' } });
    },
  });
  return { api: module.exports, fixture };
}

function prepare(api: any, userId: string, imageUrl: string, character = false) {
  const body = {
    engineId: 'gpt-image-2', mode: 'i2i', prompt: 'Offline ownership fixture',
    ...(character
      ? { characterReferences: [{ id: 'character', jobId: 'fixture-job', imageUrl }] }
      : { imageUrls: [imageUrl] }),
  };
  const context = api.resolveImageGenerationRequestContext(body);
  return api.prepareImageGenerationReferences({ userId, body, ...context });
}

for (const character of [false, true]) {
  test(`image preparation denies a foreign ${character ? 'character' : 'image'} reference`, async () => {
    const { api, fixture } = await load();
    await assert.rejects(prepare(api, other, original, character), { code: 'reference_not_owned', status: 400 });
    assert.equal(fixture.reads.length, 0);
    assert.equal(fixture.uploads.length, 0);
  });
}

test('normalization cannot copy another account private image into the caller library', async () => {
  const { api, fixture } = await load();
  await assert.rejects(api.normalizeReferenceImageForEngine({
    userId: other, url: original, supportedFormats: ['jpg'], engineId: 'gpt-image-2',
  }), /MEDIA_NOT_AVAILABLE/);
  assert.equal(fixture.reads.length, 0);
  assert.equal(fixture.uploads.length, 0);
});

test('owned and external references keep canonical identity and owned normalization still works', async () => {
  const { api, fixture } = await load();
  for (const url of [original, 'https://v3b.fal.media/public-reference.png']) {
    const result = await prepare(api, owner, url);
    assert.equal(result.combinedImageUrls[0], url);
  }
  const result = await api.normalizeReferenceImageForEngine({
    userId: owner, url: original, supportedFormats: ['jpg'], engineId: 'gpt-image-2',
  });
  assert.equal(result.url, `${base}/normalized-references/${owner}/copy.jpg`);
  assert.equal(fixture.uploads[0], owner);
  assert.equal(new URL(fixture.reads[0]).pathname, `/user-assets/${owner}/private.png`);
});

test('published marketing files remain usable but a namespace alone never grants access', async () => {
  const { api, fixture } = await load();
  const url = `${base}/marketing-media/public-reference.png`;
  await assert.rejects(prepare(api, other, url), { code: 'reference_not_owned' });
  fixture.marketingPublic = true;
  assert.equal((await prepare(api, other, url)).combinedImageUrls[0], url);
});

test('OpenAI Storyboard preparation pins the browser template and keeps image references ahead of character references', async () => {
  const { api, fixture } = await load();
  const template = 'https://maxvideoai-approved-branch.vercel.app/storyboard/templates/storyboard-template-portrait-6.png';
  const character = `${base}/user-assets/${owner}/character.png`;
  for (const url of [original, character]) {
    fixture.ownedAssets.push({ url, mime_type: 'image/png', size_bytes: 1024, width: 1024, height: 1024 });
    fixture.storageOriginals.set(new URL(url).pathname.slice(1), fixture.bytes);
  }
  const body = {
    engineId: 'gpt-image-2-6-sunburst', mode: 'i2i', prompt: 'Offline Storyboard ownership fixture',
    source: 'storyboard', metadata: { storyboard: { role: 'board', targetModel: 'seedance' } },
    imageUrls: [template, original],
    characterReferences: [{ id: 'character', jobId: 'fixture-job', imageUrl: character }],
  };
  const context = api.resolveImageGenerationRequestContext(body);
  const result = await api.prepareImageGenerationReferences({ userId: owner, body, ...context });

  assert.deepEqual(Array.from(result.combinedImageUrls), [template, original, character]);
  const [primary, ...signed] = Array.from(result.preparedOpenAIReferenceUrls as string[]);
  assert.equal(primary, 'https://maxvideoai.com/storyboard/templates/storyboard-template-portrait-6.png');
  assert.deepEqual(signed.map(value => new URL(value).pathname), [new URL(original).pathname, new URL(character).pathname]);
  assert.ok(signed.every(value => new URL(value).searchParams.has('X-Amz-Signature')));
  assert.deepEqual(fixture.uploads, []);
});

test('OpenAI Storyboard edits price from original bytes when both request and saved metadata claim different dimensions', async () => {
  const { api, fixture } = await load();
  fixture.ownedAssets.push({ url: original, mime_type: 'image/png', size_bytes: 1024, width: 1024, height: 768 });
  fixture.storageOriginals.set(new URL(original).pathname.slice(1), await createRequire(resolve(frontend, 'package.json'))('sharp')({
    create: { width: 1920, height: 1080, channels: 3, background: '#abcdef' },
  }).png().toBuffer());
  const body = {
    engineId: 'gpt-image-2-6-sunburst', mode: 'i2i', prompt: 'Offline Storyboard edit fixture',
    source: 'storyboard_edit', imageUrls: [original],
    referenceImageSizes: [{ width: 2160, height: 3840 }],
  };
  const context = api.resolveImageGenerationRequestContext(body);
  const result = await api.prepareImageGenerationReferences({ userId: owner, body, ...context });

  assert.deepEqual({ ...result.storedAssetInfoByUrl.get(original) }, { mime: 'image/png', width: 1920, height: 1080 });
});

test('the pinned Storyboard input exception does not extend to GPT Image 2.6 Flare', async () => {
  const { api } = await load();
  const body = {
    engineId: 'gpt-image-2-6-flare', mode: 'i2i', prompt: 'Offline reference fixture',
    source: 'storyboard', imageUrls: ['https://maxvideoai.com/storyboard/templates/storyboard-template-6.png'],
  };
  const context = api.resolveImageGenerationRequestContext(body);

  await assert.rejects(api.prepareImageGenerationReferences({ userId: owner, body, ...context }), {
    code: 'OPENAI_IMAGE_REFERENCE_INVALID', status: 400,
  });
});
