import { StudioConnectedPersistenceError } from '@/server/studio/montage-command';

export function connectedStudioError(error: unknown, fallback: string): { error: string; status: number } {
  if (error instanceof StudioConnectedPersistenceError) {
    return { error: error.code, status: error.status };
  }
  const message = error instanceof Error ? error.message : fallback;
  if (message === 'STUDIO_CONNECTED_SCHEMA_UNAVAILABLE') return { error: message, status: 503 };
  if (message === 'STUDIO_PROJECT_NOT_FOUND' || message === 'MEDIA_NOT_AVAILABLE') return { error: message, status: 404 };
  if (message === 'STUDIO_CONNECTED_PROJECT_REVISION_REQUIRED' || message === 'STUDIO_CONNECTED_PROJECT_REQUIRED') {
    return { error: message, status: 409 };
  }
  return { error: message, status: 400 };
}
