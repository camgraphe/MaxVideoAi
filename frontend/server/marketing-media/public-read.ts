import type { QueryExecutor } from '@/lib/db';

/** Opt-in public read boundary. Private job/account readers never use this projection. */
export function marketingVideoReader(
  db: QueryExecutor,
  enabled = process.env.MARKETING_MEDIA_ENABLED === '1',
): QueryExecutor {
  if (!enabled) return db;
  return {
    query: (sql, params) => {
      if (!/\bapp_jobs\b/.test(sql) || !/^\s*(SELECT|WITH)\b/i.test(sql)) return db.query(sql, params);
      const projection = `app_jobs AS NOT MATERIALIZED (
      SELECT legacy.*, NULL::jsonb AS marketing_recreation_snapshot,
        NULL::integer AS marketing_output_width, NULL::integer AS marketing_output_height
      FROM public.app_jobs legacy WHERE NOT EXISTS (
        SELECT 1 FROM marketing_media m WHERE m.video_id=legacy.job_id AND m.state IN ('ready','deleting','deleted')
      )
      UNION ALL
      SELECT (jsonb_populate_record(NULL::public.app_jobs,m.publication)).*, m.recreation_snapshot,
        (m.publication->>'marketing_output_width')::integer, (m.publication->>'marketing_output_height')::integer
      FROM marketing_media m WHERE m.state='ready'
    )`;
      return db.query(
        `WITH ${projection}${/^\s*WITH\b/i.test(sql) ? ',' + sql.replace(/^\s*WITH\b/i, '') : sql}`,
        params,
      );
    },
  };
}
