import type { Mode } from '@/types/engines';
import { workspaceAudioEnabledForRequest } from './workspace-capabilities';
import {
  resolveWorkspaceGenerationIntent,
  workspaceConnectorSupportsBlockMode,
} from './models/model-input-connectors';
import { resolveWorkspaceBlockPolicy } from './models/workspace-block-capability-policy';
import type {
  WorkspaceBlockMode,
  WorkspaceEdgeKind,
  WorkspaceGenerationMediaInput,
  WorkspaceInputConnector,
  WorkspaceModelCapability,
  WorkspaceShotSettings,
  WorkspaceWorkflowType,
} from './workspace-types';

export type WorkspaceGenerationAssignment = WorkspaceGenerationMediaInput & {
  fieldId: string;
  label: string;
};

export type WorkspaceGenerationFactIssue = {
  fieldId: string;
  code: 'combined_duration' | 'field_capacity' | 'file_duration' | 'file_format' | 'file_size' | 'reference_budget' | 'visual_reference_required';
  message: string;
};

export type WorkspaceGenerationFacts = {
  engineId: string;
  blockMode: WorkspaceBlockMode;
  workflowType: WorkspaceWorkflowType;
  mode: Mode;
  canRoute: boolean;
  durationSec: number;
  resolution: WorkspaceShotSettings['resolution'];
  aspectRatio: WorkspaceShotSettings['aspectRatio'];
  fps: number;
  audio: boolean | undefined;
  assignments: WorkspaceGenerationAssignment[];
  activeConnectors: WorkspaceInputConnector[];
  referenceImageCount: number;
  hasVideoInput: boolean;
  referenceBudget: { used: number; maximum: number; exceeded: boolean } | null;
  issues: WorkspaceGenerationFactIssue[];
};

function activeConnectorsForFacts(params: {
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  connectedInputs: readonly WorkspaceEdgeKind[];
  blockMode: WorkspaceBlockMode;
}): WorkspaceInputConnector[] {
  const policy = resolveWorkspaceBlockPolicy({
    settings: params.settings,
    capability: params.capability,
    connectedInputs: [...params.connectedInputs],
  });
  return policy.inputConnectors.filter((connector) => {
    if (connector.disabledReason) return false;
    if (
      params.blockMode === 'first-last-video' &&
      (connector.kind === 'start_image' || connector.kind === 'end_image')
    ) {
      return true;
    }
    return workspaceConnectorSupportsBlockMode(connector, params.blockMode);
  });
}

function uniqueCount(values: string[]): number {
  return new Set(values.filter(Boolean)).size;
}

function assignmentIssues(
  assignments: WorkspaceGenerationAssignment[],
  capability: WorkspaceModelCapability | null
): WorkspaceGenerationFactIssue[] {
  const issues: WorkspaceGenerationFactIssue[] = [];
  const assignmentsByField = new Map<string, WorkspaceGenerationAssignment[]>();
  for (const assignment of assignments) {
    const connector = capability?.input_connectors.find((candidate) => candidate.fieldId === assignment.fieldId);
    assignmentsByField.set(assignment.fieldId, [...(assignmentsByField.get(assignment.fieldId) ?? []), assignment]);
    if (connector?.maxFileSizeMb && assignment.sizeBytes && assignment.sizeBytes > connector.maxFileSizeMb * 1024 * 1024) {
      issues.push({
        fieldId: assignment.fieldId,
        code: 'file_size',
        message: `${assignment.label} exceeds the ${connector.maxFileSizeMb} MB limit.`,
      });
    }
    if (connector?.maxDurationSec && assignment.durationSec && assignment.durationSec > connector.maxDurationSec) {
      issues.push({
        fieldId: assignment.fieldId,
        code: 'file_duration',
        message: `${assignment.label} exceeds the ${connector.maxDurationSec}s duration limit.`,
      });
    }
    if (connector?.minDurationSec && assignment.durationSec && assignment.durationSec < connector.minDurationSec) {
      issues.push({
        fieldId: assignment.fieldId,
        code: 'file_duration',
        message: `${assignment.label} must be at least ${connector.minDurationSec}s long (minimum).`,
      });
    }
    if (connector?.acceptedFormats?.length && (assignment.mimeType || assignment.name)) {
      const accepted = new Set(connector.acceptedFormats.map((value) => value.toLowerCase().replace(/^\./, '')));
      const mime = assignment.mimeType?.toLowerCase();
      const extension = assignment.name?.split('.').pop()?.toLowerCase();
      const mimeSubtype = mime?.split('/').pop();
      if (![mime, mimeSubtype, extension].some((candidate) => candidate && accepted.has(candidate))) {
        issues.push({
          fieldId: assignment.fieldId,
          code: 'file_format',
          message: `${assignment.label} uses an unsupported file format.`,
        });
      }
    }
  }
  for (const [fieldId, fieldAssignments] of assignmentsByField) {
    const connector = capability?.input_connectors.find((candidate) => candidate.fieldId === fieldId);
    if (connector?.maxCount && fieldAssignments.length > connector.maxCount) {
      issues.push({
        fieldId,
        code: 'field_capacity',
        message: `${connector.label} accepts at most ${connector.maxCount} files.`,
      });
    }
  }

  const constraints = capability?.input_constraints;
  const combinedVideoDuration = assignments
    .filter((assignment) => assignment.kind === 'video')
    .reduce((total, assignment) => total + (assignment.durationSec ?? 0), 0);
  const combinedAudioDuration = assignments
    .filter((assignment) => assignment.kind === 'audio')
    .reduce((total, assignment) => total + (assignment.durationSec ?? 0), 0);
  if (
    typeof constraints?.maxCombinedVideoDurationSec === 'number' &&
    combinedVideoDuration > constraints.maxCombinedVideoDurationSec
  ) {
    issues.push({
      fieldId: 'video_references',
      code: 'combined_duration',
      message: `Combined video references exceed ${constraints.maxCombinedVideoDurationSec}s.`,
    });
  }
  if (
    typeof constraints?.maxCombinedAudioDurationSec === 'number' &&
    combinedAudioDuration > constraints.maxCombinedAudioDurationSec
  ) {
    issues.push({
      fieldId: 'audio_references',
      code: 'combined_duration',
      message: `Combined audio references exceed ${constraints.maxCombinedAudioDurationSec}s.`,
    });
  }
  if (
    constraints?.referenceAudioRequiresVisual &&
    assignments.some((assignment) => assignment.kind === 'audio') &&
    !assignments.some((assignment) => assignment.kind === 'image' || assignment.kind === 'video')
  ) {
    issues.push({
      fieldId: 'audio_references',
      code: 'visual_reference_required',
      message: 'Reference audio requires at least one image or video reference.',
    });
  }
  return issues;
}

