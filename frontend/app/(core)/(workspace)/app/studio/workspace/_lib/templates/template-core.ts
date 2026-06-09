import type { WorkspaceEdgeKind, WorkspaceGraphEdge, WorkspaceShotSettings } from '../workspace-types';

export const DEFAULT_WORKSPACE_TEMPLATE_SHOT_MODEL_ID = 'seedance-2-0';

export const WORKSPACE_EDGE_COLORS: Record<WorkspaceEdgeKind, string> = {
  reference: '#8b5cf6',
  start_image: '#8b5cf6',
  end_image: '#c084fc',
  product: '#a855f7',
  character: '#ec4899',
  style: '#d946ef',
  composition: '#38bdf8',
  logo: '#facc15',
  prompt: '#60a5fa',
  negative_prompt: '#fb7185',
  camera: '#22d3ee',
  dialogue: '#f97316',
  narration: '#fb923c',
  audio: '#22c55e',
  voiceover: '#14b8a6',
  music: '#16a34a',
  sfx: '#7c3aed',
  motion_reference: '#3b82f6',
  previous_shot: '#06b6d4',
  continuity: '#2dd4bf',
  generated_output: '#f97316',
  output_to_timeline: '#eab308',
  video_reference: '#2563eb',
};

const EDGE_LABELS: Record<WorkspaceEdgeKind, string> = {
  reference: 'Reference',
  start_image: 'Start image',
  end_image: 'End image',
  product: 'Product',
  character: 'Character',
  style: 'Style',
  composition: 'Composition',
  logo: 'Logo',
  prompt: 'Prompt',
  negative_prompt: 'Negative',
  camera: 'Camera',
  dialogue: 'Dialogue',
  narration: 'Narration',
  audio: 'Audio',
  voiceover: 'Voice',
  music: 'Music',
  sfx: 'SFX',
  motion_reference: 'Motion',
  previous_shot: 'Previous shot',
  continuity: 'Continuity',
  generated_output: 'Output',
  output_to_timeline: 'Timeline',
  video_reference: 'Video ref',
};

export function edgeLabel(kind: WorkspaceEdgeKind): string {
  return EDGE_LABELS[kind] ?? kind;
}

export function inferWorkspaceEdgeKind(sourceHandle?: string | null, targetHandle?: string | null): WorkspaceEdgeKind {
  const raw = (targetHandle || sourceHandle || 'reference') as WorkspaceEdgeKind;
  if (raw === 'start_image' || raw === 'end_image') return raw;
  if (raw === 'product' || raw === 'character' || raw === 'style' || raw === 'composition' || raw === 'logo') return raw;
  if (raw === 'prompt' || raw === 'negative_prompt' || raw === 'camera' || raw === 'dialogue' || raw === 'narration') return raw;
  if (raw === 'audio' || raw === 'voiceover' || raw === 'music' || raw === 'sfx') return raw;
  if (raw === 'motion_reference' || raw === 'previous_shot' || raw === 'video_reference' || raw === 'continuity') return raw;
  if (raw === 'generated_output' || raw === 'output_to_timeline') return raw;
  return 'reference';
}

export function createWorkspaceEdge(params: {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  kind: WorkspaceEdgeKind;
}): WorkspaceGraphEdge {
  const color = WORKSPACE_EDGE_COLORS[params.kind];
  return {
    id: params.id ?? `${params.source}-${params.kind}-${params.target}`,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle ?? params.kind,
    targetHandle: params.targetHandle ?? params.kind,
    type: 'workspace-smart',
    animated: params.kind === 'generated_output' || params.kind === 'output_to_timeline',
    label: edgeLabel(params.kind),
    data: {
      kind: params.kind,
      label: edgeLabel(params.kind),
      color,
    },
    style: {
      stroke: color,
      strokeWidth: 2,
    },
  };
}

export function shotSettings(overrides: Partial<WorkspaceShotSettings>): WorkspaceShotSettings {
  return {
    modelId: DEFAULT_WORKSPACE_TEMPLATE_SHOT_MODEL_ID,
    workflowType: 'image_to_video',
    durationSec: 7,
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 24,
    seed: null,
    audioEnabled: false,
    lipSyncEnabled: false,
    referenceStrength: 0.65,
    outputName: 'Shot',
    status: 'ready',
    ...overrides,
  };
}

