import {
  DEFAULT_STUDIO_COPY,
  type StudioControlCopy,
} from '../../../_lib/studio-copy';
import type {
  WorkspaceBlockMode,
  WorkspaceEdgeKind,
  WorkspaceInputConnector,
  WorkspaceModelCapability,
  WorkspaceOutputCount,
  WorkspaceOutputMediaKind,
  WorkspacePolicyControlField,
  WorkspaceShotSettings,
  WorkspaceWorkflowType,
} from '../workspace-types';
import { edgeLabel as defaultEdgeLabel } from '../workspace-templates';
import { getWorkspaceV1BlockContractForSettings } from './workspace-v1-block-matrix';
import {
  connectedSatisfiesRequirement,
  getWorkspaceShotInputConnectors,
  inputSupportedBy,
  inputConnectorsFromKinds,
  normalizeConnectedInputKind,
  resolveWorkspaceGenerationIntent,
  workspaceConnectorSupportsBlockMode,
} from './model-input-connectors';
import { resolveWorkspaceEngineOperationalEligibility } from './workspace-engine-availability';
import { isWorkspaceModelCertifiedForSettings } from './workspace-model-certification';

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
  resolvedWorkflowType: WorkspaceWorkflowType;
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

const GENERATE_VIDEO_CONNECTOR_MODES = new Set<WorkspaceBlockMode>([
  'text-to-video',
  'image-to-video',
  'reference-to-video',
  'first-last-video',
]);

function supportsGenerateVideoWorkflow(connector: WorkspaceInputConnector): boolean {
  return !connector.supportedInModes?.length || connector.supportedInModes.some((mode) => (
    GENERATE_VIDEO_CONNECTOR_MODES.has(mode)
  ));
}

function v1BlockContractFor(settings: WorkspaceShotSettings) {
  return getWorkspaceV1BlockContractForSettings(settings);
}

function isSingleEngineTool(settings: WorkspaceShotSettings): string | null {
  if (settings.toolKind === 'character-builder') return 'character-builder-tool';
  if (settings.toolKind === 'storyboard') return 'storyboard-gpt-image-2';
  return null;
}

export function getWorkspaceBlockIntentCapabilities({
  settings,
  capabilities,
}: {
  settings: WorkspaceShotSettings;
  capabilities: WorkspaceModelCapability[];
}): WorkspaceModelCapability[] {
  const certifiedCapabilities = capabilities.filter((capability) => isWorkspaceModelCertifiedForSettings({
    modelId: capability.id,
    settings,
    workflows: capability.workflows,
  }));
  const singleEngineTool = isSingleEngineTool(settings);
  if (singleEngineTool) return certifiedCapabilities.filter((capability) => capability.id === singleEngineTool);

  if (settings.toolKind === 'angle') {
    return certifiedCapabilities.filter((capability) => (
      capability.family === 'image' &&
      capability.outputKind === 'image' &&
      capability.workflows.includes('angle_generation')
    ));
  }

  const v1BlockContract = v1BlockContractFor(settings);
  if (v1BlockContract) {
    return certifiedCapabilities.filter((capability) => (
      capability.family === v1BlockContract.family &&
      capability.outputKind === v1BlockContract.outputKind &&
      v1BlockContract.workflows.some((workflow) => capability.workflows.includes(workflow)) &&
      (!v1BlockContract.compatibleModelIds || v1BlockContract.compatibleModelIds.includes(capability.id))
    ));
  }

  if (isModifyImage(settings)) {
    return certifiedCapabilities.filter((capability) => (
      capability.family === 'image' &&
      capability.outputKind === 'image' &&
      capability.workflows.includes('image_to_image')
    ));
  }

  if (isGenerateImage(settings)) {
    return certifiedCapabilities.filter((capability) => (
      capability.family === 'image' &&
      capability.outputKind === 'image' &&
      capability.workflows.includes('text_to_image')
    ));
  }

  if (isModifyVideo(settings)) {
    return certifiedCapabilities.filter((capability) => (
      capability.family === 'video' &&
      capability.outputKind === 'video' &&
      capability.workflows.includes('video_to_video')
    ));
  }

  if (isGenerateVideo(settings)) {
    return certifiedCapabilities.filter((capability) => (
      capability.family === 'video' &&
      capability.outputKind === 'video' &&
      (capability.workflows.includes('text_to_video') || capability.workflows.includes('image_to_video'))
    ));
  }

  return certifiedCapabilities.filter((capability) => {
    const familyMatches = !settings.family || capability.family === settings.family;
    const outputMatches = !settings.outputKind || capability.outputKind === settings.outputKind;
    return familyMatches && outputMatches && capability.workflows.includes(settings.workflowType);
  });
}

