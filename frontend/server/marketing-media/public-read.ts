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
        SELECT 1 FROM marketing_media m WHERE m.video_id=legacy.job_id
          AND (m.state='ready' OR (m.tombstone AND m.state IN ('deleting','deleted')))
      )
      UNION ALL
      SELECT publication.*, m.recreation_snapshot,
        (m.publication->>'marketing_output_width')::integer, (m.publication->>'marketing_output_height')::integer
      FROM marketing_media m
      CROSS JOIN LATERAL jsonb_populate_record(NULL::public.app_jobs,m.publication) publication
      WHERE m.state='ready'
    )`;
      return db.query(
        `WITH ${projection}${/^\s*WITH\b/i.test(sql) ? ',' + sql.replace(/^\s*WITH\b/i, '') : sql}`,
        params,
      );
    },
  };
}

/** Membership/count/order must not deserialize full jobs or their generation recipes.
 * The caller still hydrates its selected page through the normal app_jobs overlay,
 * in this same statement and database snapshot. */
export function marketingCatalogReader(db: QueryExecutor): QueryExecutor {
  const enabled = process.env.MARKETING_MEDIA_ENABLED === '1';
  const read = marketingVideoReader(db, enabled);
  const columns = {
    user_id: 'text', engine_id: 'text', engine_label: 'text', duration_sec: 'integer',
    created_at: 'timestamptz', visibility: 'text', indexable: 'boolean', status: 'text',
    surface: 'text', video_url: 'text', prompt: 'text',
  };
  const projection = enabled ? `
    SELECT legacy.job_id,${Object.keys(columns).map(column => `legacy.${column}`).join(',')}
    FROM public.app_jobs legacy WHERE NOT EXISTS (
      SELECT 1 FROM marketing_media m WHERE m.video_id=legacy.job_id
        AND (m.state='ready' OR (m.tombstone AND m.state IN ('deleting','deleted')))
    )
    UNION ALL
    SELECT m.video_id,publication.*
    FROM marketing_media m
    CROSS JOIN LATERAL jsonb_to_record(m.publication) AS publication(
      ${Object.entries(columns).map(([column, type]) => `${column} ${type}`).join(',')}
    ) WHERE m.state='ready'
  ` : 'SELECT * FROM public.app_jobs';
  return {
    query: (sql, params) => read.query(
      `WITH catalog_jobs AS NOT MATERIALIZED (${projection})${/^\s*WITH\b/i.test(sql) ? ',' + sql.replace(/^\s*WITH\b/i, '') : sql}`, params,
    ),
  };
}
