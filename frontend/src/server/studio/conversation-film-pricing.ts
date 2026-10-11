import type {GenerationPriceComparisonInput,GenerationPriceComparison,GenerationPriceOption} from '@/server/agent-api/generation-price-comparison';
import type {StudioPriceComparison,StudioFilmPricePlan} from '@/lib/studio/conversation-pricing-contract';
import {customerDisplayPrice} from '@/lib/customer-price-presentation';
import {AgentApiError} from '@/server/agent-api/errors';

type PricingReader={compare(input:GenerationPriceComparisonInput):Promise<GenerationPriceComparison>};

/** Bounded read-only plans. Every generated component keeps canonical customer-cent pricing. */
export async function priceStudioFilm(input:GenerationPriceComparisonInput,totalDurationSec:number,service:PricingReader):Promise<StudioPriceComparison> {
  if(input.surface!=='video'||input.mode!=='t2v'&&input.mode!=='i2v'||!(totalDurationSec>0&&totalDurationSec<=1200))
    throw new AgentApiError('PARAMETER_INVALID','Multi-clip planning supports new text/image-to-video films up to 1200 seconds. Keep source edits and extensions on their exact source workflow.');
  const settings={...input.settings};
  delete settings.durationSec;
  // A useful film baseline; explicit settings always take precedence.
  if(settings.resolution==null)settings.resolution='720p';
  if(settings.aspectRatio==null&&!input.references.length)settings.aspectRatio='16:9';
  const durations=[...new Set([Math.min(10,totalDurationSec),Math.min(20,totalDurationSec),Math.min(30,totalDurationSec)])];
  const results=await Promise.allSettled(durations.map(durationSec=>service.compare({...input,settings:{...settings,durationSec}})));
  const plans:StudioFilmPricePlan[]=[];
  let estimatedAt='';
  let lastError:unknown;
  const unavailable:GenerationPriceComparison['unavailable']=[];
  for(let index=0;index<results.length;index++){
    const result=results[index];
    if(result.status==='rejected'){lastError=result.reason;continue;}
    estimatedAt=result.value.estimatedAt;
    unavailable.push(...result.value.unavailable);
    const duration=durations[index];
    for(const clip of result.value.options){
      if(clip.outputDurationSec!==duration)continue;
      const fullClipCount=Math.floor(totalDurationSec/duration);
      const tailUsedSec=Math.round((totalDurationSec-fullClipCount*duration)*1000)/1000;
      let tail:GenerationPriceOption|null=null;
      if(tailUsedSec>0){
        try {
          const tailResult=await service.compare({...input,candidateModelIds:[clip.modelId],baselineModelId:undefined,baselineSettings:undefined,
            settings:{...clip.settings,durationSec:tailUsedSec}});
          tail=tailResult.options.find(option=>option.modelId===clip.modelId&&option.price.currency===clip.price.currency&&option.outputDurationSec===tailUsedSec)??null;
        } catch(error){
          // Only a proven unsupported duration permits a priced full clip to be trimmed.
          if(!(error instanceof AgentApiError&&error.nextAction?.type==='generation_comparison'&&error.nextAction.durationMismatch))continue;
          tail=clip;
        }
        if(!tail)continue;
      }
      const amountCents=fullClipCount*clip.price.amountCents+(tail?.price.amountCents??0);
      if(!Number.isSafeInteger(amountCents))continue;
      plans.push({clip,fullClipCount,tail,tailUsedSec,totalDurationSec,
        generatedDurationSec:fullClipCount*duration+(tail?.outputDurationSec??0),price:customerDisplayPrice(amountCents,clip.price.currency)});
      break; // One verified model per distinct cut, rather than nine near-identical alternatives.
    }
  }
  if(!plans.length)throw lastError instanceof AgentApiError?lastError:new AgentApiError('ENGINE_UNAVAILABLE','No complete film plan could be priced for all requested constraints. No quote or generation was created.');
  return {options:[],baseline:null,unavailable:unavailable.slice(0,12),estimatedAt,quoteRequired:true,filmDurationSec:totalDurationSec,filmPlans:plans};
}
