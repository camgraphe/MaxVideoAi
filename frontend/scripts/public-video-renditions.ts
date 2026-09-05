import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  activatePublishedManifest,
  checkPublicVideoState,
  parsePublicVideoRenditionOptions,
  publishPreparedCheckpoints,
  validatePublishedManifest,
  verifyPublicHttpRendition,
  type PreparedCheckpoint,
  type PublicVideoSource,
  type PublishedManifest,
} from './_lib/public-video-renditions';
import type { PublicVideoRenditionProjection } from '../lib/public-video-renditions';

const CONFIG_DIR = path.resolve(__dirname, '../config');
const SOURCE_PATH = path.join(CONFIG_DIR, 'public-video-sources.json');
const MANIFEST_PATH = path.join(CONFIG_DIR, 'public-video-renditions.manifest.json');
const PROJECTION_PATH = path.join(CONFIG_DIR, 'public-video-renditions.generated.json');

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function loadSources(): Promise<PublicVideoSource[]> {
  const authored = await readJson<{
    schemaVersion: number;
    role: string;
    sources: Array<Omit<PublicVideoSource, 'role'>>;
  }>(SOURCE_PATH);
  if (authored.schemaVersion !== 1 || authored.role !== 'public-demo' || !Array.isArray(authored.sources)) {
    throw new Error('Invalid public video source list');
  }
  return authored.sources.map((source) => ({ ...source, role: 'public-demo' }));
}

function selectedSources(sources: PublicVideoSource[], assetIds: string[], maxAssets: number): PublicVideoSource[] {
  const selected = assetIds.length ? new Set(assetIds) : null;
  if (selected) {
    for (const assetId of selected) {
      if (!sources.some((source) => source.assetId === assetId)) throw new Error(`Unknown asset ID: ${assetId}`);
    }
  }
  return sources.filter((source) => !selected || selected.has(source.assetId)).slice(0, maxAssets);
}

async function main(): Promise<void> {
  // Parse all flags before reading configs, credentials, storage, or media.
  const options = parsePublicVideoRenditionOptions(process.argv.slice(2));
  const sources = await loadSources();
  const manifest = await readJson<PublishedManifest>(MANIFEST_PATH);
  const projection = await readJson<PublicVideoRenditionProjection>(PROJECTION_PATH);

  if (options.mode === 'check') {
    checkPublicVideoState({ sources, manifest, projection });
    if (options.http) {
      for (const entry of manifest.entries) {
        for (const profile of ['desktop', 'mobile'] as const) {
          const rendition = entry.renditions[profile];
          if (rendition) await verifyPublicHttpRendition(rendition.url, rendition.bytes);
        }
      }
    }
    console.log(`[public-video-renditions] check passed http=${options.http}`);
    return;
  }

  const selected = selectedSources(sources, options.assetIds, options.maxAssets);
  if (options.mode === 'prepare') {
    const { preparePublicVideoRenditions } = await import('./_lib/public-video-renditions-runtime');
    const checkpoints = await preparePublicVideoRenditions({
      workDir: path.resolve(options.workDir!), sources: selected, assetIds: options.assetIds, maxAssets: options.maxAssets,
    });
    console.log(`[public-video-renditions] prepared=${checkpoints.length} workDir=${path.resolve(options.workDir!)}`);
    return;
  }

  if (options.mode === 'publish') {
    validatePublishedManifest(manifest, sources);
    const workDir = path.resolve(options.workDir!);
    const checkpoints: PreparedCheckpoint[] = [];
    for (const source of selected) {
      const assetDir = path.join(workDir, source.assetId);
      const checkpoint = await readJson<PreparedCheckpoint>(path.join(assetDir, 'checkpoint.json'));
      if (checkpoint.assetId !== source.assetId || checkpoint.original.url !== source.url || checkpoint.original.sha256 !== source.sha256) {
        throw new Error(`Prepared checkpoint conflicts with authored source ${source.assetId}`);
      }
      if (path.resolve(checkpoint.original.path) !== path.join(assetDir, 'source.mp4')) {
        throw new Error(`Prepared checkpoint source path escapes its work directory for ${source.assetId}`);
      }
      for (const profile of ['desktop', 'mobile'] as const) {
        const rendition = checkpoint.renditions[profile];
        if (rendition && path.resolve(rendition.path) !== path.join(assetDir, `${profile}.mp4`)) {
          throw new Error(`Prepared checkpoint output path escapes its work directory for ${source.assetId} ${profile}`);
        }
      }
      checkpoints.push(checkpoint);
    }
    const { atomicWriteJson, readRemoteBytes } = await import('./_lib/public-video-renditions-runtime');
    const { uploadFileBufferToKey } = await import('../server/storage');
    const next = await publishPreparedCheckpoints(checkpoints, manifest, options.reviewEvidence!, {
      upload: uploadFileBufferToKey,
      readRemote: readRemoteBytes,
    });
    validatePublishedManifest(next, sources);
    await atomicWriteJson(MANIFEST_PATH, next);
    console.log(`[public-video-renditions] published=${checkpoints.length}`);
    return;
  }

  checkPublicVideoState({ sources, manifest, projection });
  const assetIds = new Set(selected.map((source) => source.assetId));
  const activated = await activatePublishedManifest(manifest, sources, {
    verifyHttp: verifyPublicHttpRendition,
    assetIds,
  });
  // Both values are computed and validated before either active file is changed.
  validatePublishedManifest(activated.manifest, sources);
  const { atomicWriteJson } = await import('./_lib/public-video-renditions-runtime');
  await atomicWriteJson(MANIFEST_PATH, activated.manifest);
  await atomicWriteJson(PROJECTION_PATH, activated.projection);
  console.log(`[public-video-renditions] activated=${assetIds.size}`);
}

void main().catch((error) => {
  console.error('[public-video-renditions] failed', error);
  process.exitCode = 1;
});