export function getWorkspaceBlockCompatibleCapabilities({
  settings,
  capabilities,
  connectedInputs = [],
}: {
  settings: WorkspaceShotSettings;
  capabilities: WorkspaceModelCapability[];
  connectedInputs?: WorkspaceEdgeKind[];
}): WorkspaceModelCapability[] {
  return getWorkspaceBlockIntentCapabilities({ settings, capabilities }).filter((capability) => {
    const intent = resolveWorkspaceGenerationIntent({ settings, connectedInputs, capability });
    return intent.canRoute && capability.workflows.includes(intent.workflowType);
  });
}

function connectedSet(connectedInputs: WorkspaceEdgeKind[]): Set<WorkspaceEdgeKind> {
  return new Set(connectedInputs.map(normalizeConnectedInputKind));
}

function requiredInputsForMode(
  settings: WorkspaceShotSettings,
  capability: WorkspaceModelCapability | null,
  mode: WorkspaceBlockMode,
  resolvedWorkflowType: WorkspaceWorkflowType
): WorkspaceEdgeKind[] {
  const contract = v1BlockContractFor(settings);
  if (contract) {
    if (contract.workflows.includes(resolvedWorkflowType)) return contract.requiredInputsByWorkflow[resolvedWorkflowType] ?? [];
  }
  if (mode === 'image-edit') return ['prompt', 'reference'];
  if (mode === 'video-edit' || mode === 'video-extend' || mode === 'video-reframe') return ['prompt', 'video_reference'];
  if (mode === 'image-to-video') return ['prompt', 'start_image'];
  if (mode === 'reference-to-video') return ['prompt', 'reference'];
  if (mode === 'first-last-video') return ['prompt', 'start_image', 'end_image'];
  if (mode === 'text-to-image' || mode === 'text-to-video') return ['prompt'];
  return capability?.required_inputs ?? [];
}

function minimumOptionalInputsForMode(
  settings: WorkspaceShotSettings,
  mode: WorkspaceBlockMode,
  requiredInputs: WorkspaceEdgeKind[]
): WorkspaceEdgeKind[] {
  const contract = v1BlockContractFor(settings);
  if (contract) {
    if (contract.presetId === 'generate-video') return [];
    return Array.from(new Set([
      ...contract.optionalInputs,
      ...contract.workflows.flatMap((workflow) => contract.requiredInputsByWorkflow[workflow] ?? []),
    ])).filter((kind) => !requiredInputs.includes(kind));
  }
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
    label: connector?.label ?? defaultEdgeLabel(kind),
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
  policyCopy,
  required,
  settings,
  unsupportedReason,
}: {
  connected: Set<WorkspaceEdgeKind>;
  connector: WorkspaceInputConnector;
  mode: WorkspaceBlockMode;
  policyCopy: StudioControlCopy['policy'];
  required: boolean;
  settings: WorkspaceShotSettings;
  unsupportedReason?: string;
}): WorkspaceInputConnector {
  const disabledReason = disabledReasonForControl(
    connector.kind,
    settings,
    connected,
    policyCopy
  ) ?? unsupportedReason;
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
    minDurationSec: connector.minDurationSec,
    maxDurationSec: connector.maxDurationSec,
    maxFileSizeMb: connector.maxFileSizeMb,
    disabledReason,
  };
}

function unsupportedInputReason(
  capability: WorkspaceModelCapability | null,
  kind: WorkspaceEdgeKind,
  policyCopy: StudioControlCopy['policy'],
  edgeLabel: (kind: WorkspaceEdgeKind) => string
): string | undefined {
  if (!capability) return undefined;
  const supportedInputs = new Set([...(capability.required_inputs ?? []), ...(capability.optional_inputs ?? [])]);
  return inputSupportedBy(kind, supportedInputs)
    ? undefined
    : formatPolicyCopy(policyCopy.unsupportedInput, { input: edgeLabel(kind) });
}

