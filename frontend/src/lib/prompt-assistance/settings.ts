import type {PromptAssistanceDraftContext} from './contract';
import type {EngineCaps, Mode} from '@/types/engines';
import {withoutRetiredOutputControls} from '@/lib/generation-output-policy';

/** Media identity and companion text have separate, explicit context owners. */
export function assistanceSettings(values:object):PromptAssistanceDraftContext['settings'] {
  return Object.fromEntries(Object.entries(values).filter(([key,value])=>
    !/url|token|secret|password|account|userId|^(prompt|script|lyrics|negativePrompt|source_job_id|source_output_id|previous_interaction_id)$/i.test(key)
    && /^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(key)
    && (value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<=5000)));
}

/** Flatten only authored controls for the current operation; saved inactive controls stay local. */
export function composerAssistanceSettings(engine:EngineCaps,mode:Mode,values:Record<string,unknown> & {extraInputValues?:Record<string,unknown>}):PromptAssistanceDraftContext['settings'] {
  const {extraInputValues={},...stored}=values;
  // form.mode can be the manual Create mode while the submitted mode is inferred from references.
  const base=Object.fromEntries(Object.entries(stored).filter(([key])=>key!=='engineId'&&key!=='mode'));
  const fields=[...engine.inputSchema?.required??[],...engine.inputSchema?.optional??[]]
    .filter(field=>!['image','video','audio'].includes(field.type)&&(!field.modes?.length||field.modes.includes(mode)));
  const extra=Object.fromEntries(Object.entries(withoutRetiredOutputControls(extraInputValues)).flatMap(([key,value])=>{
    if(!fields.some(field=>field.id===key))return [];
    // Keyframe positions are authored scalar-list controls, not arbitrary nested data/URLs.
    if(['keyframe_indexes','edit_keyframe_indexes'].includes(key)&&Array.isArray(value)&&value.length<=100&&value.every(item=>typeof item==='number'&&Number.isFinite(item)))return [[key,JSON.stringify(value)]];
    return [[key,value]];
  }));
  return assistanceSettings({...extra,...base});
}
