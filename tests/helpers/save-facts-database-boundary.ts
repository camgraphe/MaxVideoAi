/**
 * Database double for existing facts-only save tests. It preserves production
 * save, organization and facts logic, but does NOT establish atomicity. The
 * organization PostgreSQL tests own real source locks, aliases and rollback.
 */
export function saveFactsDatabaseBoundary(fixture: string): string {
    return `
    const active = new WeakSet();
    let saved = null;
    let outputs = [];
    export async function query(sql, values) {
      const rows = await ${fixture}.query(sql, values);
      if (sql.includes('FROM job_outputs')) outputs = rows;
      return rows;
    }
    export const isTransactionQueryExecutor = executor => active.has(executor);
    const assetSource = () => saved ? [{type:'asset',id:saved.id,publicId:saved.public_id,kind:saved.kind,url:saved.url,
      original:saved.source_output_id?saved.metadata?.originUrl??saved.url:saved.url,
      provenance:saved.metadata?.originUrl??null,jobId:saved.source_job_id,outputId:saved.source_output_id,
      createdAt:saved.created_at??'2026-01-01T00:00:00Z',available:saved.status==='ready'}] : [];
    async function transactionQuery(sql, values = []) {
      if (sql.includes('pg_advisory_xact_lock')) return [];
      if (sql.includes('SELECT id FROM media_assets') || sql.includes('SELECT asset_id FROM user_assets')) return [];
      if (sql.includes('INSERT INTO media_assets')) {
        const rows = await query(sql, values);
        saved = rows[0]; saved.public_id ??= 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        return rows;
      }
      if (sql.includes('WITH requested AS') && sql.includes('jsonb_to_recordset')) return assetSource();
      if (sql.includes('FROM user_assets u')) return [];
      if (sql.includes('AS "publicId"') && sql.includes('FROM media_assets m')) return assetSource();
      if (sql.includes('AS "publicId"') && sql.includes('FROM job_outputs o')) return outputs.map(row=>({
        type:'job-output',id:row.id,publicId:null,kind:row.kind,url:row.storage_url??row.url,original:row.storage_url??row.url,
        provenance:null,jobId:row.job_id,outputId:row.id,createdAt:row.created_at??'2026-01-01T00:00:00Z',available:(row.status??'ready')==='ready'
      }));
      if (sql.includes('FROM app_jobs')) return outputs.map(row=>({job_id:row.job_id,hidden:false}));
      if (sql.includes('INSERT INTO library_organization_aliases')) return JSON.parse(values[1]).map(row=>({
        alias_type:row.type,alias_id:row.id,source_revision:row.revision,organization_key:row.key
      }));
      if (sql.includes('library_organization')) return [];
      throw new Error('Unexpected facts-only transaction query');
    }
    export async function withDbTransaction(callback) {
      const executor={query:transactionQuery};active.add(executor);
      try {return await callback(executor);} finally {active.delete(executor);}
    }
  `;
}
