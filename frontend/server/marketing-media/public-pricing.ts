/** Historical display amounts are portable; owned source receipt bindings are private. */
export function sanitizePublicVideoPricingSnapshot<T>(snapshot: T): T {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return snapshot;
  const projection = { ...snapshot } as Record<string, unknown>;
  delete projection.lumaSource;
  delete projection.fluxDraftSource;
  return projection as T;
}
