// Uppy 6 ships export-map-only ESM declarations. Keep this repository's legacy
// Node resolution without replacing the installed SDK types or its runtime entry.
declare module '@uppy/core' {
  const Uppy: typeof import('../node_modules/@uppy/core/lib/Uppy').default;
  export const RestrictionError: typeof import('../node_modules/@uppy/core/lib/Restricter').RestrictionError;
  export default Uppy;
}
