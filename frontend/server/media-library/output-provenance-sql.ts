/** Read-only compatibility for historical saved projections. Never rewrite a stored
 * reference or equate independent outputs just because their URLs are the same. */
export function resolvedOutputIdSql(outputId: string, jobId: string, kind: string, original: string, owner: string): string {
  return `(CASE WHEN ${jobId} IS NULL THEN ${outputId}
    WHEN ${outputId} IS NULL THEN (
      SELECT CASE WHEN count(*)=1 THEN min(proof.id) END FROM (
        SELECT identity_output.id FROM job_outputs identity_output
        WHERE identity_output.user_id=${owner} AND identity_output.job_id=${jobId} AND identity_output.kind=${kind}
          AND COALESCE(identity_output.storage_url,identity_output.url)=${original}
        LIMIT 2
      ) proof
    ) WHEN ${outputId} LIKE 'output:%' THEN COALESCE((
      SELECT identity_output.id FROM job_outputs identity_output
      WHERE identity_output.user_id=${owner} AND identity_output.job_id=${jobId} AND identity_output.kind=${kind}
        AND identity_output.id IN (${outputId},substring(${outputId} from 8))
      ORDER BY (identity_output.id=${outputId}) DESC LIMIT 1
    ),${outputId}) ELSE ${outputId} END)`;
}

/** An unresolved ID can mean either no output proof or multiple owned versions.
 * Keep that ambiguity out of similarity-only canonical matching, even if one
 * sibling is unavailable. Callers pass the already-resolved ID to avoid repeat work. */
export function ambiguousOutputIdentitySql(outputId: string, jobId: string, kind: string, original: string, owner: string): string {
  return `(CASE WHEN ${outputId} IS NULL AND ${jobId} IS NOT NULL THEN EXISTS(
    SELECT 1 FROM job_outputs identity_sibling
    WHERE identity_sibling.user_id=${owner} AND identity_sibling.job_id=${jobId} AND identity_sibling.kind=${kind}
      AND COALESCE(identity_sibling.storage_url,identity_sibling.url)=${original}
    LIMIT 1 OFFSET 1
  ) ELSE false END)`;
}
