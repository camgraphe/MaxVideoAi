import type { CreatorOperationInput, CreatorSourceInput, CreatorProfileDescriptor } from '@/lib/toolbox/creator-tools';
import type { ToolAssetRef } from '@/lib/toolbox/contract';
import type { CanonicalGenerationRequest, CanonicalGenerationReference } from '@/server/agent-api/generation-types';
import { normalizeGenerationRequest } from '@/server/agent-api/generation-normalization';
import { AgentApiError } from '@/server/agent-api/errors';
class CreatorProfileError extends AgentApiError { constructor(message:string){super('PARAMETER_INVALID',message);} }

export type CreatorMediaFacts = { kind: 'image' | 'video' | 'audio'; width: number | null; height: number | null; durationSec: number | null; fps: number | null; hasAudio: boolean; sizeBytes: number; mimeType: string; audioDurationSec?:number|null; audioStartSec?:number|null };
export type CreatorResolvedSource = { input: CreatorSourceInput; asset: Extract<ToolAssetRef, { type: 'asset' }>; url: string; facts: CreatorMediaFacts; fingerprint: string };
export type CreatorProfile = CreatorProfileDescriptor;
export const isCreatorLipVideoEnabled=()=>process.env.CREATOR_LIP_VIDEO_ENABLED==='1';
export const isCreatorMotionControlEnabled=()=>process.env.CREATOR_MOTION_CONTROL_ENABLED==='1';
export type PreparedCreatorProfile = { input: CreatorOperationInput; profile: CreatorProfile; sources: CreatorResolvedSource[]; request: CanonicalGenerationRequest; expectedDurationSec: number | null; audioPolicy: 'preserve' | 'mute'; audioSourceRole: 'source' | 'audio' | 'motion' | null };

