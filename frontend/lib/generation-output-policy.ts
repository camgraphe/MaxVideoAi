/** Optional provider output controls retired from new requests and saved settings reuse.
 * Provider-required provenance markers are independent and are not altered here.
 */
export function withoutRetiredOutputControls<T>(values: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(values).filter(([key]) =>
    key !== 'watermark' && key !== 'return_last_frame' && key !== 'returnLastFrame'));
}
