import type {EngineCaps,EngineInputField,Mode} from '@/types/engines';
import {getWorkspaceFrameCommand} from '@/components/composer/workspace-reference-commands';
import {getVideoWorkflowSourceField,isVideoSourceWorkflow} from '@/lib/video-source-workflow';

export function assistanceReferenceRole(engine:EngineCaps,field:EngineInputField,mode?:Mode) {
  if(mode&&(isVideoSourceWorkflow(mode)||mode==='retake')&&getVideoWorkflowSourceField(engine.inputSchema,mode)?.id===field.id)return 'source' as const;
  if(mode==='a2v'&&field.type==='audio')return 'source' as const;
  if(field.id==='mask_url')return 'mask' as const;
  return getWorkspaceFrameCommand({field,required:false,role:mode==='i2i'||mode==='v2v'||mode==='ref2v'?'reference':undefined},engine)??'reference';
}
