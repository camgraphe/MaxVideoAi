import { GENERATED_OUTPUT_TARGET_HANDLE } from '../_state/workspace-normalizers';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceNodeKind,
} from './workspace-types';

export function workspaceNodeKindForCanvasFile(file: File): WorkspaceNodeKind | null {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(name)) return 'asset-image';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(name)) return 'asset-video';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(name)) return 'asset-audio';
  if (mime.startsWith('text/') || mime === 'application/json' || /\.(txt|md|json|csv|srt|vtt)$/i.test(name)) return 'text-prompt';
  return null;
}

function workspaceAssetKindForCanvasNodeKind(kind: WorkspaceNodeKind): WorkspaceAssetRecord['kind'] | null {
  if (kind === 'asset-image') return 'image';
  if (kind === 'asset-video') return 'video';
  if (kind === 'asset-audio') return 'audio';
  return null;
}

export function localCanvasImportFallbackName(kind: WorkspaceNodeKind): string {
  if (kind === 'asset-image') return 'local-image';
  if (kind === 'asset-video') return 'local-video';
  if (kind === 'asset-audio') return 'local-audio';
  return 'local-prompt.txt';
}

function formatCanvasImportFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return 'Local import';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function canvasImportAssetSubtitle(file: File, kind: WorkspaceNodeKind): string {
  const label = kind === 'asset-image' ? 'Image' : kind === 'asset-video' ? 'Video' : 'Audio';
  return `${label} · ${formatCanvasImportFileSize(file.size)}`;
}

export function workspaceAssetRecordFromCanvasFile(
  file: File,
  kind: WorkspaceNodeKind,
  objectUrl: string,
  idSeed: string
): WorkspaceAssetRecord | null {
  const assetKind = workspaceAssetKindForCanvasNodeKind(kind);
  if (!assetKind) return null;
  const filename = file.name || localCanvasImportFallbackName(kind);
  return {
    id: `local-${idSeed}-${filename}`,
    kind: assetKind,
    filename,
    subtitle: canvasImportAssetSubtitle(file, kind),
    url: objectUrl,
    thumbUrl: assetKind === 'image' ? objectUrl : undefined,
  };
}

export function createAdHocWorkspaceNode(
  kind: WorkspaceNodeKind,
  index: number,
  modelId: string,
  positionOverride?: { x: number; y: number }
): WorkspaceGraphNode {
  const position = positionOverride ?? { x: -220 + (index % 4) * 180, y: -120 + Math.floor(index / 4) * 140 };
  const id = `${kind}-${Date.now().toString(36)}-${index}`;

  if (kind === 'asset-image') {
    return {
      id,
      type: 'asset-image',
      position,
      data: {
        kind,
        title: 'Image Reference',
        subtitle: 'No image selected',
        accent: '#8b5cf6',
        targetHandles: [],
        sourceHandles: ['reference'],
      },
    };
  }

  if (kind === 'asset-video') {
    return {
      id,
      type: 'asset-video',
      position,
      data: {
        kind,
        title: 'Video Reference',
        subtitle: 'No video selected',
        accent: '#2563eb',
        targetHandles: [],
        sourceHandles: ['video_reference'],
      },
    };
  }

  if (kind === 'asset-audio') {
    return {
      id,
      type: 'asset-audio',
      position,
      data: {
        kind,
        title: 'Audio Reference',
        subtitle: 'No audio selected',
        accent: '#22c55e',
        targetHandles: [],
        sourceHandles: ['audio'],
      },
    };
  }

  if (kind === 'text-prompt') {
    return {
      id,
      type: 'text-prompt',
      position,
      data: {
        kind,
        title: 'Prompt',
        subtitle: 'prompt.txt',
        accent: '#60a5fa',
        promptRole: 'prompt',
        promptText: 'Describe the next shot with subject, motion, lighting, lens, and mood.',
        sourceHandles: ['prompt'],
      },
    };
  }

  return {
    id,
    type: 'shot',
    position,
    data: {
      kind: 'shot',
      title: 'Shot',
      subtitle: 'New generation block',
      accent: '#f97316',
      shot: {
        modelId,
        workflowType: 'image_to_video',
        durationSec: 7,
        aspectRatio: '16:9',
        resolution: '1080p',
        fps: 24,
        seed: null,
        audioEnabled: false,
        lipSyncEnabled: false,
        referenceStrength: 0.65,
        outputName: 'New Shot',
        status: 'draft',
      },
      targetHandles: ['prompt', 'negative_prompt', 'product', 'character', 'style', 'video_reference', 'motion_reference', 'audio', 'voiceover', 'music', 'camera', 'dialogue', 'narration', 'previous_shot'],
      sourceHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
    },
  };
}
