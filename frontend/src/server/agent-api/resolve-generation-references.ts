import type { CanonicalGenerationRequest } from './generation-types';
import type { AgentPrincipal } from './principal';
import {
  resolveOwnedReferenceAsset,
  type OwnedReferenceAsset,
} from './reference-assets';
import type { ResolvedReference } from './reference-types';

export type ResolveGenerationReferencesDependencies = {
  resolveOwnedReferenceAsset(
    principal: AgentPrincipal,
    assetId: string,
  ): Promise<OwnedReferenceAsset>;
};

const defaultDependencies: ResolveGenerationReferencesDependencies = {
  resolveOwnedReferenceAsset: (principal, assetId) => resolveOwnedReferenceAsset(principal, assetId),
};

export async function resolveGenerationReferences(
  request: CanonicalGenerationRequest,
  principal: AgentPrincipal,
  dependencies: ResolveGenerationReferencesDependencies = defaultDependencies,
): Promise<ResolvedReference[]> {
  const resolved: ResolvedReference[] = [];
  for (const reference of request.references) {
    if (reference.kind !== 'asset') continue;
    const asset = await dependencies.resolveOwnedReferenceAsset(principal, reference.assetId);
    resolved.push({ ...asset, role: reference.role, ...(reference.slot === undefined ? {} : { slot: reference.slot }) });
  }
  return resolved;
}
