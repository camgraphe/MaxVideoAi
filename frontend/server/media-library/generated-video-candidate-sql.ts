import { ECMASCRIPT_TRIM_CHARACTERS_SQL } from '@/server/generations/recent-generations';
/** SQL projection of deriveJobSurface, so eligibility precedes cursor/LIMIT.
 * The picker PostgreSQL parity cases lock this to the existing historical proof. */
export function generatedVideoJobSurfaceSql(): string {
    const trim = (value: string) => `BTRIM(COALESCE(${value},''),${ECMASCRIPT_TRIM_CHARACTERS_SQL})`;
    const direct = `LOWER(${trim('j.surface')})`;
    const snapshot = `LOWER(${trim("j.settings_snapshot->>'surface'")})`;
    const nonVideo = "('image','storyboard','character','character-builder','angle','audio','upscale','background-removal','tool')";
    const jobId = trim('j.job_id');
    const renders = `(CASE WHEN jsonb_typeof(j.render_ids)='string' THEN
    CASE WHEN pg_input_is_valid(j.render_ids #>> '{}','jsonb') THEN (j.render_ids #>> '{}')::jsonb ELSE 'null'::jsonb END
    ELSE j.render_ids END)`;
    return `(CASE
    WHEN ${direct} IN ${nonVideo} THEN ${direct}
    WHEN ${snapshot} IN ${nonVideo} THEN ${snapshot}
    WHEN starts_with(${jobId}, 'tool_angle_') OR starts_with(${jobId}, 'angle_') THEN 'angle'
    WHEN starts_with(${jobId}, 'tool_upscale_') OR starts_with(${jobId}, 'upscale_') THEN 'upscale'
    WHEN starts_with(${jobId}, 'tool_background_removal_') OR starts_with(${jobId}, 'background_removal_') THEN 'background-removal'
    WHEN starts_with(${jobId}, 'storyboard_') THEN 'storyboard'
    WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${renders})='array' THEN ${renders} ELSE '[]'::jsonb END) AS entry(value)
      WHERE (jsonb_typeof(value)='string' AND ${trim("value #>> '{}'")}<>'')
        OR (jsonb_typeof(value->'url')='string' AND ${trim("value->>'url'")}<>'')) THEN 'image'
    WHEN ${trim('j.engine_id')}=ANY($2::text[]) THEN 'image'
    ELSE 'video' END)`;
}