function mergeConnectors(
  capability: WorkspaceModelCapability | null,
  requiredInputs: WorkspaceEdgeKind[],
  optionalInputs: WorkspaceEdgeKind[],
  mode: WorkspaceBlockMode,
  connected: Set<WorkspaceEdgeKind>,
  settings: WorkspaceShotSettings,
  policyCopy: StudioControlCopy['policy'],
  edgeLabel: (kind: WorkspaceEdgeKind) => string
): WorkspaceInputConnector[] {
  const byKind = new Map<WorkspaceEdgeKind, WorkspaceInputConnector>();
  const contract = v1BlockContractFor(settings);
  if (contract?.presetId === 'generate-video') {
    for (const connector of getWorkspaceShotInputConnectors(capability).filter(supportsGenerateVideoWorkflow)) {
      const existing = byKind.get(connector.kind);
      if (
        existing &&
        (workspaceConnectorSupportsBlockMode(existing, mode) || !workspaceConnectorSupportsBlockMode(connector, mode))
      ) {
        continue;
      }
      byKind.set(connector.kind, normalizedConnector({
        connected,
        connector,
        mode,
        policyCopy,
        required: requiredInputs.includes(connector.kind),
        settings,
      }));
    }
    for (const kind of requiredInputs) {
      const connector = byKind.get(kind) ?? (kind === 'prompt' ? connectorForKind(kind, true, mode) : null);
      if (!connector) continue;
      byKind.set(kind, normalizedConnector({
        connected,
        connector,
        mode,
        policyCopy,
        required: true,
        settings,
      }));
    }
    for (const kind of connected) {
      if (byKind.has(kind)) continue;
      byKind.set(kind, {
        ...normalizedConnector({
          connected,
          connector: connectorForKind(kind, false, mode),
          mode,
          policyCopy,
          required: false,
          settings,
          unsupportedReason: formatPolicyCopy(policyCopy.unsupportedInput, { input: edgeLabel(kind) }),
        }),
        connectedCount: 1,
      });
    }
    return Array.from(byKind.values());
  }
  if (contract) {
    const contractInputs = Array.from(new Set([...requiredInputs, ...optionalInputs]));
    const capabilityConnectors = getWorkspaceShotInputConnectors(capability);
    for (const kind of contractInputs) {
      const connectorCandidates = capabilityConnectors.filter((connector) => connector.kind === kind);
      const current = connectorCandidates.find((connector) => workspaceConnectorSupportsBlockMode(connector, mode))
        ?? connectorCandidates.find((connector) => !connector.supportedInModes?.length)
        ?? connectorCandidates[0];
      byKind.set(kind, normalizedConnector({
        connected,
        connector: current ?? connectorForKind(kind, requiredInputs.includes(kind), mode),
        mode,
        policyCopy,
        required: requiredInputs.includes(kind),
        settings,
        unsupportedReason: unsupportedInputReason(capability, kind, policyCopy, edgeLabel),
      }));
    }
    return Array.from(byKind.values());
  }

  for (const connector of getWorkspaceShotInputConnectors(capability)) {
    byKind.set(connector.kind, normalizedConnector({
      connected,
      connector,
      mode,
      policyCopy,
      required: requiredInputs.includes(connector.kind),
      settings,
    }));
  }
  for (const kind of requiredInputs) {
    const current = byKind.get(kind);
    byKind.set(kind, current
      ? normalizedConnector({ connected, connector: current, mode, policyCopy, required: true, settings })
      : normalizedConnector({ connected, connector: connectorForKind(kind, true, mode), mode, policyCopy, required: true, settings }));
  }
  for (const kind of optionalInputs) {
    if (requiredInputs.includes(kind)) continue;
    const current = byKind.get(kind);
    byKind.set(kind, current
      ? normalizedConnector({ connected, connector: current, mode, policyCopy, required: false, settings })
      : normalizedConnector({ connected, connector: connectorForKind(kind, false, mode), mode, policyCopy, required: false, settings }));
  }
  return Array.from(byKind.values());
}

