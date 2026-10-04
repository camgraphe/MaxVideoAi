import type { CanonicalGenerationRequest } from './generation-types';
import type { AgentPrincipal } from './principal';
import { requireOAuthGenerationActor, type GenerationActor } from './generation-actor';
import {
  resolveOwnedReferenceAssetForActor,
  type OwnedReferenceAsset,
} from './reference-assets';
import type { ResolvedReference } from './reference-types';

export type ResolveGenerationReferencesDependencies = {
  resolveOwnedReferenceAsset(
    principal: GenerationActor,
    assetId: string,
  ): Promise<OwnedReferenceAsset>;
};

const defaultDependencies: ResolveGenerationReferencesDependencies = {
  resolveOwnedReferenceAsset: (principal, assetId) => resolveOwnedReferenceAssetForActor(principal, assetId),
};

export async function resolveGenerationReferencesForActor(
  request: CanonicalGenerationRequest,
  principal: GenerationActor,
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

export function resolveGenerationReferences(request: CanonicalGenerationRequest, principal: AgentPrincipal, dependencies: ResolveGenerationReferencesDependencies = defaultDependencies): Promise<ResolvedReference[]> {
  requireOAuthGenerationActor(principal);
  return resolveGenerationReferencesForActor(request, principal, dependencies);
}
