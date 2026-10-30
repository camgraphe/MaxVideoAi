import type {ResponseInputContent} from 'openai/resources/responses/responses';
import type {PromptAssistanceRequest} from '@/lib/prompt-assistance/contract';
import type {StudioAssistantModel} from '@/lib/studio/assistance-contract';
import {resolveStudioMedia,type StudioResolvedMedia} from '@/server/studio/media-resolver';
import type {buildPromptAssistanceContext} from './context';
import {loadPromptReferenceImage} from './reference-images';
import {readPromptReferenceAnalyses} from './reference-analysis';

type Context=Awaited<ReturnType<typeof buildPromptAssistanceContext>>;
type Perception={image?:'provided';analyses?:Awaited<ReturnType<typeof readPromptReferenceAnalyses>>};
export type PerceivedContext=Omit<Context,'references'|'referencePerception'>&{
  references:Array<Context['references'][number]&{perception?:Perception}>;
  referencePerception:'metadata_only'|'provided_content';
};
export async function preparePromptPerception(userId:string,input:PromptAssistanceRequest,model:StudioAssistantModel,context:Context,
  deps:{enabled?:boolean;resolve?:typeof resolveStudioMedia;image?:(media:StudioResolvedMedia,signal:AbortSignal)=>Promise<string>;analyses?:typeof readPromptReferenceAnalyses}={}) {
  const content:ResponseInputContent[]=[];
  const enriched:PerceivedContext={...context,references:context.references.map(ref=>({...ref}))};
  if(!(deps.enabled??process.env.PROMPT_ASSISTANCE_PERCEPTION_ENABLED==='true'))return {context:enriched,content};
  const deadline=AbortSignal.timeout(45_000);let size=0;
  for(const reference of enriched.references){
    const selected=input.draft.references.find(item=>item.fieldId===reference.field&&item.slot===reference.slot);
    if(!selected?.ref)throw new Error('REFERENCE_REATTACH_REQUIRED');
    // Re-resolve ownership at use time; an earlier context or paid analysis grants no new access.
    const media=await(deps.resolve??resolveStudioMedia)(userId,selected.ref);
    if(media.kind==='image'){
      const image=await(deps.image??loadPromptReferenceImage)(media,deadline);size+=image.length;
      if(size>16*1024*1024)throw new Error('REFERENCE_IMAGES_TOO_LARGE');
      content.push({type:'input_text',text:`${reference.label} (${reference.role})`},{type:'input_image',image_url:image,detail:'auto'});
      reference.perception={image:'provided'};
    }else if(model!=='gpt-6-luna') {
      const analyses=await(deps.analyses??readPromptReferenceAnalyses)(userId,input.sessionId,media);
      if(analyses.length)reference.perception={analyses};
    }
  }
  if(enriched.references.some(ref=>ref.perception))enriched.referencePerception='provided_content';
  return {context:enriched,content};
}
