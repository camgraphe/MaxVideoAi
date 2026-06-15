import type {
  WorkspaceEdgeKind,
  WorkspaceInputConnector,
  WorkspaceModelCapability,
  WorkspaceShotSettings,
} from '../workspace-types';
import { edgeLabel } from '../workspace-templates';
import {
  connectedSatisfiesRequirement,
  getWorkspaceShotInputConnectors,
  normalizeConnectedInputKind,
} from './model-input-connectors';

export type WorkspaceBlockMode =
  | 'chat'
  | 'first-last-video'
  | 'image-edit'
  | 'image-to-video'
  | 'reference-to-video'
  | 'text-to-image'
  | 'text-to-video'
  | 'tool'
  | 'video-edit'
  | 'video-reframe';

export type WorkspaceResolvedControl = {
  id: string;
  label: string;
  kind: 'connection' | 'number' | 'range' | 'select' | 'text' | 'textarea' | 'toggle';
  value: unknown;
  options?: Array<{ value: string; label: string; disabled?: boolean; reason?: string }>;
  disabled: boolean;
  required: boolean;
  reason?: string;
  compact: boolean;
};

export type WorkspaceBlockPolicyResult = {
  mode: WorkspaceBlockMode;
  controls: WorkspaceResolvedControl[];
  inputConnectors: WorkspaceInputConnector[];
  requiredInputs: WorkspaceEdgeKind[];
  missingInputs: WorkspaceEdgeKind[];
  canGenerate: boolean;
};

function presetId(settings: WorkspaceShotSettings): string {
  return settings.presetId ?? settings.workflowType;
}

function isModifyImage(settings: WorkspaceShotSettings): boolean {
  return presetId(settings) === 'modify-image' || settings.workflowType === 'image_to_image';
}

function isGenerateImage(settings: WorkspaceShotSettings): boolean {
  return presetId(settings) === 'generate-image' || settings.workflowType === 'text_to_image';
}

function isModifyVideo(settings: WorkspaceShotSettings): boolean {
  return presetId(settings) === 'modify-video' || settings.workflowType === 'video_to_video';
}

function isGenerateVideo(settings: WorkspaceShotSettings): boolean {
  return presetId(settings) === 'generate-video' ||
    settings.workflowType === 'text_to_video' ||
    settings.workflowType === 'image_to_video';
}

function isSingleEngineTool(settings: WorkspaceShotSettings): string | null {
  if (settings.toolKind === 'character-builder') return 'character-builder-tool';
  if (settings.toolKind === 'storyboard') return 'storyboard-gpt-image-2';
  return null;
}

export function getWorkspaceBlockCompatibleCapabilities({
  settings,
  capabilities,
}: {
  settings: WorkspaceShotSettings;
  capabilities: WorkspaceModelCapability[];
}): WorkspaceModelCapability[] {
  const singleEngineTool = isSingleEngineTool(settings);
  if (singleEngineTool) return capabilities.filter((capability) => capability.id === singleEngineTool);

  if (settings.toolKind === 'angle') {
    return capabilities.filter((capability) => (
      capability.family === 'image' &&
      capability.outputKind === 'image' &&
      capability.workflows.includes('angle_generation')
    ));
  }

  if (isModifyImage(settings)) {
    return capabilities.filter((capability) => (
      capability.family === 'image' &&
      capability.outputKind === 'image' &&
      capability.workflows.includes('image_to_image')
    ));
  }

  if (isGenerateImage(settings)) {
    return capabilities.filter((capability) => (
      capability.family === 'image' &&
      capability.outputKind === 'image' &&
      capability.workflows.includes('text_to_image')
    ));
  }

  if (isModifyVideo(settings)) {
    return capabilities.filter((capability) => (
      capability.family === 'video' &&
      capability.outputKind === 'video' &&
      capability.workflows.includes('video_to_video')
    ));
  }

  if (isGenerateVideo(settings)) {
    return capabilities.filter((capability) => (
      capability.family === 'video' &&
      capability.outputKind === 'video' &&
      (capability.workflows.includes('text_to_video') || capability.workflows.includes('image_to_video'))
    ));
  }

  return capabilities.filter((capability) => {
    const familyMatches = !settings.family || capability.family === settings.family;
    const outputMatches = !settings.outputKind || capability.outputKind === settings.outputKind;
    return familyMatches && outputMatches && capability.workflows.includes(settings.workflowType);
  });
}

function connectedSet(connectedInputs: WorkspaceEdgeKind[]): Set<WorkspaceEdgeKind> {
  return new Set(connectedInputs.map(normalizeConnectedInputKind));
}

