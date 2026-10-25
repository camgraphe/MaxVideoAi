import type { EngineCaps, Mode } from '@/types/engines';
import { resolveActiveVideoInputField, VIDEO_MEDIA_FIELD_CANDIDATES } from '@/lib/video-input-schema';

/** Older/API snapshots may record typed references without UI slot attachments. */
export function snapshotReferenceInputs(refs: Record<string, unknown>, engine: EngineCaps, mode: Mode): unknown {
  const inputs = Array.isArray(refs.inputs) ? [...refs.inputs] : [];
  const bind = (value: unknown, candidates: readonly string[], kind: 'image' | 'video' | 'audio') => {
    const urls = (Array.isArray(value) ? value : [value]).filter(
      (url): url is string => typeof url === 'string' && url.length > 0,
    );
    if (!urls.length) return;
    const field = resolveActiveVideoInputField({
      inputSchema: engine.inputSchema,
      mode,
      candidateFieldIds: candidates,
      type: kind,
    });
    if (!field || inputs.some((input) => input && typeof input === 'object' && input.slotId === field.id)) return;
    for (const url of urls)
      inputs.push({ slotId: field.id, kind, url, name: field.label ?? kind, type: `${kind}/*`, size: 0 });
  };
  bind(refs.firstFrameUrl ?? refs.imageUrl, VIDEO_MEDIA_FIELD_CANDIDATES.firstFrame, 'image');
  bind(refs.lastFrameUrl ?? refs.endImageUrl, VIDEO_MEDIA_FIELD_CANDIDATES.lastFrame, 'image');
  bind(refs.referenceImages, VIDEO_MEDIA_FIELD_CANDIDATES.referenceImage, 'image');
  bind(
    refs.videoUrls,
    [...VIDEO_MEDIA_FIELD_CANDIDATES.sourceVideo, ...VIDEO_MEDIA_FIELD_CANDIDATES.referenceVideo],
    'video',
  );
  bind(
    refs.audioUrl,
    [...VIDEO_MEDIA_FIELD_CANDIDATES.sourceAudio, ...VIDEO_MEDIA_FIELD_CANDIDATES.referenceAudio],
    'audio',
  );
  return inputs.length ? inputs : refs.inputs;
}
