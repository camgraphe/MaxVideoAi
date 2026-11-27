import { ADMIN_EXCLUDED_USER_IDS } from '@/lib/admin/exclusions';
import { query, type QueryExecutor } from '@/lib/db';
import { KLING_DIRECT_ONLY_FAL_EXTRA_KEYS } from '@/lib/kling-direct-extra-values';
import { WAN_REVIEWED_EXTRA_KEYS } from '@/server/video-providers/apimart/wan-image-mode';
import type { HistoricalReplayGroup } from './historical-replay-types';

// All fragments below are built from code-owned identifiers. Dates and account exclusions are bound.
const arrayOfKeys = (keys: readonly string[]) => 'ARRAY[' + keys.map(key => "'" + key + "'").join(',') + ']::text[]';
const jsonArray = (expression: string) => `CASE WHEN jsonb_typeof(${expression}) = 'array' THEN ${expression} ELSE '[]'::jsonb END`;
const nonnegativeInt = (expression: string) => `CASE WHEN jsonb_typeof(${expression}) = 'number' AND (${expression})::text ~ '^[0-9]{1,9}$' THEN (${expression})::text::int END`;
const seconds = (expression: string) => `CASE WHEN jsonb_typeof(${expression}) = 'number' AND (${expression})::text ~ '^[0-9]{1,6}([.][0-9]{1,9})?$' THEN (${expression})::text::numeric END`;
const bool = (expression: string) => `CASE WHEN jsonb_typeof(${expression}) = 'boolean' THEN (${expression})::text::boolean END`;
const directKeys = arrayOfKeys([...KLING_DIRECT_ONLY_FAL_EXTRA_KEYS]);
const wanExtras = arrayOfKeys(WAN_REVIEWED_EXTRA_KEYS);
const supported = "('wan-3','wan-3-prime','kling-3-pro','kling-o3-pro','seedance-2-5','minimax-h3','minimax-h3-max')";

