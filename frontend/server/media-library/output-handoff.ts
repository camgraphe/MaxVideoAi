import { imageDisplayFields } from '@/lib/image-display';
import { extractStoryboardGeneratorDraftFromPrompt } from '@/lib/storyboard-generator-handoff';
import type { JobOutputRecord } from '../media-library-records';
export function buildRecentOutputStoryboardHandoff(output: JobOutputRecord) {
    if (!output.jobPrompt)
        return null;
    return extractStoryboardGeneratorDraftFromPrompt(output.jobPrompt, {
        durationSec: output.jobDurationSec ?? output.durationSec,
        aspectRatio: output.jobAspectRatio,
        width: output.width,
        height: output.height,
    });
}
export function buildRecentOutputImage(output: JobOutputRecord | null | undefined) {
    if (!output?.url)
        return null;
    return {
        id: output.id,
        jobId: output.jobId,
        url: output.url,
        thumbUrl: output.thumbUrl,
        previewUrl: output.previewUrl,
      ...(output.kind === 'image' ? imageDisplayFields(output.metadata.imageDisplay, output.url, output.previewUrl) : {}),
        mime: output.mimeType,
        width: output.width,
        height: output.height,
        createdAt: output.createdAt,
    };
}
