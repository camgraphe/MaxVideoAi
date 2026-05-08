import type { PriceFactorKind } from '@/components/PriceFactorsBar';
import type { EngineCaps, PreflightResponse } from '@/types/engines';

export type QuadTileAction = 'continue' | 'refine' | 'branch' | 'copy' | 'open';
export type QuadGroupAction = 'open' | 'compare' | 'hero';

export interface QuadPreviewTile {
  localKey: string;
  batchId: string;
  id: string;
  jobId?: string;
  iterationIndex: number;
  iterationCount: number;
  videoUrl?: string;
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
