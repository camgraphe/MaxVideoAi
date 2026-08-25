import type { CanonicalReferenceMediaKind } from './generation-types';

export type AgentMediaKind = CanonicalReferenceMediaKind;

export type AgentMediaItem = {
  assetId: string;
  kind: AgentMediaKind;
  label: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  mimeType: string;
  previewUrl: string | null;
  source: 'upload' | 'generated' | 'imported';
  createdAt: string;
};
