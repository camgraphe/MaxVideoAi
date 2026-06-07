import type { AspectRatio, Resolution } from '@/types/engines';
import type { WorkspaceProjectSettings } from './workspace-types';

export const WORKSPACE_PROJECT_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5', '21:9'] as const satisfies readonly AspectRatio[];
export const WORKSPACE_PROJECT_RESOLUTIONS = ['720p', '1080p', '1440p', '4k'] as const satisfies readonly Resolution[];
export const WORKSPACE_PROJECT_FPS_OPTIONS = [24, 25, 30, 60] as const;

export const DEFAULT_WORKSPACE_PROJECT_SETTINGS: WorkspaceProjectSettings = {
  aspectRatio: '16:9',
  resolution: '1080p',
  fps: 24,
};

const RESOLUTION_BASE_PIXELS: Record<(typeof WORKSPACE_PROJECT_RESOLUTIONS)[number], number> = {
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '4k': 2160,
};

function isWorkspaceProjectAspectRatio(value: unknown): value is WorkspaceProjectSettings['aspectRatio'] {
  return WORKSPACE_PROJECT_ASPECT_RATIOS.some((aspectRatio) => aspectRatio === value);
}

function isWorkspaceProjectResolution(value: unknown): value is WorkspaceProjectSettings['resolution'] {
  return WORKSPACE_PROJECT_RESOLUTIONS.some((resolution) => resolution === value);
}

function isWorkspaceProjectFps(value: unknown): value is WorkspaceProjectSettings['fps'] {
  return WORKSPACE_PROJECT_FPS_OPTIONS.some((fps) => fps === value);
}

export function workspaceProjectAspectParts(aspectRatio: WorkspaceProjectSettings['aspectRatio']): [number, number] {
  const [width, height] = aspectRatio.split(':').map((part) => Number(part));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [16, 9];
  return [width, height];
}

function evenPixel(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

export function coerceWorkspaceProjectSettings(input: unknown): WorkspaceProjectSettings {
  const settings = input && typeof input === 'object' ? input as Partial<WorkspaceProjectSettings> : {};
  return {
    aspectRatio: isWorkspaceProjectAspectRatio(settings.aspectRatio)
      ? settings.aspectRatio
      : DEFAULT_WORKSPACE_PROJECT_SETTINGS.aspectRatio,
    resolution: isWorkspaceProjectResolution(settings.resolution)
      ? settings.resolution
      : DEFAULT_WORKSPACE_PROJECT_SETTINGS.resolution,
    fps: isWorkspaceProjectFps(settings.fps)
      ? settings.fps
      : DEFAULT_WORKSPACE_PROJECT_SETTINGS.fps,
  };
}

export function workspaceProjectAspectCssValue(settings: WorkspaceProjectSettings): string {
  const [width, height] = workspaceProjectAspectParts(settings.aspectRatio);
  return `${width} / ${height}`;
}

export function workspaceProjectDimensions(settings: WorkspaceProjectSettings): { width: number; height: number } {
  const [aspectWidth, aspectHeight] = workspaceProjectAspectParts(settings.aspectRatio);
  const basePixels = RESOLUTION_BASE_PIXELS[settings.resolution] ?? RESOLUTION_BASE_PIXELS['1080p'];
  if (aspectWidth >= aspectHeight) {
    return {
      width: evenPixel(basePixels * (aspectWidth / aspectHeight)),
      height: basePixels,
    };
  }
  return {
    width: basePixels,
    height: evenPixel(basePixels * (aspectHeight / aspectWidth)),
  };
}

export function workspaceProjectDimensionsLabel(settings: WorkspaceProjectSettings): string {
  const dimensions = workspaceProjectDimensions(settings);
  return `${dimensions.width}x${dimensions.height}`;
}
