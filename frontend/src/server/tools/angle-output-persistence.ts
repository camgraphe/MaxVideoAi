import { isStorageConfigured, recordUserAsset, uploadImageToStorage } from '@/server/storage';
import type { AngleToolEngineId, AngleToolOutput } from '@/types/tools-angle';

async function persistAngleOutput(params: {
  output: AngleToolOutput;
  outputIndex: number;
  userId: string;
  jobId: string;
  providerJobId?: string | null;
  engineId: AngleToolEngineId;
  engineLabel: string;
}): Promise<AngleToolOutput> {
  const { output, outputIndex, userId, jobId, providerJobId, engineId, engineLabel } = params;
  if (!isStorageConfigured() || !output.url) {
    return output;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch(output.url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`fetch failed (${response.status})`);
    }

    const mimeHeader = response.headers.get('content-type') ?? '';
    const mime =
      typeof output.mimeType === 'string' && output.mimeType.startsWith('image/')
        ? output.mimeType
        : mimeHeader.startsWith('image/')
          ? mimeHeader
          : 'image/png';

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      throw new Error('empty image');
    }

    const upload = await uploadImageToStorage({
      data: buffer,
      mime,
      userId,
      prefix: 'angle',
      fileName: `angle-${engineId}-${outputIndex + 1}.${mime.split('/')[1] || 'png'}`,
    });

    const assetId = await recordUserAsset({
      userId,
      url: upload.url,
      mime: upload.mime,
      width: upload.width ?? output.width ?? null,
      height: upload.height ?? output.height ?? null,
      size: upload.size,
      source: 'angle',
      metadata: {
        originUrl: output.url,
        jobId,
        providerJobId: providerJobId ?? null,
        tool: 'angle',
        label: 'angle',
        engineId,
        engineLabel,
        outputIndex,
      },
    });

    return {
      ...output,
      url: upload.url,
      width: upload.width ?? output.width ?? null,
      height: upload.height ?? output.height ?? null,
      mimeType: upload.mime,
      originUrl: output.url,
      assetId,
      source: 'angle',
      persisted: true,
    };
  } catch (error) {
    console.warn('[tools/angle] failed to persist output', {
      engineId,
      jobId,
      outputIndex,
      error: error instanceof Error ? error.message : String(error),
    });
    return output;
  }
}

export async function persistAngleOutputs(params: {
  outputs: AngleToolOutput[];
  userId: string;
  jobId: string;
  providerJobId?: string | null;
  engineId: AngleToolEngineId;
  engineLabel: string;
}): Promise<AngleToolOutput[]> {
  const { outputs, userId, jobId, providerJobId, engineId, engineLabel } = params;
  return Promise.all(
    outputs.map((output, index) =>
      persistAngleOutput({
        output,
        outputIndex: index,
        userId,
        jobId,
        providerJobId,
        engineId,
        engineLabel,
      })
    )
  );
}
