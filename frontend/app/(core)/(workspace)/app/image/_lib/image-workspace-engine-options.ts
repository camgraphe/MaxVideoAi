import type { ImageEngineOption } from './image-workspace-types';

export const DEFAULT_IMAGE_WORKSPACE_ENGINE_ID = 'seedream';

const IMAGE_WORKSPACE_ENGINE_PRIORITY = new Map<string, number>([[DEFAULT_IMAGE_WORKSPACE_ENGINE_ID, 0]]);

function getImageWorkspaceEnginePriority(engineId: string): number {
  return IMAGE_WORKSPACE_ENGINE_PRIORITY.get(engineId) ?? IMAGE_WORKSPACE_ENGINE_PRIORITY.size;
}

export function sortImageWorkspaceEngineOptions<T extends Pick<ImageEngineOption, 'id'>>(
  engines: T[]
): T[] {
  return engines
    .map((engine, index) => ({
      engine,
      index,
      priority: getImageWorkspaceEnginePriority(engine.id),
    }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ engine }) => engine);
}
