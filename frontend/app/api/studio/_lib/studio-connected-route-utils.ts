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
  if (message.startsWith('Invalid Studio workspace') || message === 'Invalid Studio montage input.'
    || message === 'Invalid Studio media access input.') {
    return { error: message, status: 400 };
  }
  return { error: fallback, status: 500 };
}
