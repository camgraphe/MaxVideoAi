/** Independent source-field inventory. Slot name, type and cardinality are intentional. */
type Fields=Record<string,readonly string[]>;
const one:Fields={t2v:[],i2v:['image_url:image:1']};
const frames:Fields={...one,i2v:['image_url:image:1','end_image_url:image:1']};
const veo:Fields={...one,ref2v:['image_urls:image:3'],fl2v:['first_frame_url:image:1','last_frame_url:image:1'],extend:['video_url:video:1']};
const luma:Fields={...frames,v2v:['video_url:video:1','image_url:image:1'],reframe:['video_url:video:1','image_url:image:1']};
const kling:Fields={...frames,ref2v:['image_urls:image:4','start_image_url:image:1','end_image_url:image:1'],v2v:['video_url:video:1','image_urls:image:4']};
const seedance=(images:number,videos:number,audios:number):Fields=>({...frames,ref2v:[`image_urls:image:${images}`,`video_urls:video:${videos}`,`audio_urls:audio:${audios}`],v2v:[`image_urls:image:${images}`,'video_url:video:1',`video_urls:video:${videos}`,`audio_urls:audio:${audios}`],extend:[`image_urls:image:${images}`,`extension_source_videos:video:${videos}`,`audio_urls:audio:${audios}`]});
const h3:Fields={t2v:['target_audio_url:audio:1'],i2v:[...frames.i2v,'target_audio_url:audio:1'],ref2v:['reference_image_urls:image:9','reference_video_urls:video:3','reference_audio_urls:audio:3']};
const wan:Fields={t2v:[],i2v:['start_image_url:image:1','end_image_url:image:1'],ref2v:['reference_image_urls:image:10','reference_video_urls:video:5','reference_audio_urls:audio:5'],v2v:['video_url:video:1','reference_image_urls:image:10','reference_audio_urls:audio:5'],extend:['video_url:video:1','reference_image_urls:image:10','reference_audio_urls:audio:5']};
const flux:Fields={...one,fl2v:['start_image_url:image:1','end_image_url:image:1'],extend:['video_url:video:1'],ref2v:['reference_image_urls:image:10'],v2v:['video_url:video:1']};
const audio:Fields={...frames,a2v:['audio_url:audio:1','image_url:image:1']};
export const EXPECTED_VIDEO_SOURCE_FIELDS:Record<string,Fields>={
 'pika-text-to-video':one,'veo-3-1':veo,'veo-3-1-fast':veo,'veo-3-1-lite':{t2v:veo.t2v,i2v:veo.i2v,fl2v:veo.fl2v,extend:veo.extend},
 'gemini-omni-flash':{...one,ref2v:['reference_images:image:10'],fl2v:frames.i2v,v2v:['video_url:video:1'],extend:['video_url:video:1'],retake:[]},
 'lumaRay2':luma,'lumaRay2_flash':luma,'luma-ray-3-2':{...frames,t2v:['keyframe_urls:image:64'],v2v:['video_url:video:1','start_image_url:image:1','edit_keyframe_urls:image:64'],reframe:['video_url:video:1'],extend:[]},
 'kling-2-5-turbo':{...frames,i2i:one.i2v},'kling-2-6-pro':frames,'kling-3-pro':frames,'kling-3-standard':frames,'kling-3-4k':frames,
 'kling-o3-standard':kling,'kling-o3-pro':kling,'kling-o3-4k':{...kling,ref2v:['image_urls:image:7','start_image_url:image:1','end_image_url:image:1']},
 'kling-3-turbo-standard':one,'kling-3-turbo-pro':one,'happy-horse-1-1':{...one,ref2v:['image_urls:image:9']},'happy-horse-1-0':{...one,ref2v:['image_urls:image:9'],v2v:['video_url:video:1','reference_image_urls:image:5']},
 'seedance-2-0':seedance(9,3,3),'seedance-2-0-fast':seedance(9,3,3),'seedance-2-0-mini':seedance(9,3,3),'seedance-2-5':seedance(30,10,10),
 'wan-2-6':{...one,r2v:['video_urls:video:3']},'ltx-2-3-fast':frames,'ltx-2-3':{...audio,extend:['video_url:video:1'],retake:['video_url:video:1'],reframe:['video_url:video:1']},
 'minimax-h3':h3,'minimax-h3-max':{...h3,ref2v:['middle_image_url:image:1','image_url:image:1','end_image_url:image:1',...h3.ref2v],v2v:['video_url:video:1','reference_image_urls:image:4']},
 'minimax-hailuo-02-text':frames,'wan-3':wan,'wan-3-prime':wan,'ltx-2-5-fast':audio,'ltx-2-5-pro':audio,'grok-imagine-video-1-5':{...one,ref2v:['reference_image_urls:image:7']},
 'flux-3':flux,'flux-3-max':{...frames,fl2v:flux.fl2v,ref2v:flux.ref2v},'flux-3-draft':{...flux,v2v:[]},
};
export const EXPECTED_VIDEO_OPERATIONS:Record<string,readonly string[]>={
 'kling-o3-standard':['kling-reference','kling-edit'],'kling-o3-pro':['kling-reference','kling-edit'],'kling-o3-4k':['kling-reference','kling-edit'],
 'luma-ray-3-2':['luma-extend'],'minimax-h3-max':['h3-recast','h3-relight'],
 'ltx-2-3':['ltx23-reframe'],'flux-3':['flux-fast-edit'],'flux-3-draft':['flux-draft-enhance'],
};
