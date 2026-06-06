import { getBaseEngines } from '@/lib/engines';
import type { AspectRatio, EngineCaps, EngineInputField, Mode, Resolution } from '@/types/engines';
import type {
  WorkspaceEdgeKind,
  WorkspaceInputConnector,
  WorkspaceModelCapability,
  WorkspaceRenderOption,
  WorkspaceShotSettings,
  WorkspaceShotValidation,
  WorkspaceWorkflowType,
} from './workspace-types';
import { edgeLabel } from './workspace-templates';

const ALL_INPUT_KINDS: WorkspaceEdgeKind[] = [
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

function fieldsFor(engine: EngineCaps): EngineInputField[] {
  return [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])];
}

function hasFieldType(engine: EngineCaps, type: EngineInputField['type']): boolean {
  return fieldsFor(engine).some((field) => field.type === type);
}

function hasFieldId(engine: EngineCaps, fragments: string[]): boolean {
  return fieldsFor(engine).some((field) => {
    const id = field.id.toLowerCase();
    return fragments.some((fragment) => id.includes(fragment));
  });
}

function fieldSearchKey(field: EngineInputField): string {
  return [field.id, field.engineParam, field.label]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function audioToggleFieldFor(engine: EngineCaps): EngineInputField | null {
  return (
    fieldsFor(engine).find((field) => {
      if (field.type !== 'boolean' && field.type !== 'enum') return false;
      const key = fieldSearchKey(field);
      if (!key.includes('audio') && !key.includes('sound')) return false;
      if (key.includes('audiourl') || key.includes('audioinput') || key.includes('audiosetting') || key.includes('keepaudio')) {
        return false;
      }
      return (
        key.includes('generateaudio') ||
        key.includes('audioenabled') ||
        key.includes('enableaudio') ||
        key.includes('withaudio') ||
        key === 'audio' ||
        key === 'sound'
      );
    }) ?? null
  );
}

function lipSyncFieldFor(engine: EngineCaps): EngineInputField | null {
  return (
    fieldsFor(engine).find((field) => {
      if (field.type !== 'boolean' && field.type !== 'enum') return false;
      const key = fieldSearchKey(field);
      return key.includes('lipsync') || key.includes('lipsynch') || key.includes('lipsynchronization');
    }) ?? null
  );
}

function hasModeAudioToggle(engine: EngineCaps): boolean {
  return Object.values(engine.modeCaps ?? {}).some((caps) => caps?.audioToggle === true);
}

function defaultEnabledFor(field: EngineInputField | null, fallback: boolean): boolean {
  const value = field?.default;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'on' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === 'off' || normalized === 'no') return false;
  }
  return fallback;
}

function hasMode(engine: EngineCaps, modes: Mode[]): boolean {
  return modes.some((mode) => engine.modes.includes(mode));
}

function workflowTypesFor(engine: EngineCaps): WorkspaceWorkflowType[] {
  const workflows: WorkspaceWorkflowType[] = [];
  if (hasMode(engine, ['t2v'])) workflows.push('text_to_video');
  if (hasMode(engine, ['i2v', 'ref2v', 'fl2v', 'r2v'])) workflows.push('image_to_video');
  if (hasMode(engine, ['v2v', 'extend', 'retake', 'reframe'])) workflows.push('video_to_video');
  if (hasMode(engine, ['r2v']) || engine.id.includes('storyboard')) workflows.push('storyboard_to_video');
  return workflows.length ? workflows : ['text_to_video'];
}

function supportedDurations(engine: EngineCaps): number[] {
  const values = new Set<number>();
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    if (!caps?.duration) return;
    if ('options' in caps.duration) {
      caps.duration.options.forEach((value) => {
        const numeric = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
        if (Number.isFinite(numeric)) values.add(numeric);
      });
      return;
    }
    if (Number.isFinite(caps.duration.default)) values.add(caps.duration.default);
    if (Number.isFinite(caps.duration.min)) values.add(caps.duration.min);
  });
  if (!values.size && Number.isFinite(engine.maxDurationSec)) {
    values.add(Math.min(engine.maxDurationSec, 5));
    if (engine.maxDurationSec >= 8) values.add(8);
    if (engine.maxDurationSec >= 10) values.add(10);
  }
  return Array.from(values).sort((a, b) => a - b);
}

