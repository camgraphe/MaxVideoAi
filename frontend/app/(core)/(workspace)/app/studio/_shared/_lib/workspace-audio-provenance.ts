import type {
  WorkspaceAudioProvenance,
  WorkspaceAssetKind,
  WorkspaceOutputMediaKind,
  WorkspaceTimelineItem,
} from './workspace-types';
import {readMediaFacts} from '../../../../../../../lib/media-identity';

type WorkspaceAudioProvenanceSource = {
  kind: WorkspaceOutputMediaKind | WorkspaceAssetKind;
  audioProvenance?: WorkspaceAudioProvenance;
  audioUrl?: string | null;
  hasAudio?: boolean;
  mediaFacts?: unknown;
};

export function resolveWorkspaceAudioProvenance(
  source: WorkspaceAudioProvenanceSource
): WorkspaceAudioProvenance {
  if (source.kind === 'audio') return 'external';
  if (source.kind !== 'video') return 'none';
  const measuredAudio = readMediaFacts(source.mediaFacts)?.hasAudio;
  if (source.audioProvenance !== 'external' && !source.audioUrl && measuredAudio !== undefined) return measuredAudio ? 'embedded' : 'none';
  if (source.audioProvenance) return source.audioProvenance;
  if (source.audioUrl) return 'external';
  if (source.hasAudio === true) return 'embedded';
  if (source.hasAudio === false) return 'none';
  return 'unknown';
}

export type WorkspaceTimelineAudioMixSupport = {source: WorkspaceAudioProvenance;canMute: boolean;canAdjustVolume: boolean;canRestoreOriginalVolume: boolean};

/** Muting or restoring source gain is safe for unknown sound; neither proves sound exists. */
export function workspaceTimelineAudioMixSupport(item: Pick<WorkspaceTimelineItem, 'mediaKind'|'mediaFacts'|'audioProvenance'|'hasEmbeddedAudio'>): WorkspaceTimelineAudioMixSupport {
  if (item.mediaKind === 'audio') return {source: 'external',canMute: true,canAdjustVolume: true,canRestoreOriginalVolume: true};
  if (item.mediaKind !== 'video') return {source: 'none',canMute: false,canAdjustVolume: false,canRestoreOriginalVolume: false};
  if (item.audioProvenance === 'external') return {source: 'external',canMute: false,canAdjustVolume: false,canRestoreOriginalVolume: false};
  const measuredAudio = readMediaFacts(item.mediaFacts)?.hasAudio;
  if (measuredAudio === false) return {source: 'none',canMute: false,canAdjustVolume: false,canRestoreOriginalVolume: false};
  if (measuredAudio === true || item.hasEmbeddedAudio === true || item.audioProvenance === 'embedded') return {source: 'embedded',canMute: true,canAdjustVolume: true,canRestoreOriginalVolume: true};
  // Older insertions cached `none` for missing facts. Neither mute nor restore
  // turns that cache into measured silence or evidence of embedded sound.
  return {source: 'unknown',canMute: true,canAdjustVolume: false,canRestoreOriginalVolume: true};
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
