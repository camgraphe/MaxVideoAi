import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { ensureReusableAsset } from '@/server/media-library';
import { uploadFileBuffer } from '@/server/storage';
import type { WorkspaceTimelineRenderManifest } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';
import { releaseFailedTimelineExportBilling } from './billing';
import {
  completeTimelineExportJob,
  failTimelineExportJob,
  updateTimelineExportProgress,
  type TimelineExportJobRecord,
} from './repository';
import type { TimelineExportRenderProps } from '@/remotion/timeline-export/types';

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

function jobManifest(job: TimelineExportJobRecord): WorkspaceTimelineRenderManifest {
  return job.render_manifest as WorkspaceTimelineRenderManifest;
}

function exportSettings(job: TimelineExportJobRecord): { includeAudio?: boolean } {
  return job.export_settings as { includeAudio?: boolean };
}

export async function renderTimelineExportJob(job: TimelineExportJobRecord): Promise<void> {
  const outputDir = join(tmpdir(), 'maxvideoai-timeline-exports', job.id);
  const outputPath = join(outputDir, `${job.id}.mp4`);
  mkdirSync(outputDir, { recursive: true });

  try {
    await updateTimelineExportProgress({ exportId: job.id, progress: 15, message: 'Preparing server render.' });
    const manifest = jobManifest(job);
    const dimensions = renderDimensions(manifest, job.resolution);
    const fps = job.fps ?? manifest.projectSettings?.fps ?? 30;
    const inputProps: TimelineExportRenderProps = {
      manifest,
      width: dimensions.width,
      height: dimensions.height,
      fps,
      includeAudio: exportSettings(job).includeAudio ?? true,
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
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      chromiumOptions: { gl: 'angle' },
      onProgress: ({ progress }) => {
        void updateTimelineExportProgress({
          exportId: job.id,
          progress: 35 + Math.round(progress * 55),
          message: 'Rendering MP4.',
        });
      },
    });

    const data = readFileSync(outputPath);
    await updateTimelineExportProgress({ exportId: job.id, progress: 95, message: 'Uploading export.' });
    const upload = await uploadFileBuffer({
      data,
      mime: 'video/mp4',
      userId: job.user_id,
      prefix: 'timeline-exports',
      fileName: `${job.project_name}.mp4`,
    });
    const asset = await ensureReusableAsset({
      userId: job.user_id,
      url: upload.url,
      kind: 'video',
      source: 'import',
      sourceJobId: job.id,
      label: `${job.project_name}.mp4`,
      mimeType: 'video/mp4',
      width: dimensions.width,
      height: dimensions.height,
      sizeBytes: data.length,
    });
    await completeTimelineExportJob({
      exportId: job.id,
      outputUrl: upload.url,
      outputAssetId: asset.id,
      sizeBytes: data.length,
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
