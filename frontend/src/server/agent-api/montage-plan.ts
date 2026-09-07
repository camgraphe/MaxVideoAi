import { AgentApiError, withMediaNeutralReferenceMessage } from './errors';
import type { AgentPrincipal } from './principal';
import {
  resolveOwnedReferenceAsset,
  type OwnedReferenceAsset,
} from './reference-assets';

export const MONTAGE_FPS = [24, 25, 30, 60] as const;
export const MONTAGE_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5', '21:9'] as const;
export const MONTAGE_RESOLUTIONS = ['720p', '1080p'] as const;
export const MONTAGE_AUDIO_MODES = ['preserve', 'mute'] as const;
export const MONTAGE_MIN_CLIPS = 2;
export const MONTAGE_MAX_CLIPS = 12;
export const MONTAGE_MAX_DURATION_SECONDS = 180;

export type MontageSettings = {
  fps: (typeof MONTAGE_FPS)[number];
  aspectRatio: (typeof MONTAGE_ASPECT_RATIOS)[number];
  resolution: (typeof MONTAGE_RESOLUTIONS)[number];
  audioMode: (typeof MONTAGE_AUDIO_MODES)[number];
};

export type PrepareMontageInput = {
  title: string;
  settings: MontageSettings;
  clips: Array<{
    assetId: string;
    sourceInFrame: number;
    durationFrames: number;
  }>;
};

export type MontageEditPlan = {
  schemaVersion: 1;
  status: 'edit_plan';
  persisted: false;
  title: string;
  settings: MontageSettings;
  clips: Array<{
    clipId: string;
    assetId: string;
    label: string;
    sourceInFrame: number;
    timelineStartFrame: number;
    durationFrames: number;
  }>;
  totalFrames: number;
  totalSeconds: number;
  orderingBasis: 'caller_supplied';
  nextAction: string;
};

export type MontageAssetResolver = (
  principal: AgentPrincipal,
  assetId: string,
) => Promise<OwnedReferenceAsset>;

function invalid(message: string): never {
  throw new AgentApiError('PARAMETER_INVALID', message);
}

function safeLabel(asset: OwnedReferenceAsset, index: number): string {
  const candidate = asset.originalName
    ?.replace(/[\u0000-\u001f\u007f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return candidate ? candidate.slice(0, 120) : `Video clip ${index + 1}`;
}

export function buildMontageEditPlan(
  input: PrepareMontageInput,
  assets: readonly OwnedReferenceAsset[],
): MontageEditPlan {
  if (input.title !== input.title.trim() || input.title.length < 1 || input.title.length > 80) {
    invalid('Montage title must contain 1–80 trimmed characters.');
  }
  if (input.clips.length < MONTAGE_MIN_CLIPS || input.clips.length > MONTAGE_MAX_CLIPS) {
    invalid(`A montage requires ${MONTAGE_MIN_CLIPS}–${MONTAGE_MAX_CLIPS} clips.`);
  }
  if (assets.length !== input.clips.length) invalid('Every montage clip must resolve to owned media.');

  let timelineStartFrame = 0;
  const clips = input.clips.map((clip, index) => {
    if (!Number.isSafeInteger(clip.sourceInFrame) || clip.sourceInFrame < 0) {
      invalid(`Clip ${index + 1} sourceInFrame must be a nonnegative integer.`);
    }
    if (!Number.isSafeInteger(clip.durationFrames) || clip.durationFrames <= 0) {
      invalid(`Clip ${index + 1} durationFrames must be a positive integer.`);
    }
    const asset = assets[index];
    if (!asset || asset.assetId !== clip.assetId || asset.mediaKind !== 'video') {
      throw new AgentApiError('REFERENCE_INVALID', `Clip ${index + 1} must use an owned ready video.`);
    }
    if (asset.durationSec === null) {
      throw new AgentApiError(
        'REFERENCE_INVALID',
        `Clip ${index + 1} is missing measured source duration. Choose another ready video.`,
      );
    }
    const measuredFrames = Math.floor(asset.durationSec * input.settings.fps + 1e-9);
    if (clip.sourceInFrame + clip.durationFrames > measuredFrames) {
      throw new AgentApiError(
        'PARAMETER_INVALID',
        `Clip ${index + 1} trim exceeds its measured ${measuredFrames}-frame source at ${input.settings.fps} fps.`,
      );
    }
    const planned = {
      clipId: `clip_${String(index + 1).padStart(2, '0')}`,
      assetId: clip.assetId,
      label: safeLabel(asset, index),
      sourceInFrame: clip.sourceInFrame,
      timelineStartFrame,
      durationFrames: clip.durationFrames,
    };
    timelineStartFrame += clip.durationFrames;
    return planned;
  });

  const maxFrames = input.settings.fps * MONTAGE_MAX_DURATION_SECONDS;
  if (timelineStartFrame > maxFrames) {
    invalid(`Montage duration exceeds the ${MONTAGE_MAX_DURATION_SECONDS}-second limit at ${input.settings.fps} fps.`);
  }

  return {
    schemaVersion: 1,
    status: 'edit_plan',
    persisted: false,
    title: input.title,
    settings: { ...input.settings },
    clips,
    totalFrames: timelineStartFrame,
    totalSeconds: timelineStartFrame / input.settings.fps,
    orderingBasis: 'caller_supplied',
    nextAction: 'Review this caller-ordered edit plan. It has not been rendered or saved as a Studio project.',
  };
}

export function createPrepareMontageService(
  resolveAsset: MontageAssetResolver = (principal, assetId) => resolveOwnedReferenceAsset(principal, assetId),
): (input: PrepareMontageInput, principal: AgentPrincipal) => Promise<MontageEditPlan> {
  return async (input, principal) => {
    const assets: OwnedReferenceAsset[] = [];
    for (const clip of input.clips) {
      try {
        assets.push(await resolveAsset(principal, clip.assetId));
      } catch (error) {
        if (error instanceof AgentApiError) throw withMediaNeutralReferenceMessage(error);
        throw error;
      }
    }
    return buildMontageEditPlan(input, assets);
  };
}
