import {getFalEngineById} from '@/config/falEngines';
import {STUDIO_CONVERSATION_MAX_ATTACHMENTS,STUDIO_CONVERSATION_MAX_REFERENCES} from '@/lib/studio/conversation-creation-contract';

/** Transport capacity follows authored media fields; canonical role/combined validation still applies. */
export function studioGenerationReferenceLimit(modelId:string,surface:string,mode:string):number {
  if(surface!=='video'||!['ref2v','v2v','extend'].includes(mode))return STUDIO_CONVERSATION_MAX_REFERENCES;
  const engine=getFalEngineById(modelId)?.engine;
  const fields=[...(engine?.inputSchema?.required??[]),...(engine?.inputSchema?.optional??[])].filter(field=>!field.modes||field.modes.some(value=>value===mode));
  if (mode === 'v2v' || mode === 'extend') {
    const media = fields.filter(field => ['image', 'video', 'audio'].includes(field.type));
    const capacity = media.reduce((total, field) => total + (field.maxCount ?? 1), 0);
    return Math.min(capacity || STUDIO_CONVERSATION_MAX_ATTACHMENTS, STUDIO_CONVERSATION_MAX_ATTACHMENTS);
  }
  if(!fields.some(field=>field.id==='keyframe_indexes'))return STUDIO_CONVERSATION_MAX_REFERENCES;
  const images=fields.find(field=>field.id==='reference_image_urls'&&field.type==='image');
  return Math.min(images?.maxCount??STUDIO_CONVERSATION_MAX_REFERENCES,STUDIO_CONVERSATION_MAX_ATTACHMENTS);
}
