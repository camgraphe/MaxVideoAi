import type {
  WorkspaceTimelineRenderClip,
  WorkspaceTimelineRenderManifest,
} from './workspace-timeline-render';
import type { WorkspaceAssetRecord } from './workspace-types';
import { isWorkspaceTimelineAudioTrack } from './workspace-timeline-tracks';
import { formatWorkspaceTimecode } from './workspace-timecode';
import { DEFAULT_STUDIO_COPY, type StudioCopy } from '../../_lib/studio-copy';

export type {
  WorkspaceTimelineExportRangeMode,
  WorkspaceTimelineRenderManifest,
} from './workspace-timeline-render';

export type WorkspaceTimelineExportQualityPreset = 'draft' | 'standard' | 'high';
export type WorkspaceTimelineVideoExportFormat = 'mp4-h264';

export type WorkspaceTimelineExportQualityPresetOption = {
  id: WorkspaceTimelineExportQualityPreset;
  label: string;
  description: string;
};

export type WorkspaceTimelineVideoExportSettings = {
  format: WorkspaceTimelineVideoExportFormat;
  qualityPreset: WorkspaceTimelineExportQualityPreset;
  includeAudio: boolean;
  serverRenderMode: 'server';
};

export type WorkspaceTimelineVideoExportRequest = {
  version: 1;
  source: 'maxvideoai-editor';
  idempotencyKey: string;
  createdAt: string;
  status: WorkspaceTimelineRenderManifest['status'];
  manifest: WorkspaceTimelineRenderManifest;
  exportSettings: WorkspaceTimelineVideoExportSettings;
};

type CompletedTimelineExportJob = {
  id: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed' | 'canceled';
  outputUrl: string | null;
};

export type WorkspaceTimelineExportReadinessCheck = {
  id: 'media' | 'timeline' | 'range' | 'audio';
  label: string;
  status: 'pass' | 'warning' | 'blocking';
  message: string;
};

export const WORKSPACE_TIMELINE_EXPORT_QUALITY_PRESETS = [
  {
    id: 'draft',
    label: 'Draft',
    description: 'Fast review export with lighter compression.',
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'Balanced MP4 for normal delivery.',
  },
  {
    id: 'high',
    label: 'High',
    description: 'Higher bitrate master for final review.',
  },
] as const satisfies readonly WorkspaceTimelineExportQualityPresetOption[];

function exportCopy(copy: StudioCopy['exportDialog'] | undefined, key: string, fallback: string): string {
  return copy?.[key] ?? fallback;
}

function formatExportCopy(
  copy: StudioCopy['exportDialog'] | undefined,
  key: string,
  fallback: string,
  replacements: Record<string, string | number>
): string {
  return Object.entries(replacements).reduce(
    (current, [replacementKey, replacement]) => current.replaceAll(`{${replacementKey}}`, String(replacement)),
    exportCopy(copy, key, fallback)
  );
}

export function workspaceTimelineExportQualityPresetOptions(
  copy?: StudioCopy['exportDialog']
): WorkspaceTimelineExportQualityPresetOption[] {
  return [
    {
      id: 'draft',
      label: exportCopy(copy, 'draftPreset', 'Draft'),
      description: exportCopy(copy, 'draftPresetDescription', 'Fast review export with lighter compression.'),
    },
    {
      id: 'standard',
      label: exportCopy(copy, 'standardPreset', 'Standard'),
      description: exportCopy(copy, 'standardPresetDescription', 'Balanced MP4 for normal delivery.'),
    },
    {
      id: 'high',
      label: exportCopy(copy, 'highPreset', 'High'),
      description: exportCopy(copy, 'highPresetDescription', 'Higher bitrate master for final review.'),
    },
  ];
}

function createExportIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `export_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeExportFilenamePrefix(value: string): string {
  const slug = value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return slug || 'maxvideoai-export';
}

export function workspaceTimelineExportReadinessChecks(
  manifest: WorkspaceTimelineRenderManifest,
  copy?: StudioCopy['exportDialog']
): WorkspaceTimelineExportReadinessCheck[] {
  const blockingIssueCodes = new Set(
    manifest.issues.filter((issue) => issue.severity === 'blocking').map((issue) => issue.code)
  );
  const warningIssueCodes = new Set(
    manifest.issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.code)
  );
  const clipCount = manifest.tracks.reduce((count, track) => count + track.clips.length, 0);
  const audioClipCount = manifest.tracks
    .filter((track) => isWorkspaceTimelineAudioTrack(track.id))
    .reduce((count, track) => count + track.clips.length, 0);

  return [
    {
      id: 'media',
      label: exportCopy(copy, 'readinessMedia', 'Media'),
      status: blockingIssueCodes.has('missing_media') || blockingIssueCodes.has('processing_media') ? 'blocking' : 'pass',
      message: blockingIssueCodes.has('missing_media') || blockingIssueCodes.has('processing_media')
        ? exportCopy(copy, 'readinessMediaBlocked', 'Some clips are missing media or still processing.')
        : formatExportCopy(
          copy,
          clipCount === 1 ? 'readinessMediaReadySingular' : 'readinessMediaReadyPlural',
          `${clipCount} clip${clipCount === 1 ? '' : 's'} ready for export.`,
          { count: clipCount }
        ),
    },
    {
      id: 'timeline',
      label: exportCopy(copy, 'readinessTimeline', 'Timeline'),
      status: blockingIssueCodes.has('overlapping_clips')
        ? 'blocking'
        : warningIssueCodes.has('orphan_linked_audio') || warningIssueCodes.has('invalid_transition')
          ? 'warning'
          : 'pass',
      message: blockingIssueCodes.has('overlapping_clips')
        ? exportCopy(copy, 'readinessTimelineBlocked', 'Fix overlapping clips before export.')
        : warningIssueCodes.has('orphan_linked_audio') || warningIssueCodes.has('invalid_transition')
          ? exportCopy(copy, 'readinessTimelineWarnings', 'Timeline has warnings, but export can be prepared.')
          : exportCopy(copy, 'readinessTimelineReady', 'No blocking timeline conflicts.'),
    },
    {
      id: 'range',
      label: exportCopy(copy, 'readinessRange', 'Range'),
      status: manifest.durationSec > 0 ? 'pass' : 'blocking',
      message: manifest.durationSec > 0
        ? exportCopy(
          copy,
          manifest.exportRange.mode === 'in-out' ? 'readinessRangeInOut' : 'readinessRangeFullSequence',
          `${manifest.exportRange.mode === 'in-out' ? 'In/Out' : 'Full sequence'} range is exportable.`
        )
        : exportCopy(copy, 'readinessRangeBlocked', 'Select a range with duration before export.'),
    },
    {
      id: 'audio',
      label: exportCopy(copy, 'readinessAudio', 'Audio'),
      status: 'pass',
      message: audioClipCount > 0
        ? formatExportCopy(
          copy,
          audioClipCount === 1 ? 'readinessAudioIncludedSingular' : 'readinessAudioIncludedPlural',
          `${audioClipCount} audio clip${audioClipCount === 1 ? '' : 's'} included.`,
          { count: audioClipCount }
        )
        : exportCopy(copy, 'readinessAudioEmbedded', 'No separate audio clips; embedded clip audio is preserved when available.'),
    },
  ];
}

export function buildWorkspaceTimelineVideoExportRequest(
  manifest: WorkspaceTimelineRenderManifest,
  options?: {
    qualityPreset?: WorkspaceTimelineExportQualityPreset;
    includeAudio?: boolean;
    createdAt?: string;
    idempotencyKey?: string;
  }
): WorkspaceTimelineVideoExportRequest {
  return {
    version: 1,
    source: 'maxvideoai-editor',
    idempotencyKey: options?.idempotencyKey ?? createExportIdempotencyKey(),
    createdAt: options?.createdAt ?? new Date().toISOString(),
    status: manifest.status,
    manifest,
    exportSettings: {
      format: 'mp4-h264',
      qualityPreset: options?.qualityPreset ?? 'standard',
      includeAudio: options?.includeAudio ?? true,
      serverRenderMode: 'server',
    },
  };
}

export function serializeWorkspaceTimelineVideoExportRequest(request: WorkspaceTimelineVideoExportRequest): string {
  return JSON.stringify(request, null, 2);
}

export function workspaceProjectAssetFromCompletedTimelineExport(
  job: CompletedTimelineExportJob,
  manifest: WorkspaceTimelineRenderManifest,
  serverExportLabel: string = DEFAULT_STUDIO_COPY.notices.completedServerExportSubtitle
): WorkspaceAssetRecord | null {
  if (job.status !== 'completed' || !job.outputUrl) return null;

  const rangeLabel = manifest.exportRange.mode === 'in-out' ? 'in-out' : 'sequence';
  const filename = `${safeExportFilenamePrefix(`${manifest.projectName}-${rangeLabel}-export`)}.mp4`;
  const projectSettings = manifest.projectSettings;

  return {
    id: `timeline-export-${job.id}`,
    kind: 'video',
    filename,
    subtitle: [
      serverExportLabel,
      projectSettings?.resolution,
      projectSettings?.aspectRatio,
      projectSettings?.fps ? `${projectSettings.fps} fps` : null,
    ].filter(Boolean).join(' • '),
    url: job.outputUrl,
    durationSec: manifest.exportRange.durationSec,
    dimensions: projectSettings?.resolution,
  };
}

function edlClipSort(left: WorkspaceTimelineRenderClip, right: WorkspaceTimelineRenderClip): number {
  return left.startSec - right.startSec || left.track.localeCompare(right.track) || left.id.localeCompare(right.id);
}

export function buildWorkspaceTimelineEdl(manifest: WorkspaceTimelineRenderManifest): string {
  const fps = manifest.projectSettings?.fps ?? 24;
  const clips = manifest.tracks
    .flatMap((track) => track.clips)
    .filter((clip) => clip.mediaKind !== 'audio')
    .sort(edlClipSort);
  const lines = [
    `TITLE: ${manifest.projectName}`,
    'FCM: NON-DROP FRAME',
    `* EXPORT RANGE: ${manifest.exportRange.mode.toUpperCase()} ${formatWorkspaceTimecode(manifest.exportRange.startSec, fps)} - ${formatWorkspaceTimecode(manifest.exportRange.endSec, fps)}`,
    '',
  ];

  clips.forEach((clip, index) => {
    const eventNumber = String(index + 1).padStart(3, '0');
    lines.push(
      `${eventNumber}  TIMELINE V     C        ${formatWorkspaceTimecode(clip.sourceStartSec, fps)} ${formatWorkspaceTimecode(clip.sourceEndSec, fps)} ${formatWorkspaceTimecode(clip.startSec, fps)} ${formatWorkspaceTimecode(clip.endSec, fps)}`,
      `* FROM CLIP: ${clip.title}`,
      `* SOURCE FILE: ${clip.mediaUrl}`,
      ''
    );
  });

  return `${lines.join('\n').trimEnd()}\n`;
}

export function workspaceTimelineRenderReadinessLabel(
  manifest: WorkspaceTimelineRenderManifest,
  copy?: StudioCopy['exportDialog']
): string {
  const clipCount = manifest.tracks.reduce((count, track) => count + track.clips.length, 0);
  if (manifest.status === 'blocked') {
    const blockingCount = manifest.issues.filter((issue) => issue.severity === 'blocking').length;
    return formatExportCopy(
      copy,
      blockingCount === 1 ? 'renderBlockedSingular' : 'renderBlockedPlural',
      `Render blocked: ${blockingCount} issue${blockingCount > 1 ? 's' : ''} to fix.`,
      { count: blockingCount }
    );
  }
  return formatExportCopy(
    copy,
    clipCount === 1 ? 'renderReadySingular' : 'renderReadyPlural',
    `Render manifest ready: ${clipCount} clip${clipCount > 1 ? 's' : ''}, ${Math.round(manifest.durationSec)}s.`,
    {
      count: clipCount,
      duration: Math.round(manifest.durationSec),
    }
  );
}