export function resolveWorkspaceGenerationFacts(params: {
  settings: WorkspaceShotSettings;
  connectedInputs: readonly WorkspaceEdgeKind[];
  capability: WorkspaceModelCapability | null;
  mediaInputs?: readonly WorkspaceGenerationMediaInput[];
}): WorkspaceGenerationFacts {
  const intent = resolveWorkspaceGenerationIntent({
    settings: params.settings,
    connectedInputs: params.connectedInputs,
    capability: params.capability,
  });
  const activeConnectors = activeConnectorsForFacts({ ...params, blockMode: intent.blockMode });
  const assignments = (params.mediaInputs ?? []).flatMap((input): WorkspaceGenerationAssignment[] => {
    const connector = activeConnectors.find((candidate) => candidate.kind === input.semanticKind);
    if (!connector) return [];
    return [{
      ...input,
      fieldId: input.fieldId ?? connector.fieldId ?? input.semanticKind,
      label: connector.label,
    }];
  });
  const referenceImageCount = intent.blockMode === 'reference-to-video'
    ? uniqueCount(assignments.filter((assignment) => assignment.kind === 'image').map((assignment) => assignment.url))
    : 0;
  const hasVideoInput = assignments.some((assignment) => assignment.kind === 'video') ||
    params.connectedInputs.some((kind) => (
      kind === 'video_reference' || kind === 'motion_reference' || kind === 'previous_shot' || kind === 'continuity'
    ));
  const referenceBudgetConfig = params.capability?.reference_budget;
  const budgetApplies = Boolean(
    referenceBudgetConfig &&
    (!referenceBudgetConfig.modes?.length || referenceBudgetConfig.modes.includes(intent.generationMode))
  );
  const referenceBudgetUsed = budgetApplies && referenceBudgetConfig
    ? uniqueCount(assignments
        .filter((assignment) => referenceBudgetConfig.fieldIds.includes(assignment.fieldId))
        .map((assignment) => assignment.url))
    : 0;
  const referenceBudget = budgetApplies && referenceBudgetConfig
    ? {
        used: referenceBudgetUsed,
        maximum: referenceBudgetConfig.maxTotal,
        exceeded: referenceBudgetUsed > referenceBudgetConfig.maxTotal,
      }
    : null;
  const issues = assignmentIssues(assignments, params.capability);
  if (referenceBudget?.exceeded) {
    issues.push({
      fieldId: 'references',
      code: 'reference_budget',
      message: `Reference budget exceeds ${referenceBudget.maximum} unique files.`,
    });
  }

  return {
    engineId: params.settings.modelId,
    blockMode: intent.blockMode,
    workflowType: intent.workflowType,
    mode: intent.generationMode,
    canRoute: intent.canRoute,
    durationSec: params.settings.durationSec,
    resolution: params.settings.resolution,
    aspectRatio: params.settings.aspectRatio,
    fps: params.settings.fps,
    audio: workspaceAudioEnabledForRequest(params.settings, params.capability),
    assignments,
    activeConnectors,
    referenceImageCount,
    hasVideoInput,
    referenceBudget,
    issues,
  };
}
