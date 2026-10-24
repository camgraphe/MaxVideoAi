import { qualifyFluxLtxSourceReference } from './flux-ltx-source-reference';
import { inspectOwnedFluxLtxSource } from '@/server/video-excerpts/flux-ltx-source';
import { qualifyH3SourceReference } from './h3-source-reference';
import { inspectOwnedH3Source } from '@/server/video-excerpts/h3-relight';
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
  inspectFluxLtxSource?: typeof inspectOwnedFluxLtxSource;
  inspectH3Source?: typeof inspectOwnedH3Source;
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
    const referenceFacts = { ...asset, role: reference.role, ...(reference.slot === undefined ? {} : { slot: reference.slot }) };
    resolved.push(request.engineId === 'minimax-h3-max'
      ? await qualifyH3SourceReference(referenceFacts, request.operation, principal.userId, dependencies.inspectH3Source)
      : await qualifyFluxLtxSourceReference(referenceFacts,request.operation,principal.userId,dependencies.inspectFluxLtxSource));
  }
  return resolved;
}

export function resolveGenerationReferences(request: CanonicalGenerationRequest, principal: AgentPrincipal, dependencies: ResolveGenerationReferencesDependencies = defaultDependencies): Promise<ResolvedReference[]> {
  requireOAuthGenerationActor(principal);
  return resolveGenerationReferencesForActor(request, principal, dependencies);
}
