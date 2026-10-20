/** Server-owned provenance. Legacy jobs without this marker remain application jobs. */
export const EXTERNAL_FAL_IMPORT_ORIGIN = 'external_fal_import' as const;

export function isExternalFalImport(snapshot: unknown): boolean {
  return Boolean(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    && (snapshot as Record<string, unknown>).origin === EXTERNAL_FAL_IMPORT_ORIGIN);
}

/** Alias is authored SQL, never request input. to_jsonb also supports old read-only schemas. */
export function applicationJobSql(alias = 'app_jobs'): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error('Invalid job SQL alias');
  return `COALESCE(to_jsonb(${alias})->'settings_snapshot'->>'origin', '') <> '${EXTERNAL_FAL_IMPORT_ORIGIN}'`;
}

export function assertApplicationJobResync(snapshot: unknown): void {
  if (isExternalFalImport(snapshot)) throw new Error('External Fal imports cannot be resynced through the application generation lifecycle.');
}
