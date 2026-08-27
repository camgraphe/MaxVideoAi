export type GoogleVertexOmniLocation = 'global';

export function resolveGoogleVertexOmniLocation(value: string | null | undefined): GoogleVertexOmniLocation {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'global') return 'global';
  throw new Error(`GOOGLE_VERTEX_OMNI_LOCATION must be global; received ${normalized}.`);
}
