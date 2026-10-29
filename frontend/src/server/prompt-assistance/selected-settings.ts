import type {EngineCaps,Mode} from '@/types/engines';
import type {AgentModelModeDetails} from '@/server/agent-api/types';
import {assistanceSettings} from '@/lib/prompt-assistance/settings';
import {videoInheritsSourceFraming} from '@/lib/video-workflow-capabilities';

type ReferenceFacts={role:string;kind:string;durationSec:number|null;width:number|null;height:number|null};
/** Describe selected controls for writing, not a generation validation or price quote. */
export function selectedPromptSettings(values:object,engine:EngineCaps|undefined,mode:Mode,capabilities:AgentModelModeDetails|undefined,references:ReferenceFacts[]) {
  const settings=assistanceSettings(values);
  if(!engine||!capabilities)return settings;
  const policy=capabilities.durationPolicy;
  settings.durationPolicy=policy;
  if(policy!=='requested') {
    const source=references.find(ref=>ref.role==='source'&&ref.kind===(policy==='source_audio'?'audio':'video'));
    settings.durationSec=source?.durationSec??null;
    settings.durationOption=null;
    delete settings.numFrames;
    delete settings.fps;
  }else if(settings.durationOption==='auto') {
    settings.durationPolicy='automatic';settings.durationSec=null;
  }
  if(videoInheritsSourceFraming(engine,mode)) {
    const source=references.find(ref=>ref.role==='source'&&ref.kind==='video');
    settings.aspectRatio='source';settings.sourceWidth=source?.width??null;settings.sourceHeight=source?.height??null;
  }
  const keepAudio=[...engine.inputSchema?.required??[],...engine.inputSchema?.optional??[]]
    .find(field=>field.id==='keep_audio'&&(!field.modes?.length||field.modes.includes(mode)));
  if(keepAudio) {
    settings.audioPolicy='source';settings.keep_audio=settings.keep_audio??keepAudio.default??null;delete settings.audio;
  }else {
    settings.audioPolicy=capabilities.audio;
    if(capabilities.audio==='unavailable')settings.audio=false;
    else if(capabilities.audio==='always_generated'||settings.voiceControlEnabled===true)settings.audio=true;
  }
  if(engine.id==='seedance-2-5'&&settings.draft===true) {
    settings.finalResolution=settings.resolution??null;settings.resolution='480p';
  }
  return settings;
}
