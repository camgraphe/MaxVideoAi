import type {
  WorkspaceModelCapability,
  WorkspaceShotSettings,
} from './workspace-types';

export type WorkspaceShotInspectorSection =
  | 'angle-controls'
  | 'audio-pack'
  | 'character-builder'
  | 'generic-generation'
  | 'model-select'
  | 'storyboard'
  | 'upscale';

const SINGLE_ENGINE_TOOL_IDS: Partial<Record<NonNullable<WorkspaceShotSettings['toolKind']>, string>> = {
  'character-builder': 'character-builder-tool',
  storyboard: 'storyboard-gpt-image-2',
};

export function isToolOnlyPreset(settings: WorkspaceShotSettings): boolean {
  return Boolean(settings.toolKind && SINGLE_ENGINE_TOOL_IDS[settings.toolKind]);
}

function genericCompatibleCapabilitiesForShot(
  settings: WorkspaceShotSettings,
  capabilities: WorkspaceModelCapability[]
): WorkspaceModelCapability[] {
  return capabilities.filter((capability) => {
    const familyMatches = !settings.family || capability.family === settings.family;
    const outputMatches = !settings.outputKind || capability.outputKind === settings.outputKind;
    const workflowMatches = capability.workflows.includes(settings.workflowType);
    return familyMatches && outputMatches && workflowMatches;
  });
}

export function compatibleCapabilitiesForShot(
  settings: WorkspaceShotSettings,
  capabilities: WorkspaceModelCapability[]
): WorkspaceModelCapability[] {
  const singleEngineId = settings.toolKind ? SINGLE_ENGINE_TOOL_IDS[settings.toolKind] : null;
  if (singleEngineId) {
    return capabilities.filter((capability) => capability.id === singleEngineId);
  }
  if (settings.toolKind === 'angle') {
    return capabilities.filter((capability) => (
      capability.family === 'image' &&
      capability.outputKind === 'image' &&
      capability.workflows.includes('angle_generation')
    ));
  }
  if (settings.family === 'upscale') {
    return capabilities.filter((capability) => (
      capability.family === 'upscale' &&
      capability.outputKind === settings.outputKind &&
      capability.workflows.includes(settings.workflowType)
    ));
  }
  if (settings.workflowType === 'video_to_video') {
    return capabilities.filter((capability) => (
      capability.family === 'video' &&
      capability.outputKind === 'video' &&
      capability.workflows.includes('video_to_video')
    ));
  }
  return genericCompatibleCapabilitiesForShot(settings, capabilities);
}

export function toolPanelSectionsForShot(settings: WorkspaceShotSettings): WorkspaceShotInspectorSection[] {
  const sections: WorkspaceShotInspectorSection[] = [];
  if (!isToolOnlyPreset(settings)) {
    sections.push('model-select');
  }
  if (settings.toolKind === 'character-builder') {
    sections.push('character-builder');
  } else if (settings.toolKind === 'storyboard') {
    sections.push('storyboard');
  } else if (settings.toolKind === 'angle') {
    sections.push('angle-controls');
  } else if (settings.family === 'upscale') {
    sections.push('upscale');
  } else if (settings.family === 'audio') {
    sections.push('audio-pack');
  } else {
    sections.push('generic-generation');
  }
  return sections;
}
