/** Existing content-addressed producer/cleanup claims must share their original fence. */
export function purgeFenceTable(key:string){
  return /^(?:mcp-reference-staging\/)?(?:user-assets\/by-content\/|user-asset-thumbs\/)/.test(key)
    ?'mcp_reference_upload_object_fences':'library_storage_object_fences';
}