function supportedAspectRatios(engine: EngineCaps): AspectRatio[] {
  const ratios = new Set<AspectRatio>(engine.aspectRatios);
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    caps?.aspectRatio?.forEach((ratio) => ratios.add(ratio as AspectRatio));
  });
  return Array.from(ratios);
}

function supportedResolutions(engine: EngineCaps): Resolution[] {
  const resolutions = new Set<Resolution>(engine.resolutions);
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    caps?.resolution?.forEach((resolution) => resolutions.add(resolution as Resolution));
  });
  return Array.from(resolutions);
}

function supportedFps(engine: EngineCaps): number[] {
  const fps = new Set<number>(engine.fps);
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    if (Array.isArray(caps?.fps)) {
      caps.fps.forEach((value) => fps.add(value));
    } else if (typeof caps?.fps === 'number') {
      fps.add(caps.fps);
    }
  });
  return Array.from(fps).sort((a, b) => a - b);
}

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

export function resolveWorkspaceRenderOptions(engine: EngineCaps): WorkspaceRenderOption[] {
  const options: WorkspaceRenderOption[] = [];
  const audioField = audioToggleFieldFor(engine);
  const hasAudioToggle = hasModeAudioToggle(engine) || Boolean(audioField);

  if (hasAudioToggle) {
    options.push({
      id: 'audio',
      label: audioField?.label || 'Audio',
      control: 'toggle',
      defaultEnabled: defaultEnabledFor(audioField, true),
      fieldId: audioField?.id,
      engineParam: audioField?.engineParam,
      description: audioField?.description,
    });
  } else if (engine.audio) {
    options.push({
      id: 'audio',
      label: 'Native audio',
      control: 'included',
      defaultEnabled: true,
      description: 'This engine includes native audio without a separate render toggle.',
    });
  }

  const lipSyncField = lipSyncFieldFor(engine);
  if (lipSyncField) {
    options.push({
      id: 'lip_sync',
      label: lipSyncField.label || 'Lip-sync',
      control: 'toggle',
      defaultEnabled: defaultEnabledFor(lipSyncField, false),
      fieldId: lipSyncField.id,
      engineParam: lipSyncField.engineParam,
      description: lipSyncField.description,
    });
  }

  return options;
}

