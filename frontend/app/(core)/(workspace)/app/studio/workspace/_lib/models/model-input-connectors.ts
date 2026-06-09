import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';
import type { WorkspaceEdgeKind, WorkspaceInputConnector, WorkspaceModelCapability, WorkspaceShotSettings, WorkspaceWorkflowType } from '../workspace-types';
import { edgeLabel } from '../workspace-templates';
import { hasFieldId, hasFieldType, hasMode } from './model-engine-fields';

export const ALL_INPUT_KINDS: WorkspaceEdgeKind[] = [
  'reference',
  'start_image',
  'end_image',
  'product',
  'character',
  'style',
  'composition',
  'logo',
  'prompt',
  'negative_prompt',
  'camera',
  'dialogue',
  'narration',
  'audio',
  'voiceover',
  'music',
  'sfx',
  'motion_reference',
  'previous_shot',
  'continuity',
  'video_reference',
];

const WORKSPACE_CONNECTOR_ORDER: WorkspaceEdgeKind[] = [
  'prompt',
  'negative_prompt',
  'start_image',
  'end_image',
  'reference',
  'product',
  'character',
  'style',
  'composition',
  'logo',
  'video_reference',
  'motion_reference',
  'previous_shot',
  'continuity',
  'audio',
  'voiceover',
  'music',
  'sfx',
  'camera',
  'dialogue',
  'narration',
];

type WorkspaceConnectionFamily = 'text' | 'image' | 'video' | 'audio' | 'generated_output' | 'timeline';

type WorkspaceConnectionCapacity = {
  maxCount: number;
  remainingCount: number;
  capacityLabel: string | null;
  isFull: boolean;
};

function isNegativePromptField(field: EngineInputField): boolean {
  const id = field.id.toLowerCase();
  const label = field.label.toLowerCase();
  const compactId = id.replace(/[^a-z0-9]/g, '');
  const compactLabel = label.replace(/[^a-z0-9]/g, '');
  return (
    id === 'negative_prompt' ||
    compactId.includes('negativeprompt') ||
    compactId.includes('negprompt') ||
    compactLabel.includes('negativeprompt') ||
    compactLabel.includes('negprompt')
  );
}

function connectorKindForField(field: EngineInputField): WorkspaceEdgeKind | null {
  const id = field.id.toLowerCase();
  if (field.type === 'text') {
    return isNegativePromptField(field) ? 'negative_prompt' : 'prompt';
  }
  if (field.type === 'image') {
    if (id.includes('last_frame') || id.includes('end_image')) return 'end_image';
    if (
      id === 'image_url' ||
      id === 'input_image' ||
      id.includes('first_frame') ||
      id.includes('start_image')
    ) {
      return 'start_image';
    }
    return 'reference';
  }
  if (field.type === 'video') {
    if (id.includes('motion')) return 'motion_reference';
    if (id.includes('previous')) return 'previous_shot';
    return 'video_reference';
  }
  if (field.type === 'audio') return 'audio';
  return null;
}

function sourceTypeForField(field: EngineInputField): WorkspaceInputConnector['sourceType'] {
  if (field.type === 'text' || field.type === 'image' || field.type === 'video' || field.type === 'audio') {
    return field.type;
  }
  return 'control';
}

function connectorRequired(field: EngineInputField, origin: 'required' | 'optional'): boolean {
  if (origin !== 'required') return false;
  return !field.modes?.length || field.modes.includes('t2v');
}

function sanitizeConnectorLabel(label: string, maxCount?: number): string {
  if (!maxCount || maxCount <= 1) return label;
  return label
    .replace(/\s*\((?:up to\s*)?\d+(?:\s*[-/]\s*\d+)?\)\s*$/i, '')
    .replace(/\s+up to\s+\d+\s*$/i, '')
    .trim();
}

function insertConnector(
  connectors: Map<WorkspaceEdgeKind, WorkspaceInputConnector>,
  connector: WorkspaceInputConnector
): void {
  const existing = connectors.get(connector.kind);
  if (!existing || (!existing.required && connector.required)) {
    connectors.set(connector.kind, connector);
  }
}

