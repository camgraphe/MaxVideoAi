import { z } from 'zod';
import { createBoundedMediaDownloader } from '@/server/agent-api/reference-file-download';
import { uploadFileBuffer } from '@/server/storage';
import { createUploadVideoThumbnail } from '@/server/upload-thumbnails';
import { upsertJobOutputs } from '@/server/media-library';
import type { ToolResult } from '@/lib/toolbox/contract';
import type { PreparedFinishingTool } from './finishing-prepare';
import { readToolVideoMetadata } from './toolbox-video-metadata';

const downloadOutput = createBoundedMediaDownloader({ accepted: ['video/mp4', 'video/quicktime', 'video/webm'], maxBytes: 500 * 1024 * 1024 });
export async function persistFinishingOutput(userId: string, jobId: string, prepared: PreparedFinishingTool, data: unknown): Promise<ToolResult> {
  const output = z.object({ video: z.object({ url: z.string().url().refine(url => url.startsWith('https://')) }) }).parse(data).video;
  const file = await downloadOutput({ file_id: jobId, download_url: output.url });
  const stored = await uploadFileBuffer({ data: Buffer.from(file.bytes), mime: file.mimeType, userId, prefix: 'tool-results', fileName: `${prepared.block.toolId}.${file.mimeType === 'video/webm' ? 'webm' : file.mimeType === 'video/quicktime' ? 'mov' : 'mp4'}` });
  const facts = await readToolVideoMetadata(stored.url, userId);
  validateFinishingOutputFacts(prepared, facts);
  const thumbnailUrl = await createUploadVideoThumbnail({ data: Buffer.from(file.bytes), userId, fileName: jobId });
  const outputId = `${jobId}:video:0`;
  await upsertJobOutputs([{ id: outputId, jobId, userId, kind: 'video', url: stored.url, storageUrl: stored.url,
    thumbUrl: thumbnailUrl, previewUrl: null, mimeType: file.mimeType, width: facts.width, height: facts.height, durationSec: Math.ceil(facts.durationSec), position: 0, status: 'ready',
    metadata: { toolId: prepared.block.toolId, profileId: prepared.profile.id, sourceAssets: prepared.block.inputs, mediaFacts: facts } }]);
  return { toolId: prepared.block.toolId, version: 1, jobId, sourceAssets: prepared.block.inputs,
    outputs: [{ asset: { type: 'job-output', jobId, outputId, kind: 'video' }, originalUrl: stored.url, kind: 'video', thumbnailUrl }] };
}

export function validateFinishingOutputFacts(prepared: Pick<PreparedFinishingTool, 'block' | 'facts' | 'settings'>, actual: PreparedFinishingTool['facts']) {
  if (![actual.width, actual.height, actual.durationSec, actual.fps].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)) throw new Error('Invalid output metadata.');
  if (Math.abs(actual.durationSec - prepared.facts.durationSec) > Math.max(0.25, prepared.facts.durationSec * 0.02)) throw new Error('Unexpected output duration.');
  if (typeof prepared.facts.hasAudio === 'boolean' && prepared.facts.hasAudio !== actual.hasAudio) throw new Error('Unexpected output audio presence.');
  const targetFps = 'fps' in prepared.settings ? prepared.settings.fps : prepared.facts.fps;
  if (!actual.fps || !targetFps || Math.abs(actual.fps - targetFps) > 0.1) throw new Error('Unexpected output frame rate.');
  if (prepared.block.toolId !== 'restore-video' && (actual.width !== prepared.facts.width || actual.height !== prepared.facts.height)) throw new Error('Unexpected output dimensions.');
  if (prepared.block.toolId === 'restore-video') {
    if (!('resolution' in prepared.settings)) throw new Error('Missing output resolution.');
    // Use a 3840×2160 pixel budget for 4K, independent of orientation.
    // The 1% acceptance envelope is our conservative rounding policy, not a
    // claim of provider quality; the owner-approved pilot still validates output.
    const expectedPixels = prepared.settings.resolution === '4k' ? 3840 * 2160 : 1920 * 1080;
    if (Math.abs(actual.width * actual.height - expectedPixels) / expectedPixels > 0.01) throw new Error('Unexpected output resolution.');
  }
  const sourceRatio = prepared.facts.width / prepared.facts.height;
  if (Math.abs(actual.width / actual.height - sourceRatio) / sourceRatio > 0.01) throw new Error('Unexpected output aspect ratio.');
}