export const CREATOR_PROFILES: readonly CreatorProfile[] = [
  { toolId:'product-photo-editor',constraints:{sourceKinds:['image'],audioPolicies:[],resolution:'selectable',pixelPreservation:false},id: 'product-photo-gpt-v1', revision: 1, qualification: 'canonical', disclosure: 'Generative image editing. Appearance preservation is instructed; unchanged pixels are not guaranteed.' },
  { toolId:'product-photo-editor',constraints:{sourceKinds:['image'],audioPolicies:[],resolution:'selectable',pixelPreservation:false},id: 'product-photo-nano-v1', revision: 1, qualification: 'canonical', disclosure: 'Generative image editing. Appearance preservation is instructed; unchanged pixels are not guaranteed.' },
  { toolId:'lip-sync',constraints:{sourceKinds:['image','audio'],duration:{min:2,max:20,wholeSeconds:false},audioPolicies:['preserve'],resolution:'provider',maxSourceBytes:104857600},id: 'lip-photo-ltx-v1', revision: 1, qualification: 'canonical', disclosure: 'LTX audio-driven portrait animation. Mouth accuracy has not been benchmarked. Selected audio is preserved; export may encode it as AAC.' },
  { toolId:'lip-sync',constraints:{sourceKinds:['video','audio'],duration:{min:2,max:20,wholeSeconds:false,matchingAudioVideo:true},audioPolicies:['preserve'],resolution:'provider',acceptsInstruction:false,maxSourceBytes:104857600},id: 'lip-video-latentsync-v1', revision: 1, qualification: 'tool-specific', disclosure: 'LatentSync video lip synchronization uses matching explicit segments. Release requires qualification; mouth fidelity and account billing have not been benchmarked. Selected sound may be encoded as AAC.' },
  { toolId:'product-video-editor',constraints:{sourceKinds:['video'],duration:{min:2,max:15,wholeSeconds:true},audioPolicies:['preserve','mute'],resolution:'selectable',minVideoFps:16,maxSourceBytes:104857600},id: 'product-video-wan-v1', revision: 1, qualification: 'canonical', disclosure: 'Wan video editing uses a continuous source segment. Visual fidelity has not been benchmarked. Preserved audio may be encoded as AAC.' },
  { toolId:'motion-transfer',constraints:{sourceKinds:['image','video'],duration:{min:2,max:15,wholeSeconds:true},audioPolicies:['preserve','mute'],resolution:'selectable',minVideoFps:16,maxSourceBytes:104857600},id: 'motion-wan-reference-v1', revision: 1, qualification: 'canonical', disclosure: 'Wan uses image and video reference guidance. This is not specialized motion control and exact movement transfer is not guaranteed. Preserved audio may be encoded as AAC.' },
  { toolId:'motion-transfer',constraints:{sourceKinds:['image','video'],duration:{min:2,max:30,wholeSeconds:false,maxByOrientation:{image:10,video:30}},audioPolicies:['preserve','mute'],resolution:'provider',maxSourceBytes:104857600},id: 'motion-kling-v3-v1', revision: 1, qualification: 'tool-specific', disclosure: 'Kling V3 Standard Motion Control uses the chosen character orientation and explicit performance segment. Release requires qualification; transfer quality and account billing have not been benchmarked. Preserved sound may be encoded as AAC.' },
];
export function listCreatorToolProfiles(options:{enabled?:boolean}={}) {
  return CREATOR_PROFILES.map(profile=>({...profile,deploymentGateOpen:options.enabled!==false&&profile.qualification!=='closed'&&(profile.id==='lip-video-latentsync-v1'?isCreatorLipVideoEnabled():profile.id==='motion-kling-v3-v1'?isCreatorMotionControlEnabled():true)}));
}
function duration(source: CreatorResolvedSource, min: number, max: number): number {
  const value = source.facts.durationSec;
  if (value == null || !Number.isFinite(value) || value < min || value > max) throw new CreatorProfileError(`Choose an explicit segment between ${min} and ${max} seconds.`);
  return value;
}
function wanDuration(source: CreatorResolvedSource): number {
  const value = duration(source, 2, 15);
  // Codec timing jitter is allowed only within one millisecond; no whole-second rounding of real content.
  if (Math.abs(value - Math.round(value)) > 0.001) throw new CreatorProfileError('Wan requires a whole-second segment. Choose explicit start and end times.');
  if (!source.facts.fps || source.facts.fps < 16 || source.facts.sizeBytes > 100 * 1024 * 1024) throw new CreatorProfileError('Wan source must be at least 16 fps and at most 100 MB.');
  return Math.round(value);
}
export function prepareCreatorProfile(input: CreatorOperationInput, sources: CreatorResolvedSource[]): PreparedCreatorProfile {
  const source = (role: CreatorSourceInput['role']) => { const found = sources.find(entry => entry.input.role === role); if (!found) throw new CreatorProfileError(`Missing ${role} source.`); return found; };
  const ref = (role: CreatorSourceInput['role'], mappedRole: CanonicalGenerationReference['role']): CanonicalGenerationReference => ({ kind: 'asset', assetId: source(role).asset.assetId, role: mappedRole });
  let profileId: string;
  let request: CanonicalGenerationRequest = { schemaVersion: 1, surface: 'video', engineId: '', mode: 'v2v', prompt: '', settings: {}, references: [], outputCount: 1 };
  let expectedDurationSec: number | null = null;
  let audioPolicy: 'preserve' | 'mute' = 'mute';
  let audioSourceRole: PreparedCreatorProfile['audioSourceRole'] = null;
  if (input.toolId === 'product-photo-editor') {
    if (input.settings.preservation === 'pixels') throw new AgentApiError('ENGINE_UNAVAILABLE','Pixel preservation requires a qualified deterministic mask compositor; this profile is unavailable.');
    if (sources.some(entry => entry.input.role === 'mask')) throw new AgentApiError('ENGINE_UNAVAILABLE','Masked editing requires qualification; use appearance preservation without a mask.');
    profileId = input.settings.model === 'nano-banana-2' ? 'product-photo-nano-v1' : 'product-photo-gpt-v1';
    const resolution = ({ auto: 'auto', '1:1': 'square_hd', '4:3': 'landscape_4_3', '3:4': 'portrait_4_3', '16:9': 'landscape_16_9', '9:16': 'portrait_16_9' } as const)[input.settings.aspectRatio];
    request = { ...request, surface: 'image', engineId: input.settings.model, mode: 'i2i', prompt: `Create a product ${input.settings.action} photograph. Preserve the product's shape, branding, text, materials and colors. ${input.settings.instruction}`, settings: input.settings.model === 'nano-banana-2' ? { aspectRatio: input.settings.aspectRatio, resolution: '1k' } : { aspectRatio: input.settings.aspectRatio, quality: 'medium', resolution, outputFormat: 'png' }, references: [ref('source', 'source'), ...(sources.some(entry => entry.input.role === 'style') ? [ref('style', 'reference')] : [])] };
  } else if (input.toolId === 'lip-sync') {
    const audio = source('audio');
    expectedDurationSec = duration(audio, 2, 20);
    if (!audio.facts.hasAudio) throw new CreatorProfileError('The selected audio has no audio stream.');
    if (input.settings.mode === 'video') {
      if(input.settings.instruction)throw new CreatorProfileError('Video Lip Sync does not accept a text instruction. The selected audio controls speech.');
      const videoDuration=duration(source('source'),2,20);
      if (Math.abs(videoDuration - expectedDurationSec) > 0.001 || expectedDurationSec>videoDuration) throw new CreatorProfileError('Video and audio must have the same duration. Select explicit matching segments.');
      if(!isCreatorLipVideoEnabled())throw new AgentApiError('ENGINE_UNAVAILABLE',CREATOR_PROFILES.find(entry => entry.id === 'lip-video-latentsync-v1')!.disclosure);
      profileId='lip-video-latentsync-v1';
      request={...request,engineId:'toolbox-lip-sync',mode:'v2v',prompt:'Synchronize the selected video to the selected audio without changing its timing.',settings:{durationSec:Math.ceil(expectedDurationSec)},references:[ref('source','source'),ref('audio','reference')]};
    } else {
      profileId = 'lip-photo-ltx-v1';
      // The canonical envelope requires ceil(audio duration); LTX a2v billing/provider use the exact measured audio.
      request = { ...request, engineId: 'ltx-2-5-fast', mode: 'a2v', prompt: `Animate this portrait speaking naturally to the supplied audio. Preserve identity and framing. ${input.settings.instruction}`, settings: { durationSec: Math.ceil(expectedDurationSec), resolution: '1080p', aspectRatio: 'auto' }, references: [ref('audio', 'source'), ref('source', 'first_frame')] };
    }
    audioPolicy = 'preserve'; audioSourceRole = 'audio';
  } else {
    const motion = input.toolId === 'motion-transfer';
    const videoRole = motion ? 'motion' : 'source';
    const video = source(videoRole);
    const specialist=motion&&(input.profileId==='motion-kling-v3-v1'||(!input.profileId&&isCreatorMotionControlEnabled()));
    if(specialist&&input.settings.resolution!=='720p')throw new CreatorProfileError('Kling Motion Control chooses output resolution; no resolution override is supported.');
    if(specialist&&!isCreatorMotionControlEnabled())throw new AgentApiError('ENGINE_UNAVAILABLE','Kling Motion Control requires qualification before activation.');
    expectedDurationSec = specialist?duration(video,2,input.settings.orientation==='image'?10:30):wanDuration(video);
    audioPolicy = input.settings.audioPolicy; audioSourceRole = audioPolicy === 'preserve' && video.facts.hasAudio ? videoRole : null;
    if (audioPolicy === 'preserve' && !video.facts.hasAudio) audioPolicy = 'mute';
    profileId = specialist?'motion-kling-v3-v1':motion ? 'motion-wan-reference-v1' : 'product-video-wan-v1';
    const ratioSource = motion && input.settings.orientation === 'image' ? source('source') : video;
    const ratio = (ratioSource.facts.width ?? 1) / (ratioSource.facts.height ?? 1);
    const aspect = motion?(['16:9','4:3','1:1','3:4','9:16'] as const).reduce((best,candidate)=>{const [w,h]=candidate.split(':').map(Number);const [bw,bh]=best.split(':').map(Number);return Math.abs(ratio-w/h)<Math.abs(ratio-bw/bh)?candidate:best;},'1:1'):'auto';
    if(specialist) request={...request,engineId:'toolbox-motion-control',mode:'ref2v',prompt:`Transfer movement to the character image using ${input.settings.orientation} orientation. ${input.settings.instruction}`,settings:{durationSec:Math.ceil(expectedDurationSec),audio:audioPolicy==='preserve'},references:[ref('source','reference'),ref('motion','reference')]};
    else request = { ...request, engineId: 'wan-3', mode: motion ? 'ref2v' : 'v2v', prompt: motion ? `Use the character in image reference 1 and the movement in video reference 1. Preserve character identity. ${input.settings.instruction}` : `Edit only the requested ${input.settings.action}; preserve the product, branding, text, motion, framing and timing. ${input.settings.instruction}`, settings: { durationSec: expectedDurationSec, resolution: input.settings.resolution, aspectRatio: aspect, audio: false }, references: motion ? [ref('source', 'reference'), ref('motion', 'reference')] : [ref('source', 'source')] };
  }
  const profile = CREATOR_PROFILES.find(entry => entry.id === (input.profileId ?? profileId));
  if (!profile || profile.qualification === 'closed') throw new AgentApiError('ENGINE_UNAVAILABLE',profile?.disclosure ?? 'Profile requires qualification.');
  if (profile.id !== profileId) throw new CreatorProfileError('The selected profile does not match these tool settings.');
  if(audioSourceRole) {
    const audio=source(audioSourceRole).facts;
    if(audio.audioDurationSec==null||Math.abs(audio.audioDurationSec-expectedDurationSec!)>0.04||audio.audioStartSec==null||Math.abs(audio.audioStartSec)>0.025) throw new CreatorProfileError('The selected audio must cover the complete segment from its start. Choose matching explicit segments.');
  }
  return { input:{...input,profileId:profile.id}, profile, sources, request:normalizeGenerationRequest(request), expectedDurationSec, audioPolicy, audioSourceRole };
}