function disabledReasonForControl(
  id: WorkspaceEdgeKind,
  settings: WorkspaceShotSettings,
  connected: Set<WorkspaceEdgeKind>,
  policyCopy: StudioControlCopy['policy']
): string | undefined {
  if (!isGenerateVideo(settings)) return undefined;
  if (id === 'reference' && connected.has('start_image')) {
    return policyCopy.startImageDisablesReference;
  }
  if (id === 'start_image' && connected.has('reference')) {
    return policyCopy.referenceDisablesStartImage;
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
  outputMediaKind: WorkspaceOutputMediaKind,
  mode: WorkspaceBlockMode,
): WorkspacePolicyControlField[] {
  const enabledForMode = (field: WorkspacePolicyControlField) => {
    const supportedModes = capability?.control_modes?.[field];
    return !supportedModes?.length || supportedModes.includes(mode);
  };
  const contract = v1BlockContractFor(settings);
  if (contract) {
    const fields = capability?.control_fields?.length
      ? contract.visibleControls.filter((field) => capability.control_fields?.includes(field))
      : contract.visibleControls;
    return fields.filter(enabledForMode);
  }
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
  return Array.from(fields).filter(enabledForMode);
}

function pricingRelevantFieldsForPolicy(
  settings: WorkspaceShotSettings,
  capability: WorkspaceModelCapability | null,
  outputMediaKind: WorkspaceOutputMediaKind
): WorkspacePolicyControlField[] {
  const contract = v1BlockContractFor(settings);
  if (contract) {
    return capability?.pricing_relevant_fields?.length
      ? contract.pricingRelevantFields.filter((field) => capability.pricing_relevant_fields?.includes(field))
      : contract.pricingRelevantFields;
  }
  if (settings.family === 'chat') return [];
  if (capability?.pricing_relevant_fields) return capability.pricing_relevant_fields;
  const fields = new Set<WorkspacePolicyControlField>(['model']);
  if (outputMediaKind === 'video' || outputMediaKind === 'audio') fields.add('durationSec');
  if (outputMediaKind === 'video' || outputMediaKind === 'image') fields.add('resolution');
  return Array.from(fields);
}

function formatPolicyCopy(
  value: string,
  replacements: Record<string, string | number>
): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function disabledReasonForMissingInputs(
  missingInputs: WorkspaceEdgeKind[],
  policyCopy: StudioControlCopy['policy'],
  edgeLabel: (kind: WorkspaceEdgeKind) => string
): string | undefined {
  if (!missingInputs.length) return undefined;
  return formatPolicyCopy(
    missingInputs.length === 1
      ? policyCopy.connectRequiredSingle
      : policyCopy.connectRequiredPlural,
    { inputs: missingInputs.map(edgeLabel).join(', ') }
  );
}

export function resolveWorkspaceBlockPolicy({
  settings,
  capability,
  connectedInputs,
  policyCopy = DEFAULT_STUDIO_COPY.canvas.controls.policy,
  edgeLabel = defaultEdgeLabel,
}: {
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  connectedInputs: WorkspaceEdgeKind[];
  policyCopy?: StudioControlCopy['policy'];
  edgeLabel?: (kind: WorkspaceEdgeKind) => string;
}): WorkspaceBlockPolicyResult {
  const connected = connectedSet(connectedInputs);
  const intent = resolveWorkspaceGenerationIntent({ settings, connectedInputs, capability });
  const mode = intent.blockMode;
  const requiredInputs = requiredInputsForMode(settings, capability, mode, intent.workflowType);
  const optionalInputs = Array.from(new Set([
    ...(capability?.optional_inputs ?? []),
    ...minimumOptionalInputsForMode(settings, mode, requiredInputs),
  ])).filter((kind) => !requiredInputs.includes(kind));
  const inputConnectors = mergeConnectors(
    capability,
    requiredInputs,
    optionalInputs,
    mode,
    connected,
    settings,
    policyCopy,
    edgeLabel
  );
  const activeConnected = new Set(
    inputConnectors
      .filter((connector) => !connector.disabledReason && connected.has(connector.kind))
      .map((connector) => connector.kind)
  );
  const missingInputs = requiredInputs.filter((kind) => !connectedSatisfiesRequirement(activeConnected, kind));
  const outputMediaKind = outputMediaKindForPolicy(settings, capability);
  const selectedModelCompatible = !capability || getWorkspaceBlockCompatibleCapabilities({
    settings,
    capabilities: [capability],
    connectedInputs,
  }).length > 0;
  const operationalEligibility = resolveWorkspaceEngineOperationalEligibility(capability);
  const selectedModelEligible = selectedModelCompatible && operationalEligibility.isOperational;
  const disabledReason = selectedModelEligible
    ? disabledReasonForMissingInputs(missingInputs, policyCopy, edgeLabel)
    : policyCopy.incompatibleModel;
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
    resolvedWorkflowType: intent.workflowType,
    controlFields: controlFieldsForPolicy(settings, capability, outputMediaKind, mode),
    pricingRelevantFields: pricingRelevantFieldsForPolicy(settings, capability, outputMediaKind),
    disabledReason,
    canGenerate: selectedModelEligible && missingInputs.length === 0,
  };
}
