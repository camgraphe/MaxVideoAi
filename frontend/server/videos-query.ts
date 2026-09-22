export const imageThumbFallbackSelect = (jobAlias: string) => `
             SELECT COALESCE(NULLIF(jo.thumb_url, ''), NULLIF(jo.url, ''), NULLIF(jo.storage_url, ''))
               FROM job_outputs jo
              WHERE jo.job_id = ${jobAlias}.job_id
                AND jo.kind = 'image'
              ORDER BY jo.created_at ASC
              LIMIT 1
`;

export const videoOutputDimensionSelect = (jobAlias: string, column: 'width' | 'height') =>
  `SELECT jo.${column} FROM job_outputs jo WHERE jo.job_id = ${jobAlias}.job_id AND jo.kind = 'video' AND jo.status <> 'deleted' AND jo.width IS NOT NULL AND jo.height IS NOT NULL ORDER BY jo.position ASC, jo.created_at ASC LIMIT 1`;

export const BASE_SELECT = `
  SELECT job_id, user_id, engine_id, engine_label, duration_sec, prompt,
         COALESCE(NULLIF(thumb_url, ''), (${imageThumbFallbackSelect('app_jobs')})) AS thumb_url,
         video_url,
         to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url,
         to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls,
         aspect_ratio, (${videoOutputDimensionSelect('app_jobs', 'width')}) AS output_width, (${videoOutputDimensionSelect('app_jobs', 'height')}) AS output_height,
         has_audio, can_upscale, created_at, visibility, indexable, featured, featured_order,
         final_price_cents, currency, pricing_snapshot
  FROM app_jobs
`;

export const BASE_SELECT_WITH_SETTINGS = `
  SELECT job_id, user_id, engine_id, engine_label, duration_sec, prompt,
         COALESCE(NULLIF(thumb_url, ''), (${imageThumbFallbackSelect('app_jobs')})) AS thumb_url,
         video_url,
         to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url,
         to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls,
         aspect_ratio, (${videoOutputDimensionSelect('app_jobs', 'width')}) AS output_width, (${videoOutputDimensionSelect('app_jobs', 'height')}) AS output_height,
         has_audio, can_upscale, created_at, visibility, indexable, featured, featured_order,
         final_price_cents, currency, settings_snapshot
  FROM app_jobs
`;

