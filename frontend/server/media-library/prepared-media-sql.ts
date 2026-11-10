/** Internal input copies retain their exact identity for existing Create/Studio
 * references. Their recorded lineage, never their filename, excludes them from
 * discovery. Final creator results and distinct character looks remain visible. */
export const retainedLibraryMediaSql = (metadata: string): string => `COALESCE(${metadata}#>>'{libraryPurgeRetained,version}'='1',false)`;
export function preparedLibraryMediaSql(metadata: string, kind: string): string {
  const excerpt = (type: 'video' | 'audio') => `(${kind}='${type}'
    AND jsonb_typeof(${metadata}->'${type}Excerpt')='object'
    AND jsonb_typeof(${metadata}#>'{${type}Excerpt,source}')='object'
    AND ${metadata}#>>'{${type}Excerpt,source,kind}'='${type}'
    AND jsonb_typeof(${metadata}#>'{${type}Excerpt,range}')='object')`;
  return `(NOT ${retainedLibraryMediaSql(metadata)} AND COALESCE((${excerpt('video')} OR ${excerpt('audio')} OR (
    jsonb_typeof(${metadata}->'creator')='object'
    AND jsonb_typeof(${metadata}#>'{creator,source}')='object'
    AND ${metadata}#>>'{creator,source,kind}'=${kind}
    AND jsonb_typeof(${metadata}#>'{creator,sourceFingerprint}')='string'
    AND ${metadata}#>'{creator,generation}' IS NULL
  )),false))`;
}
