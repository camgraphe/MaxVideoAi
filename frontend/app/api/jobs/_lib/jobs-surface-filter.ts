import { getEngineAliases, listFalEngines } from '@/config/falEngines';
import type { JobsRouteParam, JobsRouteSurface } from './jobs-route-types';

export const IMAGE_ENGINE_ALIASES = listFalEngines()
  .filter((engine) => (engine.category ?? 'video') === 'image')
  .flatMap((engine) => getEngineAliases(engine));

export function buildSurfaceFilterClause(surface: JobsRouteSurface, params: JobsRouteParam[]) {
  params.push(surface);
  const directIndex = params.length;

  if (surface === 'character') {
    return `(surface = $${directIndex} OR settings_snapshot->>'surface' = 'character-builder')`;
  }

  if (surface === 'angle') {
    return `(surface = $${directIndex} OR job_id LIKE 'tool_angle_%' OR settings_snapshot->>'surface' = 'angle')`;
  }

  if (surface === 'upscale') {
    return `(surface = $${directIndex} OR job_id LIKE 'tool_upscale_%' OR settings_snapshot->>'surface' = 'upscale')`;
  }

  if (surface === 'image') {
    params.push(IMAGE_ENGINE_ALIASES);
    const imageAliasIndex = params.length;
    return `(
      surface = $${directIndex}
      OR (
        (
          settings_snapshot->>'surface' = 'image'
          OR render_ids IS NOT NULL
          OR COALESCE(engine_id, '') = ANY($${imageAliasIndex}::text[])
        )
        AND COALESCE(surface, '') NOT IN ('storyboard', 'character', 'angle', 'upscale')
        AND COALESCE(settings_snapshot->>'surface', '') NOT IN ('storyboard', 'character-builder', 'angle', 'upscale', 'video')
        AND job_id NOT LIKE 'tool_angle_%'
        AND job_id NOT LIKE 'tool_upscale_%'
        AND job_id NOT LIKE 'storyboard_%'
      )
    )`;
  }

  if (surface === 'video') {
    params.push(IMAGE_ENGINE_ALIASES);
    const imageAliasIndex = params.length;
    return `(
      (
        surface = $${directIndex}
        OR COALESCE(video_url, '') <> ''
        OR settings_snapshot->>'surface' = 'video'
      )
      AND NOT (
        COALESCE(surface, '') = 'audio'
        OR settings_snapshot->>'surface' IN ('image', 'storyboard', 'character-builder', 'angle', 'audio', 'upscale')
        OR job_id LIKE 'tool_angle_%'
        OR job_id LIKE 'tool_upscale_%'
        OR job_id LIKE 'storyboard_%'
        OR render_ids IS NOT NULL
        OR COALESCE(engine_id, '') = ANY($${imageAliasIndex}::text[])
      )
    )`;
  }

  return `surface = $${directIndex}`;
}
