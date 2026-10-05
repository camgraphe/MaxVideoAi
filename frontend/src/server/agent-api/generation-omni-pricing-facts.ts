import {resolveGoogleOmniPricingInput} from '@/lib/google-omni-pricing';
import type {PricingContext} from '@/lib/pricing-context';
import type {CanonicalGenerationRequest} from './generation-types';
import type {ResolvedReference} from './reference-types';

/** Only server-resolved source measurements may supply Omni input tokens or inherited edit timing. */
export function canonicalOmniPricingFacts(request:CanonicalGenerationRequest,resolvedReferences:readonly ResolvedReference[]|undefined):Pick<PricingContext,'inputImageCount'|'inputVideoDurationSec'|'inheritedDurationSec'> {
  if(request.engineId!=='gemini-omni-flash')return {};
  let inputImageCount=0;
  const videos=new Map<string,number>();
  for(const reference of request.references){
    if(reference.kind==='https'){
      if(reference.mediaKind==='video')throw new Error('Owned Omni video measurements are required.');
      if(reference.mediaKind==='image')inputImageCount++;
      continue;
    }
    const matches=resolvedReferences?.filter(resolved=>resolved.assetId===reference.assetId&&resolved.role===reference.role&&resolved.slot===reference.slot);
    if(matches?.length!==1)throw new Error('Each Omni reference requires exact owned metadata.');
    const media=matches[0];
    if(media.mediaKind==='image')inputImageCount++;
    if(media.mediaKind==='video'){
      if(!media.storageUrl||typeof media.durationSec!=='number'||!Number.isFinite(media.durationSec)||media.durationSec<=0)throw new Error('Verified Omni source duration is required.');
      videos.set(media.storageUrl,Math.max(videos.get(media.storageUrl)??0,media.durationSec));
    }
  }
  const sourceMode=request.mode==='v2v'||request.mode==='extend';
  if(sourceMode&&videos.size!==1)throw new Error('One verified Omni source video is required.');
  const inputVideoDurationSec=[...videos.values()].reduce((total,seconds)=>total+seconds,0);
  const inheritedDurationSec=request.mode==='v2v'?inputVideoDurationSec:undefined;
  // Reuse the existing pricing contract; this helper defines no tariff or formula.
  resolveGoogleOmniPricingInput({outputResolution:String(request.settings.resolution),outputDurationSec:Number(request.settings.durationSec),mode:request.mode,inputImageCount,inputVideoDurationSec,...(inheritedDurationSec===undefined?{}:{inheritedDurationSec})});
  return {inputImageCount,inputVideoDurationSec,...(inheritedDurationSec===undefined?{}:{inheritedDurationSec})};
}
