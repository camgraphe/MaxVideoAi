import { createDefaultCharacterBuilderState } from '@/lib/character-builder';
import { bindStudioLookRequest } from '@/lib/character-studio-look';
import { query } from '@/lib/db';
import { AgentApiError } from '@/server/agent-api/errors';
import type { GenerationActor } from '@/server/agent-api/generation-actor';
import { studioReferenceFingerprint } from '@/server/agent-api/generation-actor';
import { normalizeGenerationRequest } from '@/server/agent-api/generation-normalization';
import { resolveOwnedReferenceAssetForActor } from '@/server/agent-api/reference-assets';
import type { ResolvedReference } from '@/server/agent-api/reference-types';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { prepareCharacterBuilderRequest } from '@/server/tools/character-builder/preparation';
import type { CharacterBuilderRequest, CharacterBuilderTraits } from '@/types/character-builder';
import { characterBuilderAuthoringInput } from './authoring-request';
import { getStudioCharacter } from './store';
import { resolveStudioOutput } from './source';
import { resolveCharacterPortraitAsset } from './recast';

/** Resolve only owned originals, then use precisely the workspace's recipe preparation. */
export async function prepareCharacterBuilderAuthoring(actor: GenerationActor, value: unknown) {
  const input = characterBuilderAuthoringInput.parse(value);
  const base = createDefaultCharacterBuilderState();
  let request: CharacterBuilderRequest = {
    ...base,...input,action:'generate',generateCount:1,referenceImages:[],
    traits:{...base.traits,...input.traits} as CharacterBuilderTraits,
    outputOptions:{...base.outputOptions,...input.outputOptions},
  };
  const sources = [...(input.referenceImages??[])];
  if (input.characterId) {
    const character = await getStudioCharacter(actor.userId,input.characterId);
    await resolveStudioOutput({query},actor.userId,character.identity.jobId,character.identity.imageUrl);
    request = bindStudioLookRequest(request,character);
    const assetId = await resolveCharacterPortraitAsset(actor.userId,character.identity);
    sources.unshift({assetId,role:'identity'});
  }
  const resolved: ResolvedReference[] = [];
  request.referenceImages = [];
  for (const [slot, source] of sources.entries()) {
    const asset = await resolveOwnedReferenceAssetForActor(actor,source.assetId);
    if (asset.mediaKind!=='image') throw new AgentApiError('REFERENCE_INVALID','Choose an owned original image.');
    await resolveStudioMedia(actor.userId,{type:'asset',assetId:source.assetId,kind:'image'});
    resolved.push({...asset,role:'reference',slot});
    request.referenceImages.push({id:source.assetId,url:asset.storageUrl,role:source.role,
      width:asset.width,height:asset.height,name:null});
  }
  request.sourceMode = sources.some(source=>source.role==='identity')?'reference-image':'scratch';
  const prepared = prepareCharacterBuilderRequest({...request,userId:actor.userId});
  const canonical = characterBuilderCanonicalRequest(prepared);
  const executedReferences=canonical.references.map(reference=>{
    if (reference.kind!=='asset') throw new Error('Builder references must be owned assets.');
    const original=resolved.find(asset=>asset.assetId===reference.assetId);
    if (!original) throw new Error('The prepared Builder original is unavailable.');
    return {...original,slot:reference.slot};
  });
  return {prepared,canonical,referenceFingerprint:studioReferenceFingerprint(executedReferences)};
}

/** Native model defaults remain owned by canonical request normalization. */
export function characterBuilderCanonicalRequest(prepared:ReturnType<typeof prepareCharacterBuilderRequest>) {
  return normalizeGenerationRequest({surface:'image',engineId:prepared.engineId,mode:prepared.inputMode,
    prompt:prepared.prompt,outputCount:1,settings:{aspectRatio:prepared.aspectRatio,resolution:prepared.resolution},
    references:prepared.imageUrls.map((url,slot)=>{
      const image=prepared.request.referenceImages.find(image=>image.url===url);
      if (!image) throw new Error('Builder references must use owned originals.');
      return {kind:'asset',assetId:image.id,role:'reference',slot};
    }),
  });
}
