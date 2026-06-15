import type {
  WorkspaceModelCapability,
  WorkspaceShotSettings,
} from './workspace-types';
import { getWorkspaceBlockCompatibleCapabilities } from './models/workspace-block-capability-policy';

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

export function compatibleCapabilitiesForShot(
  settings: WorkspaceShotSettings,
  capabilities: WorkspaceModelCapability[]
): WorkspaceModelCapability[] {
  return getWorkspaceBlockCompatibleCapabilities({
    settings,
    capabilities,
  });
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
