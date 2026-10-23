import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { build } from 'esbuild';
import { createStorageFileKey } from '../../frontend/server/storage';
import type { copyRemoteMedia } from '../../frontend/server/media-library/asset-media';

/** Real library copy and key builder; only external transport/probe/storage are replaced. */
export async function generatedAudioCopyFixture(bytes: Buffer, sourceUrl: string) {
  const frontend = path.resolve('frontend');
  const fixture = {
    readUrls: [] as string[], uploads: [] as { data: Buffer; mime: string; fileName?: string }[],
    upload(input: { data: Buffer; mime: string; fileName?: string }) {
      fixture.uploads.push(input);
      const key = createStorageFileKey({ ...input, prefix: 'media-assets', userId: 'audio-owner' });
      return { key, url: `https://media.maxvideoai.com/${key}` };
    },
  };
  const stubs: Record<string, string> = {
    '@/server/storage': 'export const uploadFileBuffer=async input=>fixture.upload(input);export const uploadImageToStorage=()=>{throw Error("Unexpected image upload")};export const extractStorageKeyFromUrl=()=>{throw Error("Unexpected video storage key read")};',
    '@/server/owned-media-read-access': 'export const createOwnedMediaReadUrl=async ({url})=>{fixture.readUrls.push(url);return url};',
    '@/server/media/detect-has-audio': 'export const probeMediaBuffer=async()=>({kind:"audio",canonicalMime:"audio/mpeg",durationSec:10.371});',
    '@/server/media/generated-video-facts': 'export const measureGeneratedVideoBuffer=()=>{throw Error("Unexpected video probe")};',
    '@/server/upload-thumbnails': 'export const createUploadVideoThumbnail=()=>{throw Error("Unexpected thumbnail")};',
  };
  const bundle = await build({ absWorkingDir: frontend, entryPoints: ['server/media-library/asset-media.ts'],
    tsconfig: path.join(frontend, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'audio-copy', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: frontend }));
    } }],
  });
  const module = { exports: {} as { copyRemoteMedia: typeof copyRemoteMedia } };
  runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, fixture, URL, Buffer, console,
    setTimeout, clearTimeout, AbortController, process: { env: {} }, require: createRequire(path.join(frontend, 'package.json')),
    fetch: async (url: string) => {
      if (url !== sourceUrl) throw new Error('Library copy changed the generated original');
      return new Response(bytes, { headers: { 'content-type': 'audio/mpeg' } });
    },
  });
  return { fixture, copyRemoteMedia: module.exports.copyRemoteMedia };
}