function connectorFromField(field: EngineInputField, origin: 'required' | 'optional'): WorkspaceInputConnector | null {
  const kind = connectorKindForField(field);
  if (!kind) return null;
  return {
    kind,
    label: sanitizeConnectorLabel(field.label || edgeLabel(kind), field.maxCount),
    required: connectorRequired(field, origin),
    fieldId: field.id,
    description: field.description,
    maxCount: field.maxCount,
    sourceType: sourceTypeForField(field),
  };
}

function connectionFamilyForHandle(handle: WorkspaceEdgeKind): WorkspaceConnectionFamily {
  if (handle === 'generated_output') return 'generated_output';
  if (handle === 'output_to_timeline') return 'timeline';
  if (
    handle === 'prompt' ||
    handle === 'negative_prompt' ||
    handle === 'camera' ||
    handle === 'dialogue' ||
    handle === 'narration'
  ) {
    return 'text';
  }
  if (
    handle === 'video_reference' ||
    handle === 'motion_reference' ||
    handle === 'previous_shot' ||
    handle === 'continuity'
  ) {
    return 'video';
  }
  if (handle === 'audio' || handle === 'voiceover' || handle === 'music' || handle === 'sfx') {
    return 'audio';
  }
  return 'image';
}

function isVideoInputHandle(handle: WorkspaceEdgeKind): boolean {
  return connectionFamilyForHandle(handle) === 'video';
}

