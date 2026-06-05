import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStoryboardTemplateReferenceUrls } from '../frontend/src/server/images/storyboard-template-reference.ts';

test('publishes local storyboard template references before provider submission', async () => {
  const uploaded: Array<{ fileName: string | null | undefined; prefix: string | undefined; mime: string }> = [];
  const recorded: Array<{ url: string; source: string; metadata?: Record<string, unknown> }> = [];
  const result = await resolveStoryboardTemplateReferenceUrls({
    userId: 'user_storyboard',
    urls: [
      'http://localhost:3000/storyboard/templates/storyboard-template-portrait-6.png',
      'https://media.maxvideoai.com/user-assets/reference.png',
    ],
    deps: {
      cwd: '/workspace/frontend',
      isStorageConfiguredFn: () => true,
      readFileFn: async (filePath) => {
        assert.equal(filePath, '/workspace/frontend/public/storyboard/templates/storyboard-template-portrait-6.png');
        return Buffer.from('png');
      },
      uploadImageToStorageFn: async ({ fileName, prefix, mime }) => {
        uploaded.push({ fileName, prefix, mime });
        return {
          url: 'https://media.maxvideoai.com/storyboard-template-references/template.png',
          key: 'storyboard-template-references/user_storyboard/template.png',
          width: 1000,
          height: 1600,
          size: 3,
          mime,
        };
      },
      recordUserAssetFn: async ({ url, source, metadata }) => {
        recorded.push({ url, source, metadata });
        return 'asset_template';
      },
    },
  });

  assert.deepEqual(result.urls, [
    'https://media.maxvideoai.com/storyboard-template-references/template.png',
    'https://media.maxvideoai.com/user-assets/reference.png',
  ]);
  assert.equal(result.urls.some((url) => url.includes('localhost')), false);
  assert.deepEqual(uploaded, [
    {
      fileName: 'storyboard-template-portrait-6.png',
      prefix: 'storyboard-template-references',
      mime: 'image/png',
    },
  ]);
  assert.equal(result.storedAssetInfoByUrl.get(result.urls[0])?.mime, 'image/png');
  assert.equal(result.storedAssetInfoByUrl.get(result.urls[0])?.width, 1000);
  assert.equal(result.storedAssetInfoByUrl.get(result.urls[0])?.height, 1600);
  assert.equal(recorded[0]?.source, 'storyboard_template_reference');
  assert.equal(recorded[0]?.metadata?.templatePath, '/storyboard/templates/storyboard-template-portrait-6.png');
});

test('publishes storyboard templates when the server cwd is the repository root', async () => {
  const attemptedPaths: string[] = [];
  const result = await resolveStoryboardTemplateReferenceUrls({
    userId: 'user_storyboard',
    urls: ['https://maxvideoai.com/storyboard/templates/storyboard-template-6.png'],
    deps: {
      cwd: '/workspace',
      isStorageConfiguredFn: () => true,
      readFileFn: async (filePath) => {
        const normalizedPath = String(filePath);
        attemptedPaths.push(normalizedPath);
        if (normalizedPath === '/workspace/public/storyboard/templates/storyboard-template-6.png') {
          const error = new Error('ENOENT') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          throw error;
        }
        assert.equal(normalizedPath, '/workspace/frontend/public/storyboard/templates/storyboard-template-6.png');
        return Buffer.from('png');
      },
      uploadImageToStorageFn: async ({ fileName, prefix, mime }) => ({
        url: 'https://media.maxvideoai.com/storyboard-template-references/template-root.png',
        key: `storyboard-template-references/user_storyboard/${fileName}`,
        width: 1600,
        height: 1000,
        size: 3,
        mime,
        prefix,
      }),
      recordUserAssetFn: async () => 'asset_template',
    },
  });

  assert.deepEqual(attemptedPaths, [
    '/workspace/public/storyboard/templates/storyboard-template-6.png',
    '/workspace/frontend/public/storyboard/templates/storyboard-template-6.png',
  ]);
  assert.deepEqual(result.urls, ['https://media.maxvideoai.com/storyboard-template-references/template-root.png']);
  assert.equal(result.storedAssetInfoByUrl.get(result.urls[0])?.width, 1600);
});

test('leaves non-storyboard template URLs unchanged', async () => {
  const result = await resolveStoryboardTemplateReferenceUrls({
    userId: 'user_storyboard',
    urls: ['http://localhost:3000/assets/other.png'],
    deps: {
      isStorageConfiguredFn: () => {
        throw new Error('storage should not be checked');
      },
    },
  });

  assert.deepEqual(result.urls, ['http://localhost:3000/assets/other.png']);
  assert.equal(result.storedAssetInfoByUrl.size, 0);
});
