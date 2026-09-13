import type { WorkspaceModelCapability, WorkspaceShotSettings } from '../workspace-types';

export type WorkspaceShotCapabilityAdjustment = {
  field: 'durationSec' | 'aspectRatio' | 'resolution' | 'fps' | 'outputCount';
  from: string | number;
  to: string | number;
};

function supportedOrFallback<T extends string | number>(
  current: T,
  supported: T[],
  preferred: unknown,
): T {
  if (!supported.length || supported.includes(current)) return current;
  return supported.includes(preferred as T) ? preferred as T : supported[0]!;
}

export function normalizeWorkspaceShotForCapability(
  shot: WorkspaceShotSettings,
  capability: WorkspaceModelCapability,
): { shot: WorkspaceShotSettings; adjustments: WorkspaceShotCapabilityAdjustment[] } {
  const controlFields = new Set(capability.control_fields ?? []);
  const next: WorkspaceShotSettings = { ...shot };
  const adjustments: WorkspaceShotCapabilityAdjustment[] = [];
  const assign = <K extends WorkspaceShotCapabilityAdjustment['field']>(field: K, value: WorkspaceShotSettings[K]) => {
    if (next[field] === value) return;
    adjustments.push({ field, from: next[field] as string | number, to: value as string | number });
    next[field] = value;
  };

  if (controlFields.has('durationSec')) {
    assign('durationSec', supportedOrFallback(
      next.durationSec,
      capability.supported_durations,
      capability.control_defaults?.durationSec,
    ));
  }
  if (controlFields.has('aspectRatio')) {
    assign('aspectRatio', supportedOrFallback(
      next.aspectRatio,
      capability.supported_aspect_ratios,
      capability.control_defaults?.aspectRatio,
    ));
  }
  if (controlFields.has('resolution')) {
    assign('resolution', supportedOrFallback(
      next.resolution,
      capability.supported_resolutions,
      capability.control_defaults?.resolution,
    ));
  }
  if (controlFields.has('fps')) {
    assign('fps', supportedOrFallback(
      next.fps,
      capability.supported_fps,
      capability.control_defaults?.fps,
    ));
  }
  if (controlFields.has('outputCount') && capability.output_count !== undefined) {
    const current = next.outputCount ?? 1;
    const normalized = typeof capability.output_count === 'number'
      ? capability.output_count
      : Math.max(capability.output_count.min, Math.min(capability.output_count.max, current));
    assign('outputCount', normalized);
  }

  return { shot: next, adjustments };
}

export function workspaceShotPatchForModelSelection(
  shot: WorkspaceShotSettings,
  capability: WorkspaceModelCapability
): Partial<WorkspaceShotSettings> {
  const audio = capability.render_options.find((option) => option.id === 'audio') ?? null;
  const lipSync = capability.render_options.find((option) => option.id === 'lip_sync') ?? null;
  const basePatch = {
    modelId: capability.id,
    family: capability.family,
    outputKind: capability.outputKind === 'text' ? shot.outputKind : capability.outputKind,
    audioEnabled: audio?.control === 'toggle' ? audio.defaultEnabled : false,
    lipSyncEnabled: lipSync?.control === 'toggle' ? lipSync.defaultEnabled : false,
  };
  const normalized = normalizeWorkspaceShotForCapability({ ...shot, ...basePatch }, capability).shot;
  return {
    ...basePatch,
    durationSec: normalized.durationSec,
    aspectRatio: normalized.aspectRatio,
    resolution: normalized.resolution,
    fps: normalized.fps,
    outputCount: normalized.outputCount,
  };
}
