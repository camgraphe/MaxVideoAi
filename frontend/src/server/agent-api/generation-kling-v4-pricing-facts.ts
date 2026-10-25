import { klingV4PricingUsage } from '@/lib/kling-v4-pricing';
import type { PricingContext } from '@/lib/pricing-context';
import type { CanonicalGenerationRequest } from './generation-types';
import type { ResolvedReference } from './reference-types';

/** Retain each submitted occurrence, including video subjects. No client metadata supplies usage. */
export function canonicalKlingV4PricingFacts(request:CanonicalGenerationRequest,references:readonly ResolvedReference[]|undefined):Pick<PricingContext,'hasVideoInput'|'inputVideoDurationSec'|'inheritedDurationSec'> {
  if(request.engineId!=='kling-v4')return {};
  let inputVideoDurationSec=0;
  const sources:ResolvedReference[]=[];
  for(const input of request.references){
    if(input.kind!=='asset')throw new Error('Owned Kling V4 references are required.');
    const matches=references?.filter(ref=>ref.assetId===input.assetId&&ref.role===input.role&&ref.slot===input.slot);
    if(matches?.length!==1)throw new Error('Each Kling V4 reference requires exact owned metadata.');
    const ref=matches[0]!;
    if(ref.mediaKind==='video'){
      if(typeof ref.durationSec!=='number'||!Number.isFinite(ref.durationSec)||ref.durationSec<3||ref.durationSec>30.05)throw new Error('Verified Kling V4 video duration is required.');
      inputVideoDurationSec+=ref.durationSec;
      if(input.role==='source')sources.push(ref);
    }
  }
  if(request.mode==='v2v'&&sources.length!==1)throw new Error('One verified Kling V4 source video is required.');
  const inheritedDurationSec=request.mode==='v2v'&&request.settings.durationSec===undefined?sources[0]!.durationSec!:undefined;
  const result={hasVideoInput:inputVideoDurationSec>0,inputVideoDurationSec,...(inheritedDurationSec===undefined?{}:{inheritedDurationSec})};
  klingV4PricingUsage({mode:request.mode as PricingContext['mode'],resolution:String(request.settings.resolution),durationSec:Number(request.settings.durationSec),...result});
  return result;
}