export function workspaceAudioEnabledForRequest(
  settings: Pick<WorkspaceShotSettings, 'audioEnabled'>,
  capability: WorkspaceModelCapability | null
): boolean | undefined {
  const audioOption = capability?.render_options.find((option) => option.id === 'audio');
  if (audioOption?.control !== 'toggle') return undefined;
  return settings.audioEnabled;
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

function inputConnectorsFor(engine: EngineCaps, requiredInputs: WorkspaceEdgeKind[], optionalInputs: WorkspaceEdgeKind[]): WorkspaceInputConnector[] {
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

function optionalInputsFor(engine: EngineCaps): WorkspaceEdgeKind[] {
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

function requiredInputsFor(engine: EngineCaps): WorkspaceEdgeKind[] {
  const required = new Set<WorkspaceEdgeKind>(['prompt']);
  if (!hasMode(engine, ['t2v']) && hasMode(engine, ['i2v', 'ref2v', 'fl2v', 'r2v'])) {
    required.add('start_image');
  }
  if (!hasMode(engine, ['t2v', 'i2v', 'ref2v', 'fl2v', 'r2v']) && hasMode(engine, ['v2v'])) {
    required.add('video_reference');
  }
  return Array.from(required);
}

function buildCapability(engine: EngineCaps): WorkspaceModelCapability {
  const workflows = workflowTypesFor(engine);
  const family = engine.id.toLowerCase();
  const supportsImage = hasMode(engine, ['i2v', 'ref2v', 'fl2v', 'r2v']) || hasFieldType(engine, 'image');
  const supportsVideo = hasMode(engine, ['v2v', 'extend', 'retake', 'reframe']) || hasFieldType(engine, 'video');
  const supportsAudio = engine.audio || hasFieldType(engine, 'audio') || hasMode(engine, ['a2v']);
  const renderOptions = resolveWorkspaceRenderOptions(engine);
  const baseRequiredInputs = requiredInputsFor(engine);
  const baseOptionalInputs = optionalInputsFor(engine);
  const inputConnectors = inputConnectorsFor(engine, baseRequiredInputs, baseOptionalInputs);
  const requiredInputs = inputConnectors.filter((connector) => connector.required).map((connector) => connector.kind);
  const optionalInputs = inputConnectors.filter((connector) => !connector.required).map((connector) => connector.kind);
  const supportedInputs = new Set([...requiredInputs, ...optionalInputs]);

  return {
    id: engine.id,
    label: engine.label,
    provider: engine.provider,
    providerEngineSlug: engine.providerMeta?.modelSlug ?? engine.id,
    modes: [...engine.modes],
    workflows,
    text_to_video: workflows.includes('text_to_video'),
    image_to_video: workflows.includes('image_to_video'),
    video_to_video: workflows.includes('video_to_video'),
    storyboard_to_video: workflows.includes('storyboard_to_video'),
    reference_image: supportsImage,
    reference_video: supportsVideo,
    product_reference: supportsImage && !family.startsWith('sora'),
    character_reference: supportsImage && (family.includes('kling') || family.includes('ltx') || family.includes('happy-horse')),
    motion_reference: supportsVideo || hasMode(engine, ['ref2v']),
    audio_input: supportsAudio,
    music_input: supportsAudio,
    voiceover_input: supportsAudio || engine.audio || family.includes('veo') || family.includes('happy-horse'),
    dialogue: engine.audio || family.includes('veo') || family.includes('happy-horse') || hasFieldId(engine, ['dialogue']),
    lip_sync: renderOptions.some((option) => option.id === 'lip_sync'),
    audio_generation: renderOptions.some((option) => option.id === 'audio'),
    supports_people_reference: supportsImage && !family.startsWith('sora') && !family.includes('seedance-2-0-fast'),
    supports_product_reference: supportsImage && !family.startsWith('sora'),
    supported_aspect_ratios: supportedAspectRatios(engine),
    supported_durations: supportedDurations(engine),
    supported_resolutions: supportedResolutions(engine),
    supported_fps: supportedFps(engine),
    input_connectors: inputConnectors,
    render_options: renderOptions,
    required_inputs: requiredInputs,
    optional_inputs: optionalInputs,
    unsupported_inputs: ALL_INPUT_KINDS.filter((kind) => !supportedInputs.has(kind)),
  };
}

export function getWorkspaceModelCapabilities(engines: EngineCaps[] = getBaseEngines()): WorkspaceModelCapability[] {
  return engines.map(buildCapability).filter((capability) => capability.workflows.length > 0);
}

export function getWorkspaceModelCapability(
  modelId: string,
  capabilities: WorkspaceModelCapability[] = getWorkspaceModelCapabilities()
): WorkspaceModelCapability | null {
  return capabilities.find((capability) => capability.id === modelId) ?? capabilities[0] ?? null;
}

export function normalizeConnectedInputKind(kind: WorkspaceEdgeKind): WorkspaceEdgeKind {
  if (kind === 'product' || kind === 'character' || kind === 'logo') return kind;
  if (kind === 'start_image' || kind === 'end_image') return kind;
  if (kind === 'video_reference') return 'video_reference';
  return kind;
}

function connectedSatisfiesRequirement(connected: Set<WorkspaceEdgeKind>, required: WorkspaceEdgeKind): boolean {
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

function inputSupportedBy(kind: WorkspaceEdgeKind, supportedInputs: Set<WorkspaceEdgeKind>): boolean {
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

  const resolvedWorkflowType = resolveWorkspaceWorkflowType({
    capability,
    connectedInputs: params.connectedInputs,
    fallbackWorkflowType: params.settings.workflowType,
  });
  const requiredForWorkflow = new Set<WorkspaceEdgeKind>(capability.required_inputs);
  const supportedInputs = new Set([...capability.required_inputs, ...capability.optional_inputs]);
  const missingInputs = Array.from(requiredForWorkflow).filter((kind) => !connectedSatisfiesRequirement(connected, kind));
  const incompatibleInputs = Array.from(connected).filter((kind) => !inputSupportedBy(kind, supportedInputs));
  const compatibleInputs = Array.from(connected).filter((kind) => inputSupportedBy(kind, supportedInputs));

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
    canGenerate: missingInputs.length === 0 && incompatibleInputs.length === 0 && capability.workflows.includes(resolvedWorkflowType),
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
