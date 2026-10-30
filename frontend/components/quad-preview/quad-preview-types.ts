import type { GenerationObservation } from '@/lib/generation-observation';
import type { PriceFactorKind } from '@/components/PriceFactorsBar';
import type { EngineCaps, Mode, PreflightResponse } from '@/types/engines';
import type { VideoOperation } from '@/lib/video-operation';

export type QuadTileAction = 'continue' | 'refine' | 'branch' | 'copy' | 'open';
export type QuadGroupAction = 'open' | 'compare' | 'hero';

export interface QuadPreviewTile {
  settingsSnapshot?: unknown;
  generationMode?: Mode | null;
  operation?: VideoOperation;
  curated?: boolean;
  observation?: GenerationObservation;
  startedAt?: number;
  etaSource?: 'observed' | 'heuristic';
  localKey: string;
  batchId: string;
  id: string;
  jobId?: string;
  iterationIndex: number;
  iterationCount: number;
  videoUrl?: string;
  playbackVideoUrl?: string;
  lastFrameUrl?: string;
  previewVideoUrl?: string;
  thumbUrl?: string;
  aspectRatio: string;
  progress: number;
  message: string;
  priceCents?: number;
  currency?: string;
  durationSec: number;
  engineLabel: string;
  engineId: string;
  etaLabel?: string;
  prompt: string;
  status: 'pending' | 'completed' | 'failed';
  hasAudio?: boolean;
}

export interface QuadPreviewPanelProps {
  tiles: QuadPreviewTile[];
  heroKey?: string;
  preflight: PreflightResponse | null;
  iterations: number;
  currency: string;
  totalPriceCents?: number | null;
  onNavigateFactor?: (kind: PriceFactorKind) => void;
  onTileAction: (action: QuadTileAction, tile: QuadPreviewTile) => void;
  onGroupAction: (action: QuadGroupAction, tile?: QuadPreviewTile) => void;
  onSelectHero: (tile: QuadPreviewTile) => void;
  engineMap: Map<string, EngineCaps>;
  onSaveComposite?: () => void;
  onRefreshJob?: (jobId: string) => Promise<void> | void;
}

export type QuadMosaicStatus = {
  status: QuadPreviewTile['status'];
  progress: number;
  message: string;
  etaLabel?: string;
};
