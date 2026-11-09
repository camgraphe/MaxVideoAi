/** Uses library_identities from the common read-only relation before LIMIT/rank.
 * An unresolved identity must fail the read, not invent active/default state. */
export function activeLibrarySourceSql(type: string, id: string, kind: string, owner = '$1'): string {
    return `NOT EXISTS(SELECT 1 FROM library_identities li LEFT JOIN library_organization org ON org.user_id=${owner} AND org.key=li.organization_key
    WHERE li.type='${type}' AND li.id=${id} AND li.kind=${kind}
      AND CASE WHEN li.identity_error IS NOT NULL THEN li.identity_error::integer=0 ELSE org.trashed_at IS NOT NULL END)`;
}

/** A job-only facade can correspond to an already saved exact owned projection.
 * Job ancestry plus original correspondence is required; URL equality alone is not identity. */
export function historicalJobProjectionSql(jobId: string, original: string, owner = '$1'): string {
    return `SELECT min(li.identity_error) AS identity_error,max(org.trashed_at) AS trashed_at
      FROM library_identities li LEFT JOIN library_organization org ON org.user_id=${owner} AND org.key=li.organization_key
      WHERE li.type IN ('asset','legacy') AND li.kind='video' AND li."jobId"=${jobId}
        AND (${original}=li.original OR ${original}=li.url OR ${original}=li.provenance)`;
}
