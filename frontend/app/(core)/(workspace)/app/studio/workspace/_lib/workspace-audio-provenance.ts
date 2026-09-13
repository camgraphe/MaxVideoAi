import type {
  WorkspaceAudioProvenance,
  WorkspaceAssetKind,
  WorkspaceOutputMediaKind,
} from './workspace-types';

type WorkspaceAudioProvenanceSource = {
  kind: WorkspaceOutputMediaKind | WorkspaceAssetKind;
  audioProvenance?: WorkspaceAudioProvenance;
  audioUrl?: string | null;
  hasAudio?: boolean;
};

export function resolveWorkspaceAudioProvenance(
  source: WorkspaceAudioProvenanceSource
): WorkspaceAudioProvenance {
  if (source.kind === 'audio') return 'external';
  if (source.kind !== 'video') return 'none';
  if (source.audioProvenance) return source.audioProvenance;
  if (source.audioUrl) return 'external';
  if (source.hasAudio === true) return 'embedded';
  if (source.hasAudio === false) return 'none';
  return 'unknown';
}

export function workspaceVideoHasExternalAudio(
  source: WorkspaceAudioProvenanceSource
): boolean {
  return source.kind === 'video' &&
    resolveWorkspaceAudioProvenance(source) === 'external' &&
    Boolean(source.audioUrl);
}

export function shouldMuteWorkspaceTimelineVideo(params: {
  includeAudio: boolean;
  audioProvenance: WorkspaceAudioProvenance;
  hasExternalLinkedAudio: boolean;
  audioMixMuted: boolean;
}): boolean {
  if (!params.includeAudio || params.audioMixMuted || params.hasExternalLinkedAudio) return true;
  return params.audioProvenance === 'none' || params.audioProvenance === 'external';
}
