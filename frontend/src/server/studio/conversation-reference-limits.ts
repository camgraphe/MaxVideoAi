import {getFalEngineById} from '@/config/falEngines';
import {STUDIO_CONVERSATION_MAX_ATTACHMENTS,STUDIO_CONVERSATION_MAX_REFERENCES} from '@/lib/studio/conversation-creation-contract';

/** Timed keyframes use their canonical image capacity; existing workflows retain their Studio bound. */
export function studioGenerationReferenceLimit(modelId:string,surface:string,mode:string):number {
  if(surface!=='video'||mode!=='ref2v')return STUDIO_CONVERSATION_MAX_REFERENCES;
  const engine=getFalEngineById(modelId)?.engine;
  const fields=[...(engine?.inputSchema?.required??[]),...(engine?.inputSchema?.optional??[])].filter(field=>!field.modes||field.modes.some(value=>value===mode));
  if(!fields.some(field=>field.id==='keyframe_indexes'))return STUDIO_CONVERSATION_MAX_REFERENCES;
  const images=fields.find(field=>field.id==='reference_image_urls'&&field.type==='image');
  return Math.min(images?.maxCount??STUDIO_CONVERSATION_MAX_REFERENCES,STUDIO_CONVERSATION_MAX_ATTACHMENTS);
}
