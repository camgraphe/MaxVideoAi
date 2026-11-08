import type {ImageDraft,ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import type {CanonicalGenerationRequest} from '@/server/agent-api/generation-types';
import type {AgentPublicGenerationEngine} from '@/server/agent-api/model-catalog';
import type {ResolvedReference} from '@/server/agent-api/reference-types';
import {AgentApiError} from '@/server/agent-api/errors';
import {studioReferenceFingerprint,type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {validateCanonicalGenerationCapabilities} from '@/server/agent-api/generation-capability-validation';
import {imageReferenceFingerprintFromReview,imageRequestFromDraft} from './conversation-image-request';
import {promoteStudioMediaSource,studioPricingSourceSelection,type StudioMotionSourceDependencies} from './conversation-media-generation';
import {validateStudioPreparationInput} from './conversation-preparation-validation';

type PreparedImageRequest={request:CanonicalGenerationRequest;expectedReferenceFingerprint:string};
type ImagePreparationOptions={
  actor:StudioGenerationActor;draft:ImageDraft;input:ImageTurnInput;catalog:AgentPublicGenerationEngine[];
  reviewedReferences:readonly ResolvedReference[];
  resolveReferences(request:CanonicalGenerationRequest):Promise<ResolvedReference[]>;
  sourceDependencies?:StudioMotionSourceDependencies;
};

function fingerprint(references:readonly ResolvedReference[]) {
  return studioReferenceFingerprint(references.map(reference=>({...reference,sizeBytes:reference.sizeBytes??null,originalName:reference.originalName??null})));
}
function requireSameReferences(expected:readonly ResolvedReference[],current:readonly ResolvedReference[]) {
  if(fingerprint(expected)!==fingerprint(current))throw new AgentApiError('REFERENCE_INVALID','The selected image changed after Studio reviewed it. Send a new message to review it again.');
}

/** Read-only preflight; only materialize may save exact owned project outputs for a requested quote. */
export async function validateStudioImageRequest(options:ImagePreparationOptions):Promise<{materialize():Promise<PreparedImageRequest>}> {
  const {actor,draft,input,catalog,reviewedReferences,resolveReferences}=options;
  const selections=draft.image?.references;
  if(!selections?.some(selection=>selection.ref.type==='job-output')) {
    const request=validateStudioPreparationInput(()=>imageRequestFromDraft(draft,input,catalog));
    const expectedReferenceFingerprint=imageReferenceFingerprintFromReview(request,reviewedReferences);
    return {materialize:async()=>({request,expectedReferenceFingerprint})};
  }
  const dependencies=options.sourceDependencies??{};
  const sourceSelection=studioPricingSourceSelection(actor,selections,input,dependencies);
  const aliases=sourceSelection.references.map(reference=>reference.assetId);
  const build=(ids:readonly string[])=>validateStudioPreparationInput(()=>imageRequestFromDraft({
    ...draft,image:{...draft.image!,references:selections.map((selection,index)=>({...selection,
      ref:{type:'asset',kind:'image',assetId:ids[index]}}))},
  },{...input,references:[...new Set([...input.references,...ids.filter((_id,index)=>selections[index].ref.type==='job-output')])]},catalog));
  // Capabilities, selected settings and every attached identity are checked before source I/O or writes.
  const preflight=build(aliases);
  const initial=await sourceSelection.resolveReferences(preflight);
  const attachedRequest={references:preflight.references.filter(reference=>reference.kind==='asset'&&input.references.includes(reference.assetId))};
  const reviewedAttached=attachedRequest.references.map(reference=>{
    const seen=reviewedReferences.find(item=>reference.kind==='asset'&&item.assetId===reference.assetId&&item.mediaKind==='image');
    if(!seen)throw new AgentApiError('REFERENCE_INVALID','Studio has not reviewed this selected image.');
    const facts={...seen};delete facts.slot;
    return {...facts,role:reference.role,...(reference.slot===undefined?{}:{slot:reference.slot})};
  });
  requireSameReferences(reviewedAttached,initial.filter(reference=>input.references.includes(reference.assetId)));
  validateCanonicalGenerationCapabilities(preflight,catalog.find(candidate=>candidate.engine.id===preflight.engineId)!,{resolvedReferences:initial});
  const nativeAliases=new Set(aliases.filter((_id,index)=>selections[index].ref.type==='job-output'));
  const verifyOriginals=async()=>{
    const current=await sourceSelection.resolveReferences(preflight);
    const expected=initial.map(original=>{
      const measured=current.find(reference=>reference.assetId===original.assetId&&reference.role===original.role&&reference.slot===original.slot);
      // Exact-owner, URL-bound saved facts may fill missing bytes after a copy.
      // Every previously known fact and the native original identity stay fixed.
      return nativeAliases.has(original.assetId)&&original.sizeBytes==null?{...original,sizeBytes:measured?.sizeBytes??null}:original;
    });
    requireSameReferences(expected,current);
  };
  return {materialize:async()=>{
    // Validate the entire selection again before the first copy and after all copies.
    await verifyOriginals();
    const promotions=new Map<string,Awaited<ReturnType<typeof promoteStudioMediaSource>>>();
    for(const [index,selection] of selections.entries())if(selection.ref.type==='job-output'&&!promotions.has(aliases[index])) {
      const original=initial.find(reference=>reference.assetId===aliases[index])!;
      promotions.set(aliases[index],await promoteStudioMediaSource(actor,selection.ref,dependencies,original,true));
    }
    await verifyOriginals();
    const request=build(aliases.map(alias=>promotions.get(alias)?.assetId??alias));
    const current=await resolveReferences(request);
    const expected=request.references.map(reference=>{
      const original=initial.find(item=>(promotions.get(item.assetId)?.assetId??item.assetId)===(reference.kind==='asset'?reference.assetId:'')
        &&item.role===reference.role&&item.slot===reference.slot);
      if(!original)throw new AgentApiError('REFERENCE_INVALID','The selected image identity is unavailable.');
      const promoted=promotions.get(original.assetId)?.promoted;
      const measured=current.find(item=>reference.kind==='asset'&&item.assetId===reference.assetId&&item.role===reference.role&&item.slot===reference.slot);
      return {...original,assetId:reference.kind==='asset'?reference.assetId:original.assetId,...(promoted??{}),
        // Saving an exact original may measure previously unknown bytes.
        ...(promoted&&original.sizeBytes==null?{sizeBytes:measured?.sizeBytes??null}:{})};
    });
    requireSameReferences(expected,current);
    return {request,expectedReferenceFingerprint:studioReferenceFingerprint(current)};
  }};
}
