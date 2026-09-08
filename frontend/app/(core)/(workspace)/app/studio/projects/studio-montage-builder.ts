import {
  MONTAGE_MAX_CLIPS,
  MONTAGE_MAX_DURATION_SECONDS,
  MONTAGE_MIN_CLIPS,
  type CreateStudioMontageInput,
  type MontageSettings,
} from '@/lib/studio/montage-contract';
import type { WorkspaceLibraryAsset } from '../workspace/_lib/workspace-library-assets';

export type StudioMontageLibraryAsset = {
  assetId: string;
  durationSec: number;
  name: string;
  thumbnailUrl: string | null;
};

export type StudioMontageClipDraft = CreateStudioMontageInput['clips'][number] & {
  occurrenceId: string;
  assetName: string;
  measuredDurationSec: number;
};

export function studioMontageLibraryAsset(asset: WorkspaceLibraryAsset): StudioMontageLibraryAsset | null {
  const ref = asset.ref;
  const durationSec = asset.mediaFacts?.source === 'probe' ? asset.mediaFacts.durationSec : null;
  if (ref?.type !== 'asset' || ref.kind !== 'video' || !/^ma_[a-f0-9]{32}$/u.test(ref.assetId)
    || typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  return { assetId: ref.assetId, durationSec, name: asset.name, thumbnailUrl: asset.thumbUrl ?? null };
}

export function createStudioMontageClipDraft(params: {
  asset: StudioMontageLibraryAsset;
  fps: MontageSettings['fps'];
  occurrenceId: string;
}): StudioMontageClipDraft {
  return {
    occurrenceId: params.occurrenceId,
    assetId: params.asset.assetId,
    assetName: params.asset.name,
    measuredDurationSec: params.asset.durationSec,
    sourceInFrame: 0,
    durationFrames: Math.max(1, Math.floor(params.asset.durationSec * params.fps)),
  };
}

export function retimeStudioMontageClips(
  clips: StudioMontageClipDraft[],
  previousFps: MontageSettings['fps'],
  nextFps: MontageSettings['fps'],
): StudioMontageClipDraft[] {
  return clips.map((clip) => ({
    ...clip,
    sourceInFrame: Math.round((clip.sourceInFrame / previousFps) * nextFps),
    durationFrames: Math.max(1, Math.round((clip.durationFrames / previousFps) * nextFps)),
  }));
}

export function validateStudioMontageDraft(params: {
  title: string;
  settings: MontageSettings;
  clips: StudioMontageClipDraft[];
}): 'title' | 'count' | 'trim' | 'duration' | null {
  if (!params.title.trim() || params.title !== params.title.trim() || params.title.length > 80) return 'title';
  if (params.clips.length < MONTAGE_MIN_CLIPS || params.clips.length > MONTAGE_MAX_CLIPS) return 'count';
  if (params.clips.some((clip) => !Number.isSafeInteger(clip.sourceInFrame) || clip.sourceInFrame < 0
    || !Number.isSafeInteger(clip.durationFrames) || clip.durationFrames <= 0
    || clip.sourceInFrame + clip.durationFrames > Math.floor(clip.measuredDurationSec * params.settings.fps))) return 'trim';
  const totalFrames = params.clips.reduce((total, clip) => total + clip.durationFrames, 0);
  return totalFrames > MONTAGE_MAX_DURATION_SECONDS * params.settings.fps ? 'duration' : null;
}

export function studioMontageBusinessPayload(params: {
  title: string;
  settings: MontageSettings;
  clips: StudioMontageClipDraft[];
}) {
  return {
    title: params.title,
    settings: params.settings,
    clips: params.clips.map(({ assetId, sourceInFrame, durationFrames }) => ({ assetId, sourceInFrame, durationFrames })),
  };
}
