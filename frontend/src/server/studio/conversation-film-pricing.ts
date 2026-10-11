import type {GenerationPriceComparisonInput,GenerationPriceComparison,GenerationPriceOption} from '@/server/agent-api/generation-price-comparison';
import type {StudioPriceComparison,StudioFilmPricePlan} from '@/lib/studio/conversation-pricing-contract';
import {customerDisplayPrice} from '@/lib/customer-price-presentation';
import {AgentApiError} from '@/server/agent-api/errors';
import {projectAgentModelModeDetails} from '@/server/agent-api/model-details';
import type {AgentPublicGenerationEngine} from '@/server/agent-api/model-catalog';

type PricingReader={compare(input:GenerationPriceComparisonInput):Promise<GenerationPriceComparison>;catalog?():Promise<AgentPublicGenerationEngine[]>};

async function filmDurations(input:GenerationPriceComparisonInput,total:number,service:PricingReader):Promise<number[]> {
  const fixed=input.settings?.durationSec;
  if(typeof fixed==='number'&&fixed!==total)return [fixed];
  const preferred=[...new Set([Math.min(10,total),Math.min(20,total),Math.min(30,total)])];
  if(!service.catalog)return preferred;
  const catalog=(await service.catalog()).filter(candidate=>candidate.publicModes.includes(input.mode)
    &&(!input.candidateModelIds||input.candidateModelIds.includes(candidate.engine.id)));
  const caps=catalog.flatMap(candidate=>{
    try {const duration=projectAgentModelModeDetails(candidate,input.mode).duration;return duration?[duration]:[];}
    catch(error){if(!(error instanceof AgentApiError))throw error;return [];}
  });
  const supports=(seconds:number)=>caps.some(cap=>cap.options?cap.options.includes(seconds):cap.range&&seconds>=cap.range.min&&seconds<=cap.range.max);
  const choices=preferred.filter(supports);
  const alternatives=[...new Set(caps.flatMap(cap=>cap.options?[...cap.options]:cap.range?[Math.min(total,cap.range.max),cap.range.min]:[]))]
    .filter(seconds=>seconds>0&&seconds<=total&&!choices.includes(seconds)&&supports(seconds)).sort((a,b)=>b-a);
  return [...choices,...alternatives].slice(0,3);
}

/** Bounded read-only plans. Every generated component keeps canonical customer-cent pricing. */
export async function priceStudioFilm(input:GenerationPriceComparisonInput,totalDurationSec:number,service:PricingReader):Promise<StudioPriceComparison> {
  if(input.surface!=='video'||input.mode!=='t2v'&&input.mode!=='i2v'||!(totalDurationSec>0&&totalDurationSec<=1200))
    throw new AgentApiError('PARAMETER_INVALID','Multi-clip planning supports new text/image-to-video films up to 1200 seconds. Keep source edits and extensions on their exact source workflow.');
  const settings={...input.settings};
  delete settings.durationSec;
  // A useful film baseline; explicit settings always take precedence.
  if(settings.resolution==null)settings.resolution='720p';
  if(settings.aspectRatio==null&&!input.references.length)settings.aspectRatio='16:9';
  const durations=await filmDurations(input,totalDurationSec,service);
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
