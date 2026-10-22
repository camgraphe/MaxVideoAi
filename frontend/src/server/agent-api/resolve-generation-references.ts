import {validateKlingV4OwnedMedia,type KlingV4OwnedMediaDependencies} from '@/app/api/generate/_lib/kling-v4-owned-media';
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
  klingV4MediaDependencies?: KlingV4OwnedMediaDependencies;
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
  return verifyResolvedGenerationReferencesForActor(request, principal, resolved, dependencies.klingV4MediaDependencies);
}

/** Reuse only after a caller has established owned original identities (including Studio provenance locks). */
export async function verifyResolvedGenerationReferencesForActor(
  request: CanonicalGenerationRequest, principal: GenerationActor, resolved: ResolvedReference[],
  klingV4MediaDependencies?: KlingV4OwnedMediaDependencies,
): Promise<ResolvedReference[]> {
  if (request.engineId === 'kling-v4' && resolved.length) {
    if (request.references.some(reference=>reference.kind!=='asset')) throw new AgentApiError('REFERENCE_INVALID','Kling 4 requires owned original references.');
    const media = resolved.map((reference,index)=>({fieldId:`canonical_reference.${index}`,kind:reference.mediaKind,url:reference.storageUrl}));
    const verified = await validateKlingV4OwnedMedia({mode:request.mode as 't2v'|'i2v'|'ref2v'|'v2v',userId:principal.userId,
      attachments:resolved.map((reference,index)=>({assetId:reference.assetId,kind:reference.mediaKind,url:reference.storageUrl,slotId:media[index].fieldId,name:reference.originalName??'reference',type:reference.mimeType,size:reference.sizeBytes??0})),
      referenceMediaItems:media,trustedResolvedReferences:resolved,deps:klingV4MediaDependencies});
    if (!verified.ok) throw new AgentApiError('REFERENCE_INVALID',verified.body.message as string);
    return resolved.map((reference,index)=>{
      const facts=verified.trustedMediaReferences[index];
      if (!facts || facts.assetId!==reference.assetId || facts.url!==reference.storageUrl) throw new AgentApiError('REFERENCE_INVALID','The verified original no longer matches this reference.');
      return {...reference,width:facts.width??null,height:facts.height??null,durationSec:facts.durationSec??null,...(facts.fps===undefined?{}:{fps:facts.fps})};
    });
  }
  return resolved;
}

export function resolveGenerationReferences(request: CanonicalGenerationRequest, principal: AgentPrincipal, dependencies: ResolveGenerationReferencesDependencies = defaultDependencies): Promise<ResolvedReference[]> {
  requireOAuthGenerationActor(principal);
  return resolveGenerationReferencesForActor(request, principal, dependencies);
}
