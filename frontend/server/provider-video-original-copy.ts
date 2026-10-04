import { createHash } from 'node:crypto';
import { type GeneratedVideoFacts, type VideoProbeResult } from '@/lib/generated-video-media-facts';
import { probeGeneratedVideoFile, publishVideoFacts } from './media/generated-video-facts';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { uploadFilePath } from './storage';

const MAX_COPY_BYTES = 450 * 1024 * 1024; // One file within the serverless temporary disk budget.

/** Bounded disk streaming; the provider original is uploaded byte-for-byte. */
export async function copyProviderVideoOriginal(response: Response, options: { jobId: string; userId?: string | null; onVideoMediaFacts?: (facts: GeneratedVideoFacts) => void },
  dependencies: { upload: typeof uploadFilePath; maxBytes: number; probe?: (path: string) => Promise<VideoProbeResult | null> } = { upload: uploadFilePath, maxBytes: MAX_COPY_BYTES }): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > dependencies.maxBytes) throw new Error('Provider video exceeds the direct-copy disk budget.');
  if (!response.body) throw new Error('Provider video body is missing.');
  const directory = await mkdtemp(join(tmpdir(), 'provider-original-'));
  const filePath = join(directory, 'original.mp4');
  const file = await open(filePath, 'w');
  const reader = response.body.getReader();
  let bytes = 0;
  const hash = options.userId && options.onVideoMediaFacts ? createHash('sha256') : null;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > dependencies.maxBytes) throw new Error('Provider video exceeds the direct-copy disk budget.');
      hash?.update(chunk.value);
      await file.writeFile(chunk.value);
    }
    await file.close();
    if (!bytes || (declared > 0 && declared !== bytes)) throw new Error('Provider video download is incomplete.');
    const uploaded = (await dependencies.upload({ path: filePath, sizeBytes: bytes, mime: 'video/mp4',
      userId: options.userId, prefix: 'renders', fileName: `${options.jobId}-original.mp4` })).url;
    if (hash && options.onVideoMediaFacts) {
      const probe = await (dependencies.probe ?? probeGeneratedVideoFile)(filePath).catch(() => null);
      publishVideoFacts(probe, { url: uploaded, sha256: hash.digest('hex'), sizeBytes: bytes }, options.onVideoMediaFacts);
    }
    return uploaded;
  } finally {
    await reader.cancel().catch(() => undefined);
    await file.close().catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
}