export function isWorkspaceConnectionCompatible({
  sourceHandle,
  targetHandle,
}: {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): boolean {
  if (!sourceHandle || !targetHandle) return false;
  const source = sourceHandle as WorkspaceEdgeKind;
  const target = targetHandle as WorkspaceEdgeKind;
  if (!ALL_INPUT_KINDS.includes(source) && source !== 'generated_output' && source !== 'output_to_timeline') return false;
  if (!ALL_INPUT_KINDS.includes(target) && target !== 'generated_output' && target !== 'output_to_timeline') return false;
  if (source === 'generated_output') {
    return target === 'generated_output' || isVideoInputHandle(target);
  }
  if (target === 'generated_output') return false;
  return connectionFamilyForHandle(source) === connectionFamilyForHandle(target);
}

export function workspaceConnectionCapacity({
  connector,
  connectedCount,
}: {
  connector: WorkspaceInputConnector;
  connectedCount: number;
}): WorkspaceConnectionCapacity {
  const rawMaxCount = connector.maxCount;
  const maxCount = rawMaxCount === undefined ? 1 : Math.max(0, rawMaxCount);
  const remainingCount = Math.max(0, maxCount - Math.max(0, connectedCount));
  return {
    maxCount,
    remainingCount,
    capacityLabel: maxCount > 1 ? `${remainingCount}/${maxCount}` : null,
    isFull: remainingCount <= 0,
  };
}

function connectorFromKind(kind: WorkspaceEdgeKind, required: boolean): WorkspaceInputConnector {
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

function sortConnectors(connectors: WorkspaceInputConnector[]): WorkspaceInputConnector[] {
  return connectors
    .map((connector, index) => ({
      connector,
      index,
      priority: WORKSPACE_CONNECTOR_ORDER.indexOf(connector.kind),
    }))
    .sort((left, right) => {
      const leftPriority = left.priority === -1 ? WORKSPACE_CONNECTOR_ORDER.length : left.priority;
      const rightPriority = right.priority === -1 ? WORKSPACE_CONNECTOR_ORDER.length : right.priority;
      return leftPriority - rightPriority || left.index - right.index;
    })
    .map(({ connector }) => connector);
}

export function inputConnectorsFor(engine: EngineCaps, requiredInputs: WorkspaceEdgeKind[], optionalInputs: WorkspaceEdgeKind[]): WorkspaceInputConnector[] {
  const connectors = new Map<WorkspaceEdgeKind, WorkspaceInputConnector>();
  const ingest = (fields: EngineInputField[] | undefined, origin: 'required' | 'optional') => {
    fields?.forEach((field) => {
      const connector = connectorFromField(field, origin);
      if (connector) insertConnector(connectors, connector);
    });
  };

  ingest(engine.inputSchema?.required, 'required');
  ingest(engine.inputSchema?.optional, 'optional');

  if (!connectors.size) {
    requiredInputs.forEach((kind) => insertConnector(connectors, connectorFromKind(kind, true)));
    optionalInputs.forEach((kind) => insertConnector(connectors, connectorFromKind(kind, false)));
  } else {
    requiredInputs.forEach((kind) => {
      const existing = connectors.get(kind);
      if (existing) {
        connectors.set(kind, { ...existing, required: true });
      }
    });
  }

  if (!connectors.has('prompt')) {
    insertConnector(connectors, connectorFromKind('prompt', true));
  }

  return sortConnectors(Array.from(connectors.values()));
}

export function optionalInputsFor(engine: EngineCaps): WorkspaceEdgeKind[] {
  const inputs = new Set<WorkspaceEdgeKind>(['prompt', 'style', 'camera', 'composition', 'continuity']);
  const supportsImage = hasMode(engine, ['i2v', 'ref2v', 'fl2v', 'r2v']) || hasFieldType(engine, 'image');
  const supportsVideo = hasMode(engine, ['v2v', 'extend', 'retake', 'reframe']) || hasFieldType(engine, 'video');
  const supportsAudio = engine.audio || hasFieldType(engine, 'audio') || hasMode(engine, ['a2v']);
  const family = engine.id.toLowerCase();

  if (supportsImage) {
    ['start_image', 'reference', 'product', 'style', 'composition', 'logo'].forEach((kind) => inputs.add(kind as WorkspaceEdgeKind));
    if (hasMode(engine, ['fl2v']) || hasFieldId(engine, ['last_frame', 'end_image'])) inputs.add('end_image');
    if (!family.startsWith('sora')) inputs.add('character');
  }
  if (supportsVideo) {
    inputs.add('video_reference');
    inputs.add('motion_reference');
    inputs.add('previous_shot');
  }
  if (supportsAudio) {
    inputs.add('audio');
    inputs.add('music');
    inputs.add('sfx');
  }
  if (engine.audio || family.includes('veo') || family.includes('happy-horse') || hasFieldId(engine, ['voice', 'dialogue', 'audio'])) {
    inputs.add('voiceover');
    inputs.add('dialogue');
    inputs.add('narration');
  }
  if (hasFieldId(engine, ['negative'])) inputs.add('negative_prompt');
  return Array.from(inputs);
}

export function requiredInputsFor(engine: EngineCaps): WorkspaceEdgeKind[] {
  const required = new Set<WorkspaceEdgeKind>(['prompt']);
  if (!hasMode(engine, ['t2v']) && hasMode(engine, ['i2v', 'ref2v', 'fl2v', 'r2v'])) {
    required.add('start_image');
  }
  if (!hasMode(engine, ['t2v', 'i2v', 'ref2v', 'fl2v', 'r2v']) && hasMode(engine, ['v2v'])) {
    required.add('video_reference');
  }
  return Array.from(required);
}

export function normalizeConnectedInputKind(kind: WorkspaceEdgeKind): WorkspaceEdgeKind {
  if (kind === 'product' || kind === 'character' || kind === 'logo') return kind;
  if (kind === 'start_image' || kind === 'end_image') return kind;
  if (kind === 'video_reference') return 'video_reference';
  return kind;
}

export function connectedSatisfiesRequirement(connected: Set<WorkspaceEdgeKind>, required: WorkspaceEdgeKind): boolean {
  if (required === 'reference') {
    return ['reference', 'start_image', 'product', 'character', 'style', 'composition', 'logo'].some((kind) =>
      connected.has(kind as WorkspaceEdgeKind)
    );
  }
  if (required === 'start_image') {
    return ['start_image', 'reference', 'product', 'character', 'style', 'composition', 'logo'].some((kind) =>
      connected.has(kind as WorkspaceEdgeKind)
    );
  }
  if (required === 'end_image') {
    return connected.has('end_image');
  }
  if (required === 'prompt') {
    return ['prompt', 'style', 'camera', 'dialogue', 'narration'].some((kind) => connected.has(kind as WorkspaceEdgeKind));
  }
  if (required === 'video_reference') {
    return ['video_reference', 'motion_reference', 'previous_shot', 'continuity'].some((kind) =>
      connected.has(kind as WorkspaceEdgeKind)
    );
  }
  if (required === 'audio') {
    return ['audio', 'voiceover', 'music', 'sfx'].some((kind) => connected.has(kind as WorkspaceEdgeKind));
  }
  return connected.has(required);
}

function hasImageInput(connected: Set<WorkspaceEdgeKind>): boolean {
  return ['start_image', 'end_image', 'reference', 'product', 'character', 'style', 'composition', 'logo'].some((kind) =>
    connected.has(kind as WorkspaceEdgeKind)
  );
}

function hasVideoInput(connected: Set<WorkspaceEdgeKind>): boolean {
  return ['video_reference', 'motion_reference', 'previous_shot', 'continuity'].some((kind) =>
    connected.has(kind as WorkspaceEdgeKind)
  );
}

export function inputSupportedBy(kind: WorkspaceEdgeKind, supportedInputs: Set<WorkspaceEdgeKind>): boolean {
  if (supportedInputs.has(kind)) return true;
  if (['product', 'character', 'style', 'composition', 'logo'].includes(kind)) {
    return supportedInputs.has('start_image') || supportedInputs.has('reference');
  }
  if (kind === 'reference') {
    return supportedInputs.has('start_image');
  }
  if (kind === 'motion_reference' || kind === 'previous_shot' || kind === 'continuity') {
    return supportedInputs.has('video_reference');
  }
  if (kind === 'music' || kind === 'voiceover' || kind === 'sfx') {
    return supportedInputs.has('audio');
  }
  if (kind === 'camera' || kind === 'dialogue' || kind === 'narration' || kind === 'style') {
    return supportedInputs.has('prompt');
  }
  return false;
}

export function resolveWorkspaceWorkflowType(params: {
  capability: WorkspaceModelCapability | null;
  connectedInputs: WorkspaceEdgeKind[];
  fallbackWorkflowType: WorkspaceWorkflowType;
}): WorkspaceWorkflowType {
  const connected = new Set(params.connectedInputs.map(normalizeConnectedInputKind));
  const capability = params.capability;
  if (capability && hasVideoInput(connected) && capability.video_to_video) return 'video_to_video';
  if (capability && hasImageInput(connected) && capability.image_to_video) return 'image_to_video';
  if (capability?.text_to_video) return 'text_to_video';
  return capability?.workflows[0] ?? params.fallbackWorkflowType;
}

export function resolveWorkspaceGenerationMode(params: {
  settings: WorkspaceShotSettings;
  connectedInputs: WorkspaceEdgeKind[];
  capability: WorkspaceModelCapability | null;
}): Mode {
  const connected = new Set(params.connectedInputs.map(normalizeConnectedInputKind));
  const capability = params.capability;
  if (
    (connected.has('end_image') || (connected.has('start_image') && connected.has('reference'))) &&
    capability?.modes.includes('fl2v')
  ) {
    return 'fl2v';
  }
  if (
    ['start_image', 'end_image', 'reference', 'product', 'character', 'style', 'composition', 'logo'].some((kind) =>
      connected.has(kind as WorkspaceEdgeKind)
    )
  ) {
    if (capability?.modes.includes('i2v')) return 'i2v';
    if (capability?.modes.includes('ref2v')) return 'ref2v';
    if (capability?.modes.includes('r2v')) return 'r2v';
  }
  if (['video_reference', 'motion_reference', 'previous_shot', 'continuity'].some((kind) => connected.has(kind as WorkspaceEdgeKind))) {
    if (capability?.modes.includes('v2v')) return 'v2v';
    if (capability?.modes.includes('ref2v')) return 'ref2v';
    if (capability?.modes.includes('r2v')) return 'r2v';
    if (capability?.modes.includes('reframe')) return 'reframe';
  }
  if (params.settings.workflowType === 'image_to_video' && capability?.modes.includes('i2v')) return 'i2v';
  if (params.settings.workflowType === 'video_to_video' && capability?.modes.includes('v2v')) return 'v2v';
  if (params.settings.workflowType === 'storyboard_to_video' && capability?.modes.includes('r2v')) return 'r2v';
  return capability?.modes.find((mode) => mode === 't2v') ?? capability?.modes[0] ?? 't2v';
}

export function getWorkspaceShotInputConnectors(capability: WorkspaceModelCapability | null): WorkspaceInputConnector[] {
  return capability?.input_connectors ?? [connectorFromKind('prompt', true)];
}

export function getWorkspaceShotTargetHandles(capability: WorkspaceModelCapability | null): WorkspaceEdgeKind[] {
  return getWorkspaceShotInputConnectors(capability).map((connector) => connector.kind);
}
