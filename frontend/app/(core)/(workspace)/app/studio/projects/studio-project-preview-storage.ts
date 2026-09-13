const STUDIO_PROJECT_CANVAS_PREVIEW_STORAGE_KEY = 'maxvideoai.editor.canvasPreview.v1';
const MAX_STUDIO_PROJECT_CANVAS_PREVIEW_LENGTH = 900_000;

export function studioProjectCanvasPreviewStorageKey(projectId: string): string {
  return `${STUDIO_PROJECT_CANVAS_PREVIEW_STORAGE_KEY}.${projectId}`;
}

function isStudioProjectCanvasPreview(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= MAX_STUDIO_PROJECT_CANVAS_PREVIEW_LENGTH
    && /^data:image\/(?:jpeg|webp);base64,/.test(value);
}

export function readStudioProjectCanvasPreview(projectId: string): string | null {
  if (!projectId || typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(studioProjectCanvasPreviewStorageKey(projectId));
    return isStudioProjectCanvasPreview(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStudioProjectCanvasPreview(projectId: string, previewUrl: string): boolean {
  if (!projectId || typeof window === 'undefined' || !isStudioProjectCanvasPreview(previewUrl)) return false;
  try {
    window.localStorage.setItem(studioProjectCanvasPreviewStorageKey(projectId), previewUrl);
    return true;
  } catch {
    return false;
  }
}
