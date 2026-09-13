import type { JobSurface } from '@/types/billing';
import type { GenerationObservation } from '@/lib/generation-observation';

export interface MediaLightboxEntry {
  id: string;
  label: string;
  videoUrl?: string | null;
  previewUrl?: string | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  aspectRatio?: string | null;
  jobId?: string | null;
  surface?: JobSurface | null;
  status?: 'pending' | 'completed' | 'failed';
  progress?: number | null;
  observation?: GenerationObservation;
  startedAt?: number;
  etaSeconds?: number | null;
  etaSource?: 'observed' | 'heuristic';
  message?: string | null;
  engineLabel?: string | null;
  engineId?: string | null;
  durationSec?: number | null;
  createdAt?: string | null;
  indexable?: boolean;
  visibility?: 'public' | 'private';
  hasAudio?: boolean;
  mediaType?: 'image' | 'video' | 'audio';
  prompt?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  curated?: boolean;
}

export interface MediaLightboxProps {
  title: string;
  subtitle?: string;
  prompt?: string | null;
  metadata?: Array<{ label: string; value: string }>;
  entries: MediaLightboxEntry[];
  onClose: () => void;
  onRefreshEntry?: (entry: MediaLightboxEntry) => Promise<void> | void;
  onSaveToLibrary?: (entry: MediaLightboxEntry) => Promise<void>;
  onRemixEntry?: (entry: MediaLightboxEntry) => void;
  remixLabel?: string;
  onUseTemplate?: (entry: MediaLightboxEntry) => void;
  templateLabel?: string;
}

export type MediaLightboxLoadingState = {
  loading: boolean;
  error: string | null;
};

export type MediaLightboxLibraryState = {
  loading: boolean;
  success: boolean;
  error: string | null;
};
