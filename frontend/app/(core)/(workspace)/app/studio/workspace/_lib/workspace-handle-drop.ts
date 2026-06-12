import type { XYPosition } from '@xyflow/react';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphNode,
  WorkspaceGeneratedCopyReference,
  WorkspaceNodeGeneratedCopy,
  WorkspaceNodeKind,
  WorkspacePromptRole,
} from './workspace-types';
import { generatedCopyReference } from './workspace-generated-copy';
import { WORKSPACE_EDGE_COLORS } from './workspace-templates';
import { DEFAULT_STUDIO_COPY, localizeStudioEdgeKindLabel, type StudioCopy } from '../../_lib/studio-copy';

export type WorkspaceHandleDropDirection = 'source' | 'target';

export type WorkspaceHandleDropDraft = {
  kind: WorkspaceEdgeKind;
  nodeKind: WorkspaceNodeKind;
  sourceHandle: WorkspaceEdgeKind;
  targetHandle: WorkspaceEdgeKind;
  label: string;
  title: string;
  titleGeneratedCopy?: WorkspaceGeneratedCopyReference;
  promptTextGeneratedCopy?: WorkspaceGeneratedCopyReference;
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

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function canvasNodeCopyValue(
  copy: StudioCopy['canvas']['nodes'],
  key: string,
  fallback: string,
  replacements?: Record<string, string | number>
): string {
  const value = copy[key] ?? fallback;
  return replacements ? formatCopyValue(value, replacements) : value;
}

function generatedTitleCopy(draft: WorkspaceHandleDropDraft): WorkspaceNodeGeneratedCopy | undefined {
  return draft.titleGeneratedCopy ? { title: draft.titleGeneratedCopy } : undefined;
}

export function resolveWorkspaceHandleDropDraft(
  kind: WorkspaceEdgeKind,
  noticesOrDirection: StudioCopy['notices'] | WorkspaceHandleDropDirection = DEFAULT_STUDIO_COPY.notices,
  nextDirection: WorkspaceHandleDropDirection = 'target',
  canvasNodeCopy: StudioCopy['canvas']['nodes'] = DEFAULT_STUDIO_COPY.canvas.nodes
): WorkspaceHandleDropDraft | null {
  const notices = typeof noticesOrDirection === 'string' ? DEFAULT_STUDIO_COPY.notices : noticesOrDirection;
  const direction = typeof noticesOrDirection === 'string' ? noticesOrDirection : nextDirection;
  const label = localizeStudioEdgeKindLabel(kind, canvasNodeCopy);
  const accent = handleAccent(kind);

  if (direction === 'source') {
    if (kind !== 'generated_output') return null;
    return {
      kind,
      nodeKind: 'output',
      sourceHandle: 'video_reference',
      targetHandle: 'generated_output',
      label,
      title: canvasNodeCopyValue(canvasNodeCopy, 'handleGeneratedOutputTitle', notices.generatedOutputTitle),
      titleGeneratedCopy: generatedCopyReference('handleGeneratedOutputTitle'),
      subtitle: notices.generatedOutputBlockSubtitle,
      accent,
    };
  }

  if (TEXT_INPUTS.has(kind)) {
    return {
      kind,
      nodeKind: 'text-prompt',
      sourceHandle: 'prompt',
      targetHandle: kind,
      label,
      title: canvasNodeCopyValue(canvasNodeCopy, 'handlePromptNodeTitle', notices.promptNodeTitle, { label }),
      titleGeneratedCopy: generatedCopyReference('handlePromptNodeTitle', undefined, { label: kind }),
      promptTextGeneratedCopy: generatedCopyReference('handleDraftPromptText', undefined, undefined, { label: kind }),
      subtitle: notices.textPromptSourceSubtitle,
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
      label,
      title: canvasNodeCopyValue(canvasNodeCopy, 'handleImageNodeTitle', notices.imageNodeTitle, { label }),
      titleGeneratedCopy: generatedCopyReference('handleImageNodeTitle', undefined, { label: kind }),
      subtitle: notices.imageSourceBlockSubtitle,
      accent,
    };
  }

  if (VIDEO_INPUTS.has(kind)) {
    return {
      kind,
      nodeKind: 'asset-video',
      sourceHandle: 'video_reference',
      targetHandle: kind,
      label,
      title: canvasNodeCopyValue(canvasNodeCopy, 'handleVideoNodeTitle', notices.videoNodeTitle, { label }),
      titleGeneratedCopy: generatedCopyReference('handleVideoNodeTitle', undefined, { label: kind }),
      subtitle: notices.videoSourceBlockSubtitle,
      accent,
    };
  }

  if (AUDIO_INPUTS.has(kind)) {
    return {
      kind,
      nodeKind: 'asset-audio',
      sourceHandle: 'audio',
      targetHandle: kind,
      label,
      title: canvasNodeCopyValue(canvasNodeCopy, 'handleAudioNodeTitle', notices.audioNodeTitle, { label }),
      titleGeneratedCopy: generatedCopyReference('handleAudioNodeTitle', undefined, { label: kind }),
      subtitle: notices.audioSourceBlockSubtitle,
      accent,
    };
  }

  return null;
}

export function createWorkspaceHandleDropNode({
  defaultModelId,
  draft,
  index,
  notices = DEFAULT_STUDIO_COPY.notices,
  position,
}: {
  defaultModelId: string;
  draft: WorkspaceHandleDropDraft;
  index: number;
  notices?: StudioCopy['notices'];
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
        subtitle: notices.noImageSelected,
        accent: draft.accent,
        generatedCopy: generatedTitleCopy(draft),
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
        subtitle: notices.noVideoSelected,
        accent: draft.accent,
        generatedCopy: generatedTitleCopy(draft),
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
        subtitle: notices.noAudioSelected,
        accent: draft.accent,
        generatedCopy: generatedTitleCopy(draft),
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
        subtitle: notices.dragCreatedPromptSubtitle,
        accent: draft.accent,
        promptRole: draft.promptRole ?? 'prompt',
        promptText: formatCopyValue(notices.draftHandlePromptText, { label: draft.label.toLocaleLowerCase() }),
        generatedCopy: {
          ...(draft.titleGeneratedCopy ? { title: draft.titleGeneratedCopy } : {}),
          ...(draft.promptTextGeneratedCopy ? { promptText: draft.promptTextGeneratedCopy } : {}),
        },
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
      subtitle: notices.readyForGeneratedMedia,
      accent: draft.accent,
      generatedCopy: generatedTitleCopy(draft),
      output: {
        kind: 'video',
        modelId: defaultModelId,
        modelLabel: notices.generatedOutputSubtitle,
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
