import type {
  WorkspaceBlockMode,
  WorkspaceEdgeKind,
  WorkspaceInputConnector,
  WorkspaceModelCapability,
  WorkspaceOutputCount,
  WorkspaceOutputMediaKind,
  WorkspacePolicyControlField,
  WorkspaceShotSettings,
} from '../workspace-types';
import { edgeLabel } from '../workspace-templates';
import {
  connectedSatisfiesRequirement,
  getWorkspaceShotInputConnectors,
  inputConnectorsFromKinds,
  normalizeConnectedInputKind,
} from './model-input-connectors';

export type { WorkspaceBlockMode } from '../workspace-types';

export type WorkspaceResolvedControl = {
  id: string;
  label: string;
  kind: 'connection' | 'number' | 'range' | 'select' | 'text' | 'textarea' | 'toggle';
  value: unknown;
  options?: Array<{ value: string; label: string; disabled?: boolean; reason?: string }>;
  disabled: boolean;
  required: boolean;
  reason?: string;
  disabledReason?: string;
  compact: boolean;
};

export type WorkspaceBlockPolicyResult = {
  mode: WorkspaceBlockMode;
  controls: WorkspaceResolvedControl[];
  inputConnectors: WorkspaceInputConnector[];
  requiredInputs: WorkspaceEdgeKind[];
  optionalInputs: WorkspaceEdgeKind[];
  missingInputs: WorkspaceEdgeKind[];
  outputMediaKind: WorkspaceOutputMediaKind;
  outputCount: WorkspaceOutputCount;
  controlFields: WorkspacePolicyControlField[];
  pricingRelevantFields: WorkspacePolicyControlField[];
  disabledReason?: string;
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

function minimumOptionalInputsForMode(settings: WorkspaceShotSettings, mode: WorkspaceBlockMode): WorkspaceEdgeKind[] {
  const id = presetId(settings);
  if (id === 'generate-video') return ['start_image', 'reference', 'style', 'camera'];
  if (id === 'modify-video') return ['motion_reference', 'previous_shot', 'continuity', 'style'];
  if (id === 'generate-image') return ['reference', 'style'];
  if (id === 'modify-image') return ['style'];
  if (mode === 'image-to-video') return ['reference', 'style', 'camera'];
  if (mode === 'reference-to-video') return ['start_image', 'style', 'camera'];
  return [];
}

function connectorForKind(kind: WorkspaceEdgeKind, required: boolean, mode: WorkspaceBlockMode): WorkspaceInputConnector {
  const connector = inputConnectorsFromKinds(required ? [kind] : [], required ? [] : [kind])[0];
  return {
    kind,
    label: connector?.label ?? edgeLabel(kind),
    required,
    requiredInModes: required ? [mode] : connector?.requiredInModes,
    minCount: connector?.minCount ?? (required ? 1 : 0),
    maxCount: connector?.maxCount ?? 1,
    acceptedMediaKinds: connector?.acceptedMediaKinds,
    acceptedFormats: connector?.acceptedFormats,
    sourceType: connector?.sourceType ?? 'control',
  };
}

function connectorMutualExclusions(
  settings: WorkspaceShotSettings,
  kind: WorkspaceEdgeKind
): WorkspaceEdgeKind[] | undefined {
  if (!isGenerateVideo(settings)) return undefined;
  if (kind === 'reference') return ['start_image'];
  if (kind === 'start_image') return ['reference'];
  return undefined;
}

function normalizedConnector({
  connected,
  connector,
  mode,
  required,
  settings,
}: {
  connected: Set<WorkspaceEdgeKind>;
  connector: WorkspaceInputConnector;
  mode: WorkspaceBlockMode;
  required: boolean;
  settings: WorkspaceShotSettings;
}): WorkspaceInputConnector {
  const disabledReason = disabledReasonForControl(connector.kind, settings, connected);
  const requiredInModes = new Set(connector.requiredInModes ?? []);
  if (required) requiredInModes.add(mode);
  return {
    ...connector,
    required,
    requiredInModes: requiredInModes.size ? Array.from(requiredInModes) : connector.requiredInModes,
    minCount: connector.minCount ?? (required ? 1 : 0),
    maxCount: connector.maxCount ?? 1,
    mutuallyExclusiveWith: connector.mutuallyExclusiveWith ?? connectorMutualExclusions(settings, connector.kind),
    acceptedMediaKinds: connector.acceptedMediaKinds,
    acceptedFormats: connector.acceptedFormats,
    maxDurationSec: connector.maxDurationSec,
    maxFileSizeMb: connector.maxFileSizeMb,
    disabledReason,
  };
}

function mergeConnectors(
  capability: WorkspaceModelCapability | null,
  requiredInputs: WorkspaceEdgeKind[],
  optionalInputs: WorkspaceEdgeKind[],
  mode: WorkspaceBlockMode,
  connected: Set<WorkspaceEdgeKind>,
  settings: WorkspaceShotSettings
): WorkspaceInputConnector[] {
  const byKind = new Map<WorkspaceEdgeKind, WorkspaceInputConnector>();
  for (const connector of getWorkspaceShotInputConnectors(capability)) {
    byKind.set(connector.kind, normalizedConnector({
      connected,
      connector,
      mode,
      required: requiredInputs.includes(connector.kind),
      settings,
    }));
  }
  for (const kind of requiredInputs) {
    const current = byKind.get(kind);
    byKind.set(kind, current
      ? normalizedConnector({ connected, connector: current, mode, required: true, settings })
      : normalizedConnector({ connected, connector: connectorForKind(kind, true, mode), mode, required: true, settings }));
  }
  for (const kind of optionalInputs) {
    if (requiredInputs.includes(kind)) continue;
    const current = byKind.get(kind);
    byKind.set(kind, current
      ? normalizedConnector({ connected, connector: current, mode, required: false, settings })
      : normalizedConnector({ connected, connector: connectorForKind(kind, false, mode), mode, required: false, settings }));
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

function outputMediaKindForPolicy(
  settings: WorkspaceShotSettings,
  capability: WorkspaceModelCapability | null
): WorkspaceOutputMediaKind {
  return settings.outputKind ?? capability?.outputKind ?? (settings.family === 'chat' ? 'text' : 'video');
}

function outputCountForPolicy(
  settings: WorkspaceShotSettings,
  capability: WorkspaceModelCapability | null
): WorkspaceOutputCount {
  if (settings.toolKind === 'character-builder' || settings.toolKind === 'angle') return { min: 1, max: 4 };
  return capability?.output_count ?? 1;
}

function controlFieldsForPolicy(
  settings: WorkspaceShotSettings,
  capability: WorkspaceModelCapability | null,
  outputMediaKind: WorkspaceOutputMediaKind
): WorkspacePolicyControlField[] {
  if (settings.family === 'chat') return capability?.control_fields?.length
    ? capability.control_fields
    : ['chatProvider', 'chatModel', 'chatSystemPrompt', 'chatMessage'];
  if (settings.toolKind === 'character-builder') return capability?.control_fields?.length
    ? capability.control_fields
    : ['model', 'outputCount', 'characterOutputMode', 'characterQualityMode', 'characterFormatMode'];
  if (settings.toolKind === 'angle') return capability?.control_fields?.length
    ? capability.control_fields
    : ['model', 'outputCount', 'angleRotation', 'angleTilt', 'angleZoom', 'angleSafeMode'];
  if (settings.family === 'audio') return capability?.control_fields?.length
    ? capability.control_fields
    : ['model', 'durationSec', 'audioMood', 'audioIntensity'];
  if (settings.family === 'upscale') return capability?.control_fields?.length
    ? capability.control_fields
    : ['model', 'resolution', 'upscaleFactor', 'outputFormat'];

  const fields = new Set<WorkspacePolicyControlField>(capability?.control_fields ?? ['model']);
  if (outputMediaKind === 'video') {
    fields.add('durationSec');
    fields.add('aspectRatio');
    fields.add('resolution');
    fields.add('fps');
    fields.add('referenceStrength');
  }
  if (outputMediaKind === 'image') {
    fields.add('aspectRatio');
    fields.add('resolution');
    fields.add('referenceStrength');
  }
  return Array.from(fields);
}

function pricingRelevantFieldsForPolicy(
  settings: WorkspaceShotSettings,
  capability: WorkspaceModelCapability | null,
  outputMediaKind: WorkspaceOutputMediaKind
): WorkspacePolicyControlField[] {
  if (settings.family === 'chat') return [];
  if (capability?.pricing_relevant_fields) return capability.pricing_relevant_fields;
  const fields = new Set<WorkspacePolicyControlField>(['model']);
  if (outputMediaKind === 'video' || outputMediaKind === 'audio') fields.add('durationSec');
  if (outputMediaKind === 'video' || outputMediaKind === 'image') fields.add('resolution');
  return Array.from(fields);
}

function disabledReasonForMissingInputs(missingInputs: WorkspaceEdgeKind[]): string | undefined {
  if (!missingInputs.length) return undefined;
  return `Connect required ${missingInputs.map(edgeLabel).join(', ')} input${missingInputs.length === 1 ? '' : 's'}.`;
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
  const optionalInputs = Array.from(new Set([
    ...(capability?.optional_inputs ?? []),
    ...minimumOptionalInputsForMode(settings, mode),
  ])).filter((kind) => !requiredInputs.includes(kind));
  const inputConnectors = mergeConnectors(capability, requiredInputs, optionalInputs, mode, connected, settings);
  const missingInputs = requiredInputs.filter((kind) => !connectedSatisfiesRequirement(connected, kind));
  const outputMediaKind = outputMediaKindForPolicy(settings, capability);
  const disabledReason = disabledReasonForMissingInputs(missingInputs);
  const controls = inputConnectors.map<WorkspaceResolvedControl>((connector) => {
    const reason = connector.disabledReason;
    return {
      id: connector.kind,
      label: connector.label,
      kind: 'connection',
      value: connector.connectedCount ?? 0,
      disabled: Boolean(reason),
      required: requiredInputs.includes(connector.kind),
      reason,
      disabledReason: reason,
      compact: true,
    };
  });

  return {
    mode,
    controls,
    inputConnectors,
    requiredInputs,
    optionalInputs,
    missingInputs,
    outputMediaKind,
    outputCount: outputCountForPolicy(settings, capability),
    controlFields: controlFieldsForPolicy(settings, capability, outputMediaKind),
    pricingRelevantFields: pricingRelevantFieldsForPolicy(settings, capability, outputMediaKind),
    disabledReason,
    canGenerate: missingInputs.length === 0,
  };
}
