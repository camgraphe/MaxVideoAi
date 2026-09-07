import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { makeCancelSignal, renderMedia, selectComposition } from '@remotion/renderer';
import { ensureReusableAsset } from '@/server/media-library';
import {
  buildPublicStorageUrl,
  deleteStorageObjectByUrl,
  StorageUploadError,
  uploadFilePath,
} from '@/server/storage';
import { createVideoThumbnailFromFile } from '@/server/upload-thumbnails';
import type { MediaAssetRecord } from '@/server/media-library-records';
import type { WorkspaceTimelineRenderManifest } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';
import { releaseFailedTimelineExportBilling } from './billing';
import {
  completeTimelineExportJob,
  failTimelineExportJob,
  updateTimelineExportProgress,
  type TimelineExportJobRecord,
} from './repository';
import type { TimelineExportRenderProps } from '@/remotion/timeline-export/types';
import { parseTimelineExportManifest } from './render-request';
import { validateTimelineExportManifestMediaUrls } from './media-security';

const DEFAULT_RENDER_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_RENDER_TIMEOUT_MS = 45 * 60 * 1000;
const MIN_RENDER_TIMEOUT_MS = 60 * 1000;
const MAX_RENDER_CONCURRENCY = 2;
export const MAX_TIMELINE_EXPORT_OUTPUT_BYTES = 512 * 1024 * 1024;

export function assertTimelineExportOutputSize(sizeBytes: number): void {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) throw new Error('TIMELINE_EXPORT_OUTPUT_EMPTY');
  if (sizeBytes > MAX_TIMELINE_EXPORT_OUTPUT_BYTES) throw new Error('TIMELINE_EXPORT_OUTPUT_TOO_LARGE');
}