function inferBlockMode(
  settings: WorkspaceShotSettings,
  connected: Set<WorkspaceEdgeKind>
): WorkspaceBlockMode {
  if (settings.family === 'chat') return 'chat';
  if (settings.toolKind) return isModifyVideo(settings) ? 'video-edit' : 'tool';
  if (isModifyImage(settings)) return 'image-edit';
  if (isModifyVideo(settings)) return 'video-edit';
  if (isGenerateImage(settings)) return 'text-to-image';
  if (isGenerateVideo(settings)) {
    if (connected.has('end_image')) return 'first-last-video';
    if (connected.has('reference')) return 'reference-to-video';
    if (connected.has('start_image')) return 'image-to-video';
    return 'text-to-video';
  }
  return 'tool';
}

function requiredInputsForMode(
  settings: WorkspaceShotSettings,
  capability: WorkspaceModelCapability | null,
  mode: WorkspaceBlockMode
): WorkspaceEdgeKind[] {
  if (mode === 'image-edit') return ['prompt', 'reference'];
  if (mode === 'video-edit' || mode === 'video-reframe') return ['prompt', 'video_reference'];
  if (mode === 'image-to-video') return ['prompt', 'start_image'];
  if (mode === 'reference-to-video') return ['prompt', 'reference'];
  if (mode === 'first-last-video') return ['prompt', 'start_image', 'end_image'];
  if (mode === 'text-to-image' || mode === 'text-to-video') return ['prompt'];
  return capability?.required_inputs ?? [];
}

function connectorForKind(kind: WorkspaceEdgeKind, required: boolean): WorkspaceInputConnector {
  const sourceType: WorkspaceInputConnector['sourceType'] =
    kind === 'prompt' ||
    kind === 'negative_prompt' ||
    kind === 'camera' ||
    kind === 'dialogue' ||
    kind === 'narration'
      ? 'text'
      : kind === 'video_reference' || kind === 'motion_reference' || kind === 'previous_shot' || kind === 'continuity'
        ? 'video'
        : kind === 'audio' || kind === 'voiceover' || kind === 'music' || kind === 'sfx'
          ? 'audio'
          : 'image';
  return {
    kind,
    label: edgeLabel(kind),
    required,
    sourceType,
  };
}

function mergeConnectors(
  capability: WorkspaceModelCapability | null,
  requiredInputs: WorkspaceEdgeKind[]
): WorkspaceInputConnector[] {
  const byKind = new Map<WorkspaceEdgeKind, WorkspaceInputConnector>();
  for (const connector of getWorkspaceShotInputConnectors(capability)) {
    byKind.set(connector.kind, {
      ...connector,
      required: requiredInputs.includes(connector.kind) || connector.required,
    });
  }
  for (const kind of requiredInputs) {
    const current = byKind.get(kind);
    byKind.set(kind, current ? { ...current, required: true } : connectorForKind(kind, true));
  }
  return Array.from(byKind.values());
}

function disabledReasonForControl(
  id: WorkspaceEdgeKind,
  settings: WorkspaceShotSettings,
  connected: Set<WorkspaceEdgeKind>
): string | undefined {
  if (!isGenerateVideo(settings)) return undefined;
  if (id === 'reference' && connected.has('start_image')) {
    return 'Start image mode disables reference images.';
  }
  if (id === 'start_image' && connected.has('reference')) {
    return 'Reference mode disables start image.';
  }
  return undefined;
}

export function resolveWorkspaceBlockPolicy({
  settings,
  capability,
  connectedInputs,
}: {
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  connectedInputs: WorkspaceEdgeKind[];
}): WorkspaceBlockPolicyResult {
  const connected = connectedSet(connectedInputs);
  const mode = inferBlockMode(settings, connected);
  const requiredInputs = requiredInputsForMode(settings, capability, mode);
  const inputConnectors = mergeConnectors(capability, requiredInputs);
  const missingInputs = requiredInputs.filter((kind) => !connectedSatisfiesRequirement(connected, kind));
  const controls = inputConnectors.map<WorkspaceResolvedControl>((connector) => {
    const reason = disabledReasonForControl(connector.kind, settings, connected);
    return {
      id: connector.kind,
      label: connector.label,
      kind: 'connection',
      value: connector.connectedCount ?? 0,
      disabled: Boolean(reason),
      required: requiredInputs.includes(connector.kind),
      reason,
      compact: true,
    };
  });

  return {
    mode,
    controls,
    inputConnectors,
    requiredInputs,
    missingInputs,
    canGenerate: missingInputs.length === 0,
  };
}
