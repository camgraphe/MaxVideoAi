import { launchMediaWorkerTask, assertTimelineExportWorkerLauncherConfigured } from '@/server/timeline-exports/ecs-runner';

export const assertSubtitleOperationWorkerLauncherConfigured = assertTimelineExportWorkerLauncherConfigured;

export function launchSubtitleOperationWorkerTask(params: { operationId: string; env?: NodeJS.ProcessEnv }) {
  return launchMediaWorkerTask({ target: { kind: 'subtitles', id: params.operationId }, env: params.env });
}