export async function runTimelineExportRenderWithLimits<T>(params: {
  render: () => Promise<T>;
  cancel: () => void;
  timeoutMs: number;
  maxOutputBytes: number;
  readOutputSize: () => number;
  monitorIntervalMs?: number;
}): Promise<T> {
  const timeoutMs = Math.max(1, Math.round(params.timeoutMs));
  const monitorIntervalMs = Math.max(10, Math.round(params.monitorIntervalMs ?? 250));
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let monitor: ReturnType<typeof setInterval> | undefined;
  let cancelled = false;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    try {
      params.cancel();
    } catch {
      // The limit error remains authoritative if cancellation reports its own failure.
    }
  };
  const limitPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      cancel();
      reject(new Error('TIMELINE_EXPORT_RENDER_TIMEOUT'));
    }, timeoutMs);
    monitor = setInterval(() => {
      try {
        if (params.readOutputSize() > params.maxOutputBytes) {
          cancel();
          reject(new Error('TIMELINE_EXPORT_OUTPUT_TOO_LARGE'));
        }
      } catch (error) {
        cancel();
        reject(error);
      }
    }, monitorIntervalMs);
  });
  try {
    return await Promise.race([params.render(), limitPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (monitor) clearInterval(monitor);
  }
}

export async function runTimelineExportRenderWithTimeout<T>(params: {
  render: () => Promise<T>;
  cancel: () => void;
  timeoutMs: number;
}): Promise<T> {
  return runTimelineExportRenderWithLimits({
    ...params,
    maxOutputBytes: Number.POSITIVE_INFINITY,
    readOutputSize: () => 0,
  });
}

function timelineExportRenderTimeoutMs(): number {
  const configured = Number(process.env.TIMELINE_EXPORT_RENDER_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_RENDER_TIMEOUT_MS;
  return Math.max(MIN_RENDER_TIMEOUT_MS, Math.min(MAX_RENDER_TIMEOUT_MS, Math.round(configured)));
}

function frontendRoot(): string {
  return process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend');
}

function parseAspectRatio(value: string | null | undefined): number {
  const match = String(value ?? '16:9').match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return 16 / 9;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : 16 / 9;
}

function baseHeightForResolution(resolution: string | null): number {
  const normalized = String(resolution ?? '').toLowerCase();
  if (normalized.includes('2160') || normalized.includes('4k')) return 2160;
  if (normalized.includes('720')) return 720;
  return 1080;
}

function renderDimensions(manifest: WorkspaceTimelineRenderManifest, resolution: string | null): { width: number; height: number } {
  const height = baseHeightForResolution(resolution);
  const width = Math.round(height * parseAspectRatio(manifest.projectSettings?.aspectRatio));
  return { width, height };
}

function exportSettings(job: TimelineExportJobRecord): { includeAudio?: boolean } {
  return job.export_settings as { includeAudio?: boolean };
}

export async function publishTimelineExportArtifactWithDependencies(params: {
  outputPath: string;
  outputSize: number;
  userId: string;
  exportId: string;
  projectName: string;
  width: number;
  height: number;
}, dependencies: {
  createLocalThumbnail: typeof createVideoThumbnailFromFile;
  uploadPath: typeof uploadFilePath;
  ensureAsset: typeof ensureReusableAsset;
  deleteRemote: typeof deleteStorageObjectByUrl;
}): Promise<MediaAssetRecord> {
  const fileName = `${params.projectName}.mp4`;
  const thumbUrl = await dependencies.createLocalThumbnail({
    path: params.outputPath,
    userId: params.userId,
    fileName,
  });
  const cleanupRemote = async (urls: Array<string | null>) => {
    await Promise.all(urls.filter((url): url is string => Boolean(url)).map((url) => (
      dependencies.deleteRemote(url).catch(() => false)
    )));
  };
  let upload: Awaited<ReturnType<typeof uploadFilePath>>;
  try {
    upload = await dependencies.uploadPath({
      path: params.outputPath,
      sizeBytes: params.outputSize,
      mime: 'video/mp4',
      userId: params.userId,
      prefix: 'timeline-exports',
      fileName,
    });
  } catch (error) {
    const attemptedUploadUrl = error instanceof StorageUploadError && error.context.key
      ? buildPublicStorageUrl(error.context.key)
      : null;
    await cleanupRemote([attemptedUploadUrl, thumbUrl]);
    throw error;
  }
  try {
    return await dependencies.ensureAsset({
      userId: params.userId,
      url: upload.url,
      kind: 'video',
      source: 'import',
      sourceJobId: params.exportId,
      label: fileName,
      mimeType: 'video/mp4',
      width: params.width,
      height: params.height,
      sizeBytes: params.outputSize,
      thumbUrl,
      allowRemoteThumbnailFallback: false,
    });
  } catch (error) {
    await cleanupRemote([upload.url, thumbUrl]);
    throw error;
  }
}

const timelineExportArtifactDependencies = {
  createLocalThumbnail: createVideoThumbnailFromFile,
  uploadPath: uploadFilePath,
  ensureAsset: ensureReusableAsset,
  deleteRemote: deleteStorageObjectByUrl,
};

export async function renderTimelineExportJob(job: TimelineExportJobRecord): Promise<void> {
  const outputDir = join(tmpdir(), 'maxvideoai-timeline-exports', job.id);
  const outputPath = join(outputDir, `${job.id}.mp4`);
  mkdirSync(outputDir, { recursive: true });

  try {
    await updateTimelineExportProgress({ exportId: job.id, progress: 15, message: 'Preparing server render.' });
    const parsedManifest = parseTimelineExportManifest(job.render_manifest);
    const manifest = await validateTimelineExportManifestMediaUrls({
      manifest: parsedManifest,
      requestOrigin: process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://maxvideoai.com',
    });
    const dimensions = renderDimensions(manifest, job.resolution);
    const fps = job.fps ?? manifest.projectSettings?.fps ?? 30;
    const inputProps: TimelineExportRenderProps = {
      manifest,
      width: dimensions.width,
      height: dimensions.height,
      fps,
      includeAudio: exportSettings(job).includeAudio ?? true,
      mediaTrust: 'server-validated',
    };
    const serveUrl = await bundle({
      entryPoint: join(frontendRoot(), 'src/remotion/timeline-export/Root.tsx'),
    });
    const composition = await selectComposition({
      serveUrl,
      id: 'MaxVideoAITimelineExport',
      inputProps,
    });
    await updateTimelineExportProgress({ exportId: job.id, progress: 35, message: 'Rendering frames.' });
    const { cancel, cancelSignal } = makeCancelSignal();
    await runTimelineExportRenderWithLimits({
      timeoutMs: timelineExportRenderTimeoutMs(),
      cancel,
      maxOutputBytes: MAX_TIMELINE_EXPORT_OUTPUT_BYTES,
      readOutputSize: () => existsSync(outputPath) ? statSync(outputPath).size : 0,
      render: () => renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: outputPath,
        inputProps,
        chromiumOptions: { gl: 'angle' },
        concurrency: MAX_RENDER_CONCURRENCY,
        timeoutInMilliseconds: 60_000,
        cancelSignal,
        onProgress: ({ progress }) => {
          void updateTimelineExportProgress({
            exportId: job.id,
            progress: 35 + Math.round(progress * 55),
            message: 'Rendering MP4.',
          });
        },
      }),
    });

    if (!existsSync(outputPath)) {
      throw new Error('TIMELINE_EXPORT_OUTPUT_MISSING');
    }
    const outputSize = statSync(outputPath).size;
    assertTimelineExportOutputSize(outputSize);
    await updateTimelineExportProgress({ exportId: job.id, progress: 95, message: 'Uploading export.' });
    const asset = await publishTimelineExportArtifactWithDependencies({
      outputPath,
      outputSize,
      userId: job.user_id,
      exportId: job.id,
      projectName: job.project_name,
      width: dimensions.width,
      height: dimensions.height,
    }, timelineExportArtifactDependencies);
    await completeTimelineExportJob({
      exportId: job.id,
      outputUrl: asset.url,
      outputAssetId: asset.id,
      sizeBytes: outputSize,
      mimeType: 'video/mp4',
      billingStatus: job.billing_status === 'free_reserved' ? 'free_completed' : 'paid_completed',
    });
  } catch (error) {
    const nextBillingStatus = await releaseFailedTimelineExportBilling({
      userId: job.user_id,
      exportId: job.id,
      billingStatus: job.billing_status,
      amountCents: job.amount_cents,
    });
    await failTimelineExportJob({
      exportId: job.id,
      message: error instanceof Error ? error.message : 'RENDER_FAILED',
      billingStatus: nextBillingStatus,
    });
  } finally {
    if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
  }
}
