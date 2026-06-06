import type { XYPosition } from '@xyflow/react';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphNode,
  WorkspaceNodeKind,
  WorkspacePromptRole,
} from './workspace-types';
import { edgeLabel, WORKSPACE_EDGE_COLORS } from './workspace-templates';

export type WorkspaceHandleDropDirection = 'source' | 'target';

export type WorkspaceHandleDropDraft = {
  kind: WorkspaceEdgeKind;
  nodeKind: WorkspaceNodeKind;
  sourceHandle: WorkspaceEdgeKind;
  targetHandle: WorkspaceEdgeKind;
  title: string;
  subtitle: string;
  accent: string;
  promptRole?: WorkspacePromptRole;
};

const TEXT_INPUTS = new Set<WorkspaceEdgeKind>([
  'prompt',
  'negative_prompt',
  'style',
  'camera',
  'dialogue',
  'narration',
]);

const IMAGE_INPUTS = new Set<WorkspaceEdgeKind>([
  'reference',
  'start_image',
  'end_image',
  'product',
  'character',
  'composition',
  'logo',
]);

const VIDEO_INPUTS = new Set<WorkspaceEdgeKind>([
  'video_reference',
  'motion_reference',
  'previous_shot',
  'continuity',
]);

const AUDIO_INPUTS = new Set<WorkspaceEdgeKind>([
  'audio',
  'voiceover',
  'music',
  'sfx',
]);

const TEXT_PROMPT_ROLE_BY_KIND: Partial<Record<WorkspaceEdgeKind, WorkspacePromptRole>> = {
  prompt: 'prompt',
  negative_prompt: 'negative_prompt',
  style: 'style',
  camera: 'camera',
  dialogue: 'dialogue',
  narration: 'narration',
};

function handleAccent(kind: WorkspaceEdgeKind): string {
  return WORKSPACE_EDGE_COLORS[kind] ?? '#8b5cf6';
}

export function resolveWorkspaceHandleDropDraft(
  kind: WorkspaceEdgeKind,
  direction: WorkspaceHandleDropDirection = 'target'
): WorkspaceHandleDropDraft | null {
  const label = edgeLabel(kind);
  const accent = handleAccent(kind);

  if (direction === 'source') {
    if (kind !== 'generated_output') return null;
    return {
      kind,
      nodeKind: 'output',
      sourceHandle: 'video_reference',
      targetHandle: 'generated_output',
      title: 'Generated Output',
      subtitle: 'Reusable output block',
      accent,
    };
  }

  if (TEXT_INPUTS.has(kind)) {
    return {
      kind,
      nodeKind: 'text-prompt',
      sourceHandle: 'prompt',
      targetHandle: kind,
      title: `${label} Prompt`,
      subtitle: 'Text prompt source',
      accent,
      promptRole: TEXT_PROMPT_ROLE_BY_KIND[kind] ?? 'prompt',
    };
  }

  if (IMAGE_INPUTS.has(kind)) {
    return {
      kind,
      nodeKind: 'asset-image',
      sourceHandle: 'reference',
      targetHandle: kind,
      title: `${label} Image`,
      subtitle: 'Image source block',
      accent,
    };
  }

  if (VIDEO_INPUTS.has(kind)) {
    return {
      kind,
      nodeKind: 'asset-video',
      sourceHandle: 'video_reference',
      targetHandle: kind,
      title: `${label} Video`,
      subtitle: 'Video source block',
      accent,
    };
  }

  if (AUDIO_INPUTS.has(kind)) {
    return {
      kind,
      nodeKind: 'asset-audio',
      sourceHandle: 'audio',
      targetHandle: kind,
      title: `${label} Audio`,
      subtitle: 'Audio source block',
      accent,
    };
  }

  return null;
}

export function createWorkspaceHandleDropNode({
  defaultModelId,
  draft,
  index,
  position,
}: {
  defaultModelId: string;
  draft: WorkspaceHandleDropDraft;
  index: number;
  position: XYPosition;
}): WorkspaceGraphNode {
  const id = `handle-${draft.nodeKind}-${Date.now().toString(36)}-${index}`;

  if (draft.nodeKind === 'asset-image') {
    return {
      id,
      type: 'asset-image',
      position,
      data: {
        kind: 'asset-image',
        title: draft.title,
        subtitle: 'No image selected',
        accent: draft.accent,
        targetHandles: [],
        sourceHandles: [draft.sourceHandle],
      },
    };
  }

  if (draft.nodeKind === 'asset-video') {
    return {
      id,
      type: 'asset-video',
      position,
      data: {
        kind: 'asset-video',
        title: draft.title,
        subtitle: 'No video selected',
        accent: draft.accent,
        targetHandles: [],
        sourceHandles: [draft.sourceHandle],
      },
    };
  }

  if (draft.nodeKind === 'asset-audio') {
    return {
      id,
      type: 'asset-audio',
      position,
      data: {
        kind: 'asset-audio',
        title: draft.title,
        subtitle: 'No audio selected',
        accent: draft.accent,
        targetHandles: [],
        sourceHandles: [draft.sourceHandle],
      },
    };
  }

  if (draft.nodeKind === 'text-prompt') {
    return {
      id,
      type: 'text-prompt',
      position,
      data: {
        kind: 'text-prompt',
        title: draft.title,
        subtitle: 'drag_created_prompt.txt',
        accent: draft.accent,
        promptRole: draft.promptRole ?? 'prompt',
        promptText: `Draft ${edgeLabel(draft.kind).toLowerCase()} input...`,
        targetHandles: [],
        sourceHandles: [draft.sourceHandle],
      },
    };
  }

  return {
    id,
    type: 'output',
    position,
    data: {
      kind: 'output',
      title: draft.title,
      subtitle: 'Ready for generated media',
      accent: draft.accent,
      output: {
        kind: 'video',
        modelId: defaultModelId,
        modelLabel: 'Generated output',
        workflowType: 'image_to_video',
        durationSec: 5,
        aspectRatio: '16:9',
        resolution: '1080p',
        status: 'placeholder',
        createdAt: new Date().toISOString(),
        sourceShotId: 'handle-drop',
        thumbUrl: null,
        url: null,
      },
      targetHandles: [draft.targetHandle],
      sourceHandles: [draft.sourceHandle],
    },
  };
}
