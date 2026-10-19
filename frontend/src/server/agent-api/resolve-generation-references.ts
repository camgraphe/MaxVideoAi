import type { CanonicalGenerationRequest } from './generation-types';
import type { AgentPrincipal } from './principal';
import { requireOAuthGenerationActor, type GenerationActor } from './generation-actor';
import {
  resolveOwnedReferenceAssetForActor,
  type OwnedReferenceAsset,
} from './reference-assets';
import type { ResolvedReference } from './reference-types';
import { AgentApiError } from './errors';
import { isAllowedAssetHost } from '@/server/storage';

/** Match submission URL admissibility before a quote or wallet reservation exists. */
export function assertGenerationReferenceUrls(request: CanonicalGenerationRequest): void {
  for (const reference of request.references) {
    if (reference.kind === 'https' && !isAllowedAssetHost(reference.url)) {
      throw new AgentApiError(
        'REFERENCE_INVALID',
        'This reference link cannot be used. Import the original file into MaxVideoAI before preparing a new quote. No credits were charged.',
        false,
        { type: 'import_reference_files' },
      );
    }
  }
}

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
