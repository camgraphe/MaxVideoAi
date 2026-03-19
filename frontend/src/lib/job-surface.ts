import { getEngineAliases, listFalEngines } from '@/config/falEngines';
import { parseStoredImageRenders } from '@/lib/image-renders';
import type { JobSurface, UserAssetSource } from '@/types/billing';

const IMAGE_ENGINE_ALIAS_SET = new Set(
  listFalEngines()
    .filter((engine) => (engine.category ?? 'video') === 'image')
    .flatMap((engine) => getEngineAliases(engine))
);

function readSurfaceFromSnapshot(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const value = (snapshot as Record<string, unknown>).surface;
  return typeof value === 'string' && value.trim().length ? value.trim().toLowerCase() : null;
}

export function normalizeJobSurface(value: unknown): JobSurface | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'video' || normalized === 'image' || normalized === 'character' || normalized === 'angle') {
    return normalized;
  }
  if (normalized === 'character-builder') {
    return 'character';
  }
  return null;
}

export function deriveJobSurface(params: {
  surface?: unknown;
  settingsSnapshot?: unknown;
  jobId?: string | null;
  engineId?: string | null;
  videoUrl?: string | null;
  renderIds?: unknown;
}): JobSurface {
  const direct = normalizeJobSurface(params.surface);
  if (direct && direct !== 'video') return direct;

  const snapshotSurface = normalizeJobSurface(readSurfaceFromSnapshot(params.settingsSnapshot));
  if (snapshotSurface && snapshotSurface !== 'video') return snapshotSurface;

  const jobId = typeof params.jobId === 'string' ? params.jobId.trim() : '';
  if (jobId.startsWith('tool_angle_') || jobId.startsWith('angle_')) {
    return 'angle';
  }

  const parsedRenders = parseStoredImageRenders(params.renderIds);
  if (parsedRenders.entries.length > 0) {
    return 'image';
  }

  const engineId = typeof params.engineId === 'string' ? params.engineId.trim() : '';
  if (engineId && IMAGE_ENGINE_ALIAS_SET.has(engineId)) {
    return 'image';
  }

  if (snapshotSurface === 'video') {
    return 'video';
  }
  if (direct === 'video') {
    return 'video';
  }
  if (typeof params.videoUrl === 'string' && params.videoUrl.trim().length) {
    return 'video';
  }

  return 'video';
}

export function isImageLikeSurface(surface: JobSurface): boolean {
  return surface === 'image' || surface === 'character' || surface === 'angle';
}

export function normalizeUserAssetSource(value: unknown): UserAssetSource {
  if (typeof value !== 'string') return 'generated';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'upload' || normalized === 'generated' || normalized === 'character' || normalized === 'angle') {
    return normalized;
  }
  return 'generated';
}
