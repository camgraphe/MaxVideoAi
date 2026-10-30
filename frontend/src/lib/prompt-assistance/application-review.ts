import type {PromptAssistanceDraftContext,PromptAssistanceRequest} from './contract';

/** Full nonsettings identity stays in memory, including local source metadata. */
export type ProposalApplicationContext = {
  compatibilityKey: string;
  settings: PromptAssistanceDraftContext['settings'];
};
export const REVIEWABLE_GENERATION_SETTINGS = ['durationSec','durationOption','numFrames','resolution','aspectRatio','fps','iterations','seedLocked','loop','audio','seed','cameraFixed','safetyChecker','cfgScale','shotType'] as const;
export type ApplicationSettingChange = {key:string;before:unknown;current:unknown};

/** Workspace persistence reconstructs objects; property insertion order is not context identity. */
export function applicationReviewKey(value:unknown):string {
  const sorted=(entry:unknown):unknown=>Array.isArray(entry)?entry.map(sorted):entry&&typeof entry==='object'
    ?Object.fromEntries(Object.entries(entry).filter(([,item])=>item!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,sorted(item)])):entry;
  return JSON.stringify(sorted(value));
}

export function applicationSettingChanges(before:ProposalApplicationContext,current:ProposalApplicationContext):ApplicationSettingChange[] {
  const normalized=(settings:ProposalApplicationContext['settings'])=>{
    const values={...settings},choice=values.durationOption;
    if(choice===undefined||choice===null){delete values.durationOption;return values;}
    // Match only the numeric aliases accepted by the request adapter (including "5s").
    const match=typeof choice==='string'?choice.trim().match(/^(\d+(?:\.\d+)?)s?$/):null;
    const seconds=typeof choice==='number'?choice:match?Number(match[1]):null;
    if(seconds!==null&&(values.durationSec===undefined||values.durationSec===seconds)){
      values.durationSec=seconds;delete values.durationOption;
    }else if(choice==='auto'||choice==='source'){
      values.durationSec=choice;delete values.durationOption;
    }
    // Keep contradictory and unknown selections visible rather than guessing their meaning.
    return values;
  };
  const previous=normalized(before.settings),next=normalized(current.settings);
  return [...new Set([...Object.keys(previous),...Object.keys(next)])].sort()
    .filter(key=>previous[key]!==next[key])
    .map(key=>({key,before:previous[key],current:next[key]}));
}

/** Only the video adapter's known scalar controls are reviewable; unknown/source controls fail closed. */
export function videoPromptReviewKey(context:Record<string,unknown>&{form:object}):string {
  const controls=new Set(['durationSec','durationOption','numFrames','resolution','aspectRatio','fps','iterations','seedLocked','loop','audio','seed','cameraFixed','safetyChecker']);
  return applicationReviewKey({...context,
    form:Object.fromEntries(Object.entries(context.form).filter(([key])=>!controls.has(key))),
    cfgScale:undefined,shotType:undefined,seedValue:undefined,cameraFixedValue:undefined,safetyCheckerValue:undefined,
  });
}

/** The digest can persist; this full compatibility key never leaves memory. */
export function proposalApplicationContext(input:{accountKey?:string;scopeKey:string;reviewKey?:string;live?:PromptAssistanceDraftContext;text:string;target:string;perceptionRevision:number}):ProposalApplicationContext|null {
  if(!input.accountKey||!input.reviewKey||!input.live||input.live.surface!=='video')return null;
  const settings:PromptAssistanceDraftContext['settings']={},other:PromptAssistanceDraftContext['settings']={};
  for(const [key,value] of Object.entries(input.live.settings)){
    if((REVIEWABLE_GENERATION_SETTINGS as readonly string[]).includes(key))settings[key]=value;else other[key]=value;
  }
  return {compatibilityKey:applicationReviewKey({...input,live:{...input.live,settings:other}}),settings};
}

/** Bind cached settings to the original server draft hash, including unreviewable controls. */
export function draftWithReviewSettings(draft:PromptAssistanceRequest['draft'],settings:ProposalApplicationContext['settings']):PromptAssistanceRequest['draft'] {
  return {...draft,settings:{...Object.fromEntries(Object.entries(draft.settings).filter(([key])=>!(REVIEWABLE_GENERATION_SETTINGS as readonly string[]).includes(key))),...settings}};
}
