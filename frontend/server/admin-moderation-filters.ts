import { getEngineAliases, listFalEngines } from '@/config/falEngines';
import { TOOL_MODERATION_FILTERS, type ModerationSurface } from '@/lib/admin/moderation-filters';

const IMAGE_ENGINE_ALIASES = listFalEngines()
  .filter((engine) => (engine.category ?? 'video') === 'image')
  .flatMap((engine) => getEngineAliases(engine));

export function buildModerationSurfaceFilterClause(surface: ModerationSurface, params: Array<string | string[]>) {
  const tool = TOOL_MODERATION_FILTERS.find(option => option.id === surface);
  if (tool?.by === 'creator' && surface !== 'subtitles') {
    params.push(surface);
    return `EXISTS (SELECT 1 FROM creator_operations o
      JOIN mcp_generation_quotes q ON q.quote_id=o.id AND q.user_id=o.user_id
      WHERE q.job_id=app_jobs.job_id AND o.user_id=app_jobs.user_id
        AND o.tool_id=$${params.length} AND o.status <> 'failed')`;
  }
  if (tool && tool.by !== 'surface') {
    params.push(surface);
    const match = `COALESCE(settings_snapshot->>'toolId', pricing_snapshot->'meta'->>'toolId') = $${params.length}`;
    // Transcriptions create documents; this queue reviews rendered media.
    return surface === 'subtitles' ? `(${match} AND (settings_snapshot->>'operation' = 'render' OR COALESCE(video_url, '') <> ''))` : match;
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
    ) AND COALESCE(settings_snapshot->>'toolId', pricing_snapshot->'meta'->>'toolId', '') = ''`;
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
        OR COALESCE(settings_snapshot->>'toolId', pricing_snapshot->'meta'->>'toolId', '') <> ''
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

