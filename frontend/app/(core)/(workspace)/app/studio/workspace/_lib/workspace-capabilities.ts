import type { WorkspaceEdgeKind, WorkspaceModelCapability, WorkspaceShotSettings, WorkspaceShotValidation, WorkspaceWorkflowType } from './workspace-types';
import { getWorkspaceModelCapabilities, getWorkspaceModelCapability } from './models/model-capability-registry';
import {
  inputSupportedBy,
  normalizeConnectedInputKind,
  resolveWorkspaceWorkflowType,
} from './models/model-input-connectors';
import { resolveWorkspaceBlockPolicy } from './models/workspace-block-capability-policy';

export { getWorkspaceModelCapabilities, getWorkspaceModelCapability } from './models/model-capability-registry';
export {
  getWorkspaceShotInputConnectors,
  getWorkspaceShotTargetHandles,
  isWorkspaceConnectionCompatible,
  normalizeConnectedInputKind,
  resolveWorkspaceGenerationMode,
  resolveWorkspaceWorkflowType,
  workspaceConnectionCapacity,
} from './models/model-input-connectors';
export { resolveWorkspaceRenderOptions, workspaceAudioEnabledForRequest } from './models/model-pricing-adapter';

function workflowFromPolicy(
  policyMode: ReturnType<typeof resolveWorkspaceBlockPolicy>['mode'],
  params: {
    capability: WorkspaceModelCapability;
    connectedInputs: WorkspaceEdgeKind[];
    fallbackWorkflowType: WorkspaceWorkflowType;
  }
): WorkspaceWorkflowType {
  if (policyMode === 'image-edit') return 'image_to_image';
  if (policyMode === 'text-to-image') return 'text_to_image';
  if (policyMode === 'video-edit' || policyMode === 'video-reframe') return 'video_to_video';
  return resolveWorkspaceWorkflowType(params);
}

export function validateShotConnections(params: {
  settings: WorkspaceShotSettings;
  connectedInputs: WorkspaceEdgeKind[];
  capabilities?: WorkspaceModelCapability[];
}): WorkspaceShotValidation {
  const capabilities = params.capabilities ?? getWorkspaceModelCapabilities();
  const capability = getWorkspaceModelCapability(params.settings.modelId, capabilities);
  const connected = new Set(params.connectedInputs.map(normalizeConnectedInputKind));
  if (!capability) {
    return {
      capability: null,
      missingInputs: ['prompt'],
      incompatibleInputs: params.connectedInputs,
      compatibleInputs: [],
      recommendedModels: [],
      resolvedWorkflowType: params.settings.workflowType,
      canGenerate: false,
    };
  }

  const policy = resolveWorkspaceBlockPolicy({
    settings: params.settings,
    capability,
    connectedInputs: params.connectedInputs,
  });
  const resolvedWorkflowType = workflowFromPolicy(policy.mode, {
    capability,
    connectedInputs: params.connectedInputs,
    fallbackWorkflowType: params.settings.workflowType,
  });
  const supportedInputs = new Set(policy.inputConnectors.map((connector) => connector.kind));
  const missingInputs = policy.missingInputs;
  const incompatibleInputs = Array.from(connected).filter((kind) => !inputSupportedBy(kind, supportedInputs));
  const compatibleInputs = Array.from(connected).filter((kind) => inputSupportedBy(kind, supportedInputs));
  const familyMismatch = Boolean(params.settings.family && capability.family !== params.settings.family);
  const outputKindMismatch = Boolean(params.settings.outputKind && capability.outputKind !== params.settings.outputKind);

  return {
    capability,
    missingInputs,
    incompatibleInputs,
    compatibleInputs,
    recommendedModels: suggestWorkspaceModels({
      connectedInputs: params.connectedInputs,
      workflowType: params.settings.workflowType,
      capabilities,
      selectedModelId: params.settings.modelId,
    }),
    resolvedWorkflowType,
    canGenerate:
      !familyMismatch &&
      !outputKindMismatch &&
      missingInputs.length === 0 &&
      incompatibleInputs.length === 0 &&
      capability.workflows.includes(resolvedWorkflowType),
  };
}

export function suggestWorkspaceModels(params: {
  connectedInputs: WorkspaceEdgeKind[];
  workflowType?: WorkspaceWorkflowType;
  capabilities?: WorkspaceModelCapability[];
  selectedModelId?: string;
}): WorkspaceModelCapability[] {
  const capabilities = params.capabilities ?? getWorkspaceModelCapabilities();
  const connected = new Set(params.connectedInputs.map(normalizeConnectedInputKind));

  return capabilities
    .map((capability) => {
      const supportedInputs = new Set([...capability.required_inputs, ...capability.optional_inputs]);
      const workflowScore = params.workflowType && capability.workflows.includes(params.workflowType) ? 6 : 0;
      const supportedScore = Array.from(connected).filter((kind) => inputSupportedBy(kind, supportedInputs)).length * 2;
      const incompatiblePenalty = Array.from(connected).filter((kind) => !inputSupportedBy(kind, supportedInputs)).length * 5;
      const flagshipScore = capability.id.includes('veo') || capability.id.includes('kling') ? 2 : 0;
      return { capability, score: workflowScore + supportedScore + flagshipScore - incompatiblePenalty };
    })
    .filter(({ capability, score }) => score > 0 && capability.id !== params.selectedModelId)
    .sort((a, b) => b.score - a.score || a.capability.label.localeCompare(b.capability.label))
    .slice(0, 4)
    .map(({ capability }) => capability);
}
