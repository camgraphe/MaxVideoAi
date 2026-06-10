import type {
  WorkspaceTimelineVideoExportRequest,
  WorkspaceTimelineVideoExportSettings,
} from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export';

function isQualityPreset(value: unknown): value is WorkspaceTimelineVideoExportSettings['qualityPreset'] {
  return value === 'draft' || value === 'standard' || value === 'high';
}

export function parseTimelineExportRequest(value: unknown): WorkspaceTimelineVideoExportRequest {
  const request = value as Partial<WorkspaceTimelineVideoExportRequest> | null;
  if (!request || request.version !== 1 || request.source !== 'maxvideoai-editor') {
    throw new Error('INVALID_EXPORT_REQUEST');
  }
  if (!request.idempotencyKey || typeof request.idempotencyKey !== 'string') {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  }
  if (request.status !== 'ready') {
    throw new Error('EXPORT_MANIFEST_BLOCKED');
  }
  if (!request.manifest || request.manifest.status !== 'ready' || request.manifest.durationSec <= 0) {
    throw new Error('EXPORT_MANIFEST_NOT_READY');
  }
  if (request.exportSettings?.format !== 'mp4-h264') {
    throw new Error('UNSUPPORTED_EXPORT_FORMAT');
  }
  if (!isQualityPreset(request.exportSettings.qualityPreset)) {
    throw new Error('UNSUPPORTED_EXPORT_QUALITY');
  }
  if (request.exportSettings.serverRenderMode !== 'server') {
    throw new Error('SERVER_RENDER_REQUIRED');
  }
  return request as WorkspaceTimelineVideoExportRequest;
}

export function resolveTimelineExportResolution(request: WorkspaceTimelineVideoExportRequest): string | null {
  return request.manifest.projectSettings?.resolution ?? null;
}

export function resolveTimelineExportFps(request: WorkspaceTimelineVideoExportRequest): number | null {
  return request.manifest.projectSettings?.fps ?? null;
}
