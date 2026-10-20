import { AgentApiError } from '@/server/agent-api/errors';
import { isCreatorLipVideoEnabled, isCreatorMotionControlEnabled, type PreparedCreatorProfile } from './creator-profiles';
import { CREATOR_LIP_SYNC_ENDPOINT, prepareCreatorLipSyncProvider, quoteCreatorLipSync } from './creator-profiles-lipsync';
import { CREATOR_MOTION_ENDPOINT, prepareCreatorMotionProvider, quoteCreatorMotion } from './creator-profiles-motion';

// Only these authored tool profiles can select a provider endpoint or billing domain.
const profiles = {
  'lip-video-latentsync-v1': { engineId:'toolbox-lip-sync',label:'Lip Sync · LatentSync',endpoint:CREATOR_LIP_SYNC_ENDPOINT,isEnabled:isCreatorLipVideoEnabled,prepare:prepareCreatorLipSyncProvider,quote:quoteCreatorLipSync },
  'motion-kling-v3-v1': { engineId:'toolbox-motion-control',label:'Motion Transfer · Kling V3',endpoint:CREATOR_MOTION_ENDPOINT,isEnabled:isCreatorMotionControlEnabled,prepare:prepareCreatorMotionProvider,quote:quoteCreatorMotion },
} as const;
export function creatorSpecialistProfile(id:string) {
  if(!Object.hasOwn(profiles,id))throw new AgentApiError('ENGINE_UNAVAILABLE','This specialist profile requires qualification.');
  return profiles[id as keyof typeof profiles];
}
export function prepareCreatorSpecialistProvider(prepared:PreparedCreatorProfile){return creatorSpecialistProfile(prepared.profile.id).prepare(prepared);}
export type CreatorSpecialistRequest=ReturnType<typeof prepareCreatorSpecialistProvider>;
export const isCreatorSpecialistProfile=(id:string)=>Object.hasOwn(profiles,id);
export const isCreatorSpecialistEndpoint=(endpoint:string)=>Object.values(profiles).some(profile=>profile.endpoint===endpoint);
