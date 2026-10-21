import { getEngineAliases, listFalEngines } from '@/config/falEngines';
import { TOOL_MODERATION_FILTERS, type ModerationSurface } from '@/lib/admin/moderation-filters';

const IMAGE_ENGINE_ALIASES = listFalEngines()
  .filter((engine) => (engine.category ?? 'video') === 'image')
  .flatMap((engine) => getEngineAliases(engine));

export function buildModerationSurfaceFilterClause(surface: ModerationSurface, params: Array<string | string[]>) {
  const tool = TOOL_MODERATION_FILTERS.find(option => option.id === surface);
  if (tool?.surface === 'tool') {
    params.push('tool', surface);
    return `(surface = $${params.length - 1} OR settings_snapshot->>'surface' = $${params.length - 1})
      AND settings_snapshot->>'toolId' = $${params.length}`;
  }
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

  if (surface === 'background-removal') {
    return `(surface = $${directIndex} OR job_id LIKE 'tool_background_removal_%' OR settings_snapshot->>'surface' = 'background-removal')`;
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
        AND COALESCE(surface, '') NOT IN ('storyboard', 'character', 'angle', 'upscale', 'background-removal', 'tool')
        AND COALESCE(settings_snapshot->>'surface', '') NOT IN ('storyboard', 'character-builder', 'angle', 'upscale', 'background-removal', 'video', 'tool')
        AND job_id NOT LIKE 'tool_angle_%'
        AND job_id NOT LIKE 'tool_upscale_%'
        AND job_id NOT LIKE 'tool_background_removal_%'
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
        COALESCE(surface, '') IN ('audio', 'storyboard', 'character', 'angle', 'upscale', 'background-removal', 'tool')
        OR COALESCE(settings_snapshot->>'surface', '') IN ('image', 'storyboard', 'character-builder', 'angle', 'audio', 'upscale', 'background-removal', 'tool')
        OR job_id LIKE 'tool_angle_%'
        OR job_id LIKE 'tool_upscale_%'
        OR job_id LIKE 'tool_background_removal_%'
        OR render_ids IS NOT NULL
        OR COALESCE(engine_id, '') = ANY($${imageAliasIndex}::text[])
      )
    )`;
  }

  return `surface = $${directIndex}`;
}

