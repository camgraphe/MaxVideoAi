import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from '../frontend/node_modules/typescript/lib/typescript.js';
for (const tool of ['angle', 'upscale'])
  for (const failed of [false, true])
    test(`${tool} forwards prepared facts from the already downloaded bytes and optional failure=${failed} keeps original`, async () => {
      const records: any[] = [];
      let fetches = 0,
        prepared = 0;
      const imageDisplay = {
        version: 1,
        profile: 'image-display-v1',
        sourceUrl: 'https://storage.invalid/original.png',
        sourceSha256: 'a'.repeat(64),
        url: 'https://storage.invalid/display.webp',
        mimeType: 'image/webp',
        width: 1920,
        height: 960,
        sizeBytes: 1000,
      };
      const prepare = async (input: any) => {
        prepared++;
        assert.deepEqual(input.data, Buffer.from('provider-original'));
        assert.equal(input.imageUrl, imageDisplay.sourceUrl);
        if (failed) throw Error('optional failure');
        return {
          thumbUrl: 'https://storage.invalid/thumb.webp',
          previewUrl: imageDisplay.url,
          imageDisplay,
        };
      };
      const dependencies: any = {
        '@/server/storage': {
          isStorageConfigured: () => true,
          uploadImageToStorage: async () => ({
            url: imageDisplay.sourceUrl,
            mime: 'image/png',
            size: 20,
            width: 4000,
            height: 2000,
          }),
          recordUserAsset: async (input: any) => {
            records.push(input);
            return 'internal';
          },
        },
        '@/server/image-thumbnails': { prepareImageRenditions: prepare },
        '@/lib/tools-upscale': {
          resolveUpscaleOutputFetchTimeoutMs: () => 12000,
        },
        './upscale-request-utils': {
          formatToImageMime: () => 'image/png',
          formatToVideoMime: () => 'video/mp4',
        },
      };
      const exports: any = {};
      runInNewContext(
        ts.transpileModule(
          readFileSync(
            `frontend/src/server/tools/${tool}-output-persistence.ts`,
            'utf8',
          ),
          {
            compilerOptions: {
              module: ts.ModuleKind.CommonJS,
              target: ts.ScriptTarget.ES2022,
            },
          },
        ).outputText,
        {
          exports,
          Buffer,
          AbortController,
          setTimeout,
          clearTimeout,
          console,
          fetch: async () => {
            fetches++;
            return new Response('provider-original', {
              headers: { 'content-type': 'image/png' },
            });
          },
          require: (id: string) => {
            assert.ok(dependencies[id], id);
            return dependencies[id];
          },
        },
      );
      const params = {
        userId: 'owner',
        jobId: 'job',
        engineId: 'fixture',
        engineLabel: 'fixture',
        output: { url: 'https://provider.invalid/photo.png' },
        outputs: [{ url: 'https://provider.invalid/photo.png' }],
        mediaType: 'image',
        outputFormat: 'png',
        prepare,
      };
      const output =
        tool === 'angle'
          ? (await exports.persistAngleOutputs(params))[0]
          : await exports.persistUpscaleOutput(params);
      assert.equal(fetches, 1);
      assert.equal(prepared, 1);
      assert.equal(output.url, imageDisplay.sourceUrl);
      assert.equal(output.persisted, true);
      assert.equal(records[0].url, imageDisplay.sourceUrl);
      assert.deepEqual(output.imageDisplay, failed ? undefined : imageDisplay);
      assert.deepEqual(
        records[0].metadata.imageDisplay,
        failed ? undefined : imageDisplay,
      );
    });
