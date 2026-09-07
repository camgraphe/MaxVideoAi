import type { WorkspaceModelCapability, WorkspaceShotSettings } from '../workspace-types';

export function workspaceShotPatchForModelSelection(
  shot: WorkspaceShotSettings,
  capability: WorkspaceModelCapability
): Partial<WorkspaceShotSettings> {
  const audio = capability.render_options.find((option) => option.id === 'audio') ?? null;
  const lipSync = capability.render_options.find((option) => option.id === 'lip_sync') ?? null;
  return {
    modelId: capability.id,
    family: capability.family,
    outputKind: capability.outputKind === 'text' ? shot.outputKind : capability.outputKind,
    audioEnabled: audio?.control === 'toggle' ? audio.defaultEnabled : false,
    lipSyncEnabled: lipSync?.control === 'toggle' ? lipSync.defaultEnabled : false,
  };
}