// Private media values exist only inside aggregates to deduplicate duplicated attachment projections.
// No raw settings, URLs, prompt text, job/account IDs, or provider task IDs enter the grouped result.
export const HISTORICAL_REPLAY_QUERY = `WITH population AS (
  SELECT date_trunc('hour', j.created_at AT TIME ZONE 'UTC') AS bucket,
    CASE WHEN j.engine_id ~ '^[a-zA-Z0-9_.-]{1,100}$' THEN j.engine_id ELSE 'unknown' END AS engine,
    CASE WHEN j.status ~ '^[a-z_]{1,40}$' THEN j.status ELSE 'unknown' END AS status,
    COALESCE(j.payment_status = 'paid_wallet', false) AS paid,
    CASE WHEN j.payment_status = 'included_mcp_trial' THEN 'MCP trial' END AS source,
    CASE WHEN j.provider ~ '^[a-z0-9_]{1,48}$' AND NULLIF(BTRIM(j.provider_job_id),'') IS NOT NULL
      AND (accepted.n = 0 OR (accepted.n = 1 AND accepted.provider = j.provider
        AND (accepted.remote_id IS NULL OR accepted.remote_id = j.provider_job_id))) THEN j.provider
      WHEN NULLIF(BTRIM(j.provider_job_id),'') IS NULL AND accepted.n = 1 THEN accepted.provider END AS owner,
    j.settings_snapshot AS s, j.pricing_snapshot AS p, j.cost_breakdown_usd AS cost,
    j.duration_sec AS duration, first.request_snapshot AS a, first.provider AS adapter, fal_request.ratio AS queued_ratio
  FROM app_jobs j
  LEFT JOIN provider_attempts first ON first.job_id=j.id AND first.attempt_index=1
    AND first.provider IN ('alibaba_model_studio','apimart','kling_direct')
  -- The completion webhook can replace core.aspectRatio with the delivered raster ratio.
  -- Use only a queue receipt for this exact provider task, rejecting conflicting values.
  LEFT JOIN LATERAL (
    SELECT CASE WHEN count(DISTINCT q.payload#>>'{request,aspectRatio}')=1 THEN min(q.payload#>>'{request,aspectRatio}') END AS ratio
    FROM fal_queue_log q WHERE j.provider='fal' AND q.job_id=j.job_id AND q.engine_id=j.engine_id AND q.provider=j.provider
      AND q.provider_job_id=j.provider_job_id AND q.payload#>>'{request,aspectRatio}' IS NOT NULL
  ) fal_request ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS n, min(t.provider) AS provider, min(NULLIF(BTRIM(t.provider_job_id),'')) AS remote_id
    FROM provider_attempts t WHERE t.job_id=j.id AND
      (t.status IN ('accepted','completed') OR t.accepted_at IS NOT NULL OR NULLIF(BTRIM(t.provider_job_id),'') IS NOT NULL)
  ) accepted ON true
  WHERE j.surface='video' AND j.user_id <> ALL($3::text[])
    AND j.created_at >= ($1::date::timestamp AT TIME ZONE 'Europe/Madrid')
    AND j.created_at < ($2::date::timestamp AT TIME ZONE 'Europe/Madrid')
), snapshots AS (
  SELECT *, s->'refs' AS r, s->'advanced' AS adv, s#>'{advanced,extraInputValues}' AS extras,
    s->'core' AS core, engine IN ('minimax-h3','minimax-h3-max') AS h3,
    engine IN ('wan-3','wan-3-prime') AS wan,
    engine IN ('kling-3-pro','kling-o3-pro') AS kling,
    CASE WHEN a->>'mode' = s->>'inputMode' OR s->>'inputMode' IS NULL THEN a->>'mode'
      WHEN a->>'mode' IS NULL THEN s->>'inputMode' END AS raw_mode,
    COALESCE(a->>'resolution', s#>>'{core,resolution}') AS raw_resolution,
    COALESCE(a->>'aspectRatio',queued_ratio,CASE WHEN owner='byteplus_modelark' OR status IN ('pending','queued')
      THEN s#>>'{core,aspectRatio}' END) AS raw_ratio,
    s#>>'{core,aspectRatio}' AS observed_ratio,
    COALESCE(${nonnegativeInt("a->'durationSec'")}, duration) AS sec,
    CASE WHEN upper(p->>'currency')='USD' THEN ${nonnegativeInt("p->'totalCents'")}::bigint * 10000 END AS ceiling
  FROM population
), evidence AS MATERIALIZED (
  SELECT snapshots.*, CASE WHEN raw_mode ~ '^[a-z0-9_-]{1,30}$' THEN raw_mode END AS mode,
    CASE WHEN raw_resolution ~ '^[0-9]{1,4}[pPkK]$' THEN raw_resolution END AS res,
    CASE WHEN raw_ratio ~ '^([0-9]{1,3}:[0-9]{1,3}|auto|adaptive)$' THEN raw_ratio END AS ratio,
    s->'schemaVersion'='1'::jsonb AND s->>'surface'='video' AND s->>'engineId'=engine
      AND jsonb_typeof(core)='object' AND jsonb_typeof(adv)='object'
      AND adv ? 'extraInputValues' AND jsonb_typeof(extras) IN ('null','object') AS snapshot_ok,
    r ?& ARRAY['inputs','videoUrls','referenceImages','audioUrl','imageUrl','firstFrameUrl','endImageUrl','lastFrameUrl']
      AND jsonb_typeof(r->'inputs') IN ('null','array') AND jsonb_typeof(r->'referenceImages') IN ('null','array')
      AND jsonb_typeof(r->'videoUrls') IN ('null','array')
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(${jsonArray("r->'referenceImages'")} || ${jsonArray("r->'videoUrls'")}) v
        WHERE jsonb_typeof(v)<>'string' OR NULLIF(btrim(v#>>'{}'),'') IS NULL)
      AND NOT EXISTS (SELECT 1 FROM unnest(ARRAY['audioUrl','imageUrl','firstFrameUrl','endImageUrl','lastFrameUrl']) k
        WHERE jsonb_typeof(r->k) NOT IN ('null','string')) AS refs_ok,
    (SELECT count(DISTINCT url)::int FROM (
      SELECT btrim(v#>>'{}') AS url FROM jsonb_array_elements(${jsonArray("r->'referenceImages'")}) v WHERE jsonb_typeof(v)='string'
      UNION ALL SELECT btrim(COALESCE(NULLIF(i->>'url',''),i->>'dataUrl'))
        FROM jsonb_array_elements(${jsonArray("r->'inputs'")}) i WHERE (i->>'slotId' IN ('reference_image_urls','reference_images') OR (kling OR engine='seedance-2-5') AND i->>'slotId'='image_urls')
    ) images WHERE NULLIF(url,'') IS NOT NULL) AS settings_images,
    media.start_frame, media.end_frame, media.audio_ref, media.video_ref, media.unreviewed_attachment,
    clips.durations, clips.nclips, clips.clip_total,
    NULLIF(btrim(r->>'imageUrl'),'') IS NOT NULL OR NULLIF(btrim(r->>'firstFrameUrl'),'') IS NOT NULL AS image_present,
    NULLIF(btrim(r->>'endImageUrl'),'') IS NOT NULL OR NULLIF(btrim(r->>'lastFrameUrl'),'') IS NOT NULL AS end_present,
    CASE WHEN jsonb_typeof(extras)='object' THEN jsonb_strip_nulls(extras) ELSE '{}'::jsonb END AS options
  FROM snapshots
  LEFT JOIN LATERAL (
    SELECT COALESCE(bool_or(i->>'slotId' IN ('image_url','first_frame_url','start_image_url')),false) AS start_frame,
      COALESCE(bool_or(i->>'slotId' IN ('end_image_url','last_frame_url')),false) AS end_frame,
      COALESCE(bool_or(i->>'kind'='audio' OR i->>'slotId' IN ('target_audio_url','reference_audio_urls','audio_url','audio_urls')),false) AS audio_ref,
      COALESCE(bool_or(i->>'kind'='video' OR i->>'slotId' IN ('video_url','reference_video_urls','video_urls','extension_source_videos')),false) AS video_ref,
      COALESCE(bool_or(jsonb_typeof(i)<>'object' OR NULLIF(btrim(COALESCE(NULLIF(i->>'url',''),i->>'dataUrl')),'') IS NULL
        OR (COALESCE(i->>'slotId','') NOT IN ('image_url','first_frame_url','start_image_url','end_image_url','last_frame_url',
          'reference_image_urls','reference_images','reference_video_urls','video_url','target_audio_url','reference_audio_urls','audio_url')
          AND NOT ((kling OR engine='seedance-2-5') AND COALESCE(i->>'slotId','')='image_urls' OR engine='seedance-2-5' AND COALESCE(i->>'slotId','') IN ('video_urls','audio_urls','extension_source_videos')))),false) AS unreviewed_attachment
    FROM jsonb_array_elements(${jsonArray("r->'inputs'")}) i
  ) media ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS nclips, sum(clip_sec) AS clip_total,
      CASE WHEN count(*)=count(clip_sec) THEN jsonb_agg(clip_sec ORDER BY clip_sec) END AS durations FROM (
      SELECT btrim(COALESCE(NULLIF(i->>'url',''),i->>'dataUrl')) AS url,
        CASE WHEN count(*)=count(${seconds("i->'durationSec'")}) AND min(${seconds("i->'durationSec'")})=max(${seconds("i->'durationSec'")})
          THEN min(${seconds("i->'durationSec'")}) END AS clip_sec
      FROM jsonb_array_elements(${jsonArray("r->'inputs'")}) i
      WHERE i->>'kind'='video' AND NULLIF(btrim(COALESCE(NULLIF(i->>'url',''),i->>'dataUrl')),'') IS NOT NULL GROUP BY 1
    ) unique_clips
  ) clips ON true
), facts AS MATERIALIZED (
  SELECT *,
    CASE WHEN wan AND adapter IN ('alibaba_model_studio','apimart') OR kling AND adapter='kling_direct' THEN ${nonnegativeInt("a->'referenceImageCount'")}
      WHEN NOT wan AND refs_ok THEN settings_images END AS ref_images,
    CASE WHEN wan OR kling AND adapter='kling_direct' THEN ${bool("a->'hasStartImage'")}
      WHEN refs_ok THEN start_frame OR (mode='i2v' AND image_present) END AS has_start,
    CASE WHEN wan OR kling AND adapter='kling_direct' THEN ${bool("a->'hasEndImage'")}
      WHEN refs_ok THEN end_frame OR end_present END AS has_end,
    CASE WHEN wan THEN ${nonnegativeInt("a->'referenceVideoCount'")} > 0
      WHEN refs_ok THEN video_ref OR jsonb_array_length(${jsonArray("r->'videoUrls'")}) > 0 OR COALESCE(${bool("a->'hasSourceVideo'")},false) END AS has_video,
    CASE WHEN wan THEN ${nonnegativeInt("a->'referenceAudioCount'")} > 0
      WHEN refs_ok THEN audio_ref OR NULLIF(btrim(r->>'audioUrl'),'') IS NOT NULL END AS has_audio_ref,
    CASE WHEN h3 AND mode IN ('t2v','i2v','ref2v') THEN true
      ELSE COALESCE(${bool("a->'audioEnabled'")}, ${bool("cost->'generate_audio'")}, ${bool("core->'audio'")}) END AS output_audio,
    NULLIF(btrim(options->>'file_url'),'') IS NOT NULL OR NULLIF(btrim(options->>'web_url'),'') IS NOT NULL AS doc,
    CASE WHEN wan THEN options - ${wanExtras} <> '{}'::jsonb OR COALESCE(jsonb_typeof(options->'enable_prompt_expansion'),'null') NOT IN ('boolean','null')
      ELSE unreviewed_attachment OR NOT refs_ok OR
        (CASE WHEN h3 THEN options - 'prompt_expansion_mode' WHEN kling THEN options - ${directKeys} - 'generate_audio'
          WHEN engine='seedance-2-5' AND options->>'output_format'='mp4' THEN options - 'output_format' ELSE options END <> '{}'::jsonb)
        OR (jsonb_strip_nulls(adv) - ARRAY['extraInputValues','shotType'] -
          CASE WHEN engine='kling-3-pro' AND ${seconds("adv->'cfgScale'")} BETWEEN 0 AND 1 THEN ARRAY['cfgScale'] ELSE ARRAY[]::text[] END) <> '{}'::jsonb
        OR NULLIF(btrim(s->>'negativePrompt'),'') IS NOT NULL OR (r->'elements' IS NOT NULL AND r->'elements' NOT IN ('null','[]'))
        OR (h3 AND options ? 'prompt_expansion_mode' AND COALESCE(options->>'prompt_expansion_mode','') NOT IN ('disabled','fast','balanced','quality'))
        OR (engine='seedance-2-5' AND (s ? 'seedanceWorkflow' OR COALESCE(s->>'byteplusTransport'='las',false)))
        OR (kling AND (COALESCE(a->>'hasElementList'='true',false) OR COALESCE(a->>'requiresElementRegistration'='true',false) OR
          COALESCE(${nonnegativeInt("a->'voiceCount'")},0)>0 OR COALESCE(${nonnegativeInt("a->'multiPromptCount'")},0)>0 OR COALESCE(${nonnegativeInt("a->'elementCount'")},0)>0))
      END AS unpriced,
    CASE WHEN kling THEN EXISTS (SELECT 1 FROM jsonb_each(options) extra WHERE key=ANY(${directKeys})
      AND value NOT IN ('false','null','""','[]','{}')) ELSE false END AS direct,
    CASE WHEN h3 AND jsonb_typeof(s->'prompt')='string' THEN char_length(btrim(s->>'prompt')) END AS prompt_chars,
    CASE WHEN h3 AND options->>'prompt_expansion_mode' IN ('disabled','fast','balanced','quality') THEN options->>'prompt_expansion_mode'
      WHEN h3 AND NOT (options ? 'prompt_expansion_mode') THEN 'balanced' END AS expansion,
    CASE WHEN engine='seedance-2-5' AND owner='byteplus_modelark' AND cost->>'provider_cost_status'='list_estimate_from_provider_usage'
      THEN ${nonnegativeInt("cost->'provider_tokens'")} END AS tokens,
    ${seconds("a->'inputVideoDurationSec'")} AS total_secs, ${nonnegativeInt("a->'referenceVideoCount'")} AS n_videos
  FROM evidence
), profiles AS (
  SELECT *, CASE WHEN engine IN ${supported} AND snapshot_ok AND mode IS NOT NULL AND sec > 0 AND res IS NOT NULL
      AND ref_images IS NOT NULL AND has_video IS NOT NULL AND has_start IS NOT NULL AND has_end IS NOT NULL AND has_audio_ref IS NOT NULL
      AND unpriced IS NOT NULL THEN
    jsonb_strip_nulls(jsonb_build_object('engineId',engine,'mode',mode,'durationSec',sec,'resolution',res,
      'images',ref_images+has_start::int,'hasStartFrame',has_start,'hasEndFrame',has_end,'hasVideo',has_video,
      'hasAudioReference',has_audio_ref,'hasDocument',doc,'hasUnpricedOptions',unpriced,'requiresDirectControls',direct,
      'requestedRatioVerified',ratio IS NOT NULL,'observedAspectRatio',
      CASE WHEN observed_ratio ~ '^[0-9]{1,4}:[0-9]{1,4}$' THEN observed_ratio END,
      'audioEnabled',output_audio,'observedVideoTokens',tokens,'promptCharacters',prompt_chars,'h3PromptExpansion',expansion,
      'referenceVideoSeconds',CASE WHEN wan AND has_video AND total_secs>0 THEN CASE WHEN n_videos=1 THEN jsonb_build_array(total_secs)
        WHEN n_videos=nclips AND clip_total=total_secs THEN durations END END))
      || jsonb_build_object('aspectRatio',CASE WHEN h3 AND mode='i2v' THEN NULL ELSE ratio END,'inputVideoSeconds',
        CASE WHEN NOT has_video THEN 0 WHEN wan THEN total_secs WHEN engine='seedance-2-5' THEN ${seconds("s->'byteplusInputVideoDurationSec'")} END)
    END AS request
  FROM facts
), anonymous AS (
  SELECT bucket, jsonb_build_object('engineId',engine,'status',status,'paidWallet',paid,'source',source,
    'bucketAt',to_char(bucket,'YYYY-MM-DD"T"HH24:00:00"Z"'),'historicalProvider',owner,'mode',mode,'resolution',res,'durationSec',sec,
    'request',request,'ceilingMicros',ceiling) ||
    CASE WHEN request IS NULL THEN jsonb_build_object('missingReason',CASE WHEN engine NOT IN ${supported}
      THEN 'No reviewed tariff for this engine' WHEN snapshot_ok IS NOT TRUE THEN 'Settings snapshot incomplete'
      ELSE 'Incomplete media roles or generation settings' END) ELSE '{}'::jsonb END AS profile
  FROM profiles
)
SELECT profile || jsonb_build_object('jobs',count(*)::integer) AS replay_group
FROM anonymous GROUP BY bucket,profile ORDER BY bucket,profile`;

export function assertHistoricalReplayWindow(startDay: string, endDay: string) {
  function dateValue(day: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid replay date');
    const date = new Date(day + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error('Invalid replay date');
    return date.getTime();
  }
  if (dateValue(endDay) - dateValue(startDay) !== 30 * 86_400_000) throw new Error('Replay requires 30 calendar days');
}

export async function loadHistoricalReplayGroups(startDay: string, endDay: string, execute: QueryExecutor['query'] = query): Promise<HistoricalReplayGroup[]> {
  assertHistoricalReplayWindow(startDay, endDay);
  const rows = await execute<{ replay_group: HistoricalReplayGroup }>(HISTORICAL_REPLAY_QUERY, [startDay, endDay, ADMIN_EXCLUDED_USER_IDS]);
  return rows.map(row => row.replay_group);
}
