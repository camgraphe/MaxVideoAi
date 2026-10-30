import {getAgentModelGuidance} from '@/server/agent-api/model-guidance';
import {getAgentModelPromptingSources} from '@/server/agent-api/model-prompting-sources';

// Authored editorial guidance. Capabilities are supplied separately and always win.
const families = [
  {family:'seedance',match:/seedance/,advice:'Describe subject identity, a coherent action progression, camera movement and sound separately. Assign each reference one explicit purpose. Keep source identity and requested changes distinct.',example:'The subject from Image 1 walks through the station as the camera tracks alongside; warm platform light gives way to cool daylight. Footsteps and distant announcements, if audio is enabled.'},
  {family:'kling',match:/kling/,advice:'Keep character identity, subject action and camera action unambiguous. Use only reference bindings supplied by the application. Do not invent a subject, voice ID, multi-shot control or extension capability.',example:'The referenced character pauses at the doorway, then turns toward the window. A slow dolly moves closer; clothing, facial features and room layout stay consistent.'},
  {family:'veo',match:/veo/,advice:'Specify shot, subject, setting, action and camera direction. Separate dialogue, ambience and effects when supported. Frame-to-video instructions describe changes from the supplied frame.',example:'Medium shot at a quiet café. The barista places a cup on the counter; steam rises as the camera gently pushes in. Soft room ambience if audio is enabled.'},
  {family:'gpt-image',match:/gpt-image/,advice:'Specify the intended image use, subject, composition, lighting and exact text when requested. In edits, list what changes and what must remain. Treat references as separately assigned identities or visual guides.',example:'Create a square product photograph with the supplied bottle centered on a matte stone surface. Soft side lighting, ample space above for a headline; preserve the label exactly.'},
  {family:'gemini-image',match:/nano-banana|gemini.*image/,advice:'Use a natural description with concrete relationships between subjects. Assign reference identities and describe precise local edits while preserving the rest of the scene.',example:'Keep the person and pose from Image 1; replace the background with a shaded courtyard in late afternoon. Preserve the clothing and natural skin texture.'},
  {family:'flux',match:/flux/,advice:'Describe visible subject attributes, composition, material and light. For video, distinguish camera and subject motion. Keyframes are application inputs, not extra images invented by the assistant.',example:'A ceramic vase with a visibly uneven glaze on a wooden shelf, close framing, soft window light and a quiet neutral background.'},
  {family:'audio-voice',match:/audio-voice/,advice:'Write only the spoken words in a script proposal. Preserve meaning, language, pronunciation and intended pace. Voice, delivery and speed remain settings. Never insert reference tokens, camera notes or unrequested bracketed stage directions into speech.',example:'Some places stay with us. The light at the window. The sound of a familiar voice.'},
  {family:'audio-music',match:/audio-music|audio-song/,advice:'Describe style, instrumentation, tempo, mood, structure and production texture. Keep lyrics separate from musical direction. Preserve user-authored lyrics unless explicitly asked to edit them.',example:'Intimate acoustic folk with fingerpicked guitar, warm upright bass and a restrained build from verse to chorus; a natural room sound.'},
  {family:'audio-effects',match:/audio-sfx|audio-ambience/,advice:'Describe the audible source, environment, distance, texture and temporal evolution. Distinguish a discrete effect from a continuous ambience; avoid adding music or narration unless asked.',example:'A distant train approaches, passes from left to right with a low mechanical rumble, then fades into a quiet outdoor background.'},
];
export function getPromptAssistanceProfile(engineId:string,mode:string) {
  const selected=families.find(entry=>entry.match.test(engineId));
  return {
    version:'2026-10-29-v1',reviewedAt:'2026-10-29',family:selected?.family??'capability-guided',
    provenance:'MaxVideoAI editorial synthesis; technical capabilities override all examples',
    advice:selected?.advice??'Follow the supplied model capabilities. Build a concrete brief with subject, action or desired sound, setting, composition and relevant constraints. Do not claim undocumented model-specific tricks.',
    example:selected?.example??null,
    operation:['v2v','i2i','reframe'].includes(mode)?'Describe the requested changes and explicit preservation constraints on the source.':mode==='extend'?'Continue the source action and visual continuity; describe the new segment, not a replacement of the original.': ['i2v','fl2v'].includes(mode)?'Describe action and movement from the start frame, preserving the visible scene; respect the end frame if supplied.':'Describe a coherent action or composition; retain useful creative detail without an arbitrary word limit.',
    guidance:getAgentModelGuidance(engineId),
    sources:getAgentModelPromptingSources(engineId).filter(source=>source.modes.includes(mode as never)),
  };
}
