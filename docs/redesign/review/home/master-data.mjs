import {readFile} from 'node:fs/promises';
const root=new URL('../../../../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const [registry,catalog,scoreFile,specFile]=await Promise.all([
 json('frontend/config/model-registry.json'),json('frontend/config/engine-catalog.json'),
 json('data/benchmarks/engine-scores.v1.json'),json('data/benchmarks/engine-key-specs.v1.json')
]);
export const marks={
 hailuo:'minimax/minimax-mark-light.svg',seedance:'bytedance/bytedance-mark-light.svg',
 kling:'kling/kling-mark-light.png',wan:'wan/wan-mark-light.png',ltx:'lightricks/lightricks-mark-light.png',
 veo:'google/google-mark-light.svg',sora:'openai/openai-mark-light.svg',luma:'luma/luma-mark-light.png',
 pika:'pika/pika-mark-light.png',grok:'xai/grok-app-icon.png','happy-horse':'alibaba/alibaba-icon.png',
 'gpt-image':'openai/openai-mark-light.svg','nano-banana':'google/google-mark-light.svg',
 seedream:'bytedance/bytedance-mark-light.svg','luma-uni':'luma/luma-mark-light.png'
};
export const familyLabels={hailuo:'MiniMax',seedance:'Seedance',kling:'Kling',wan:'Wan',ltx:'LTX',veo:'Veo & Gemini',sora:'Sora',luma:'Luma',pika:'Pika',grok:'Grok','happy-horse':'HappyHorse',flux:'FLUX','gpt-image':'GPT Image','nano-banana':'Nano Banana',seedream:'Seedream','luma-uni':'Luma Uni'};
export const models=registry.models.filter(m=>m.publication.model.published&&m.lifecycle==='current').map(m=>{
 const entry=catalog.find(e=>e.engineId===m.id||e.modelSlug===m.slug);
 if(!entry)throw Error('Missing published catalog entry '+m.id);
 return {id:m.id,slug:m.slug,name:entry.marketingName,family:m.family,kind:m.category,mark:marks[m.family]||null,url:'https://maxvideoai.com/models/'+m.slug};
});
export const families=Object.keys(familyLabels).filter(f=>models.some(m=>m.family===f&&m.kind==='video')).map(f=>({id:f,name:familyLabels[f],mark:marks[f]||null,count:models.filter(m=>m.family===f&&m.kind==='video').length}));
export const criteria=[
 {key:'fidelity',label:'Prompt adherence',note:'How closely the result follows the scene and instructions.'},
 {key:'visualQuality',label:'Visual quality',note:'Detail, appearance, artifacts and flicker.'},
 {key:'motion',label:'Motion realism',note:'Movement, physical plausibility and camera behaviour.'},
 {key:'consistency',label:'Temporal consistency',note:'How well subjects and details hold together across frames.'},
 {key:'sequencingQuality',label:'Multi-shot sequencing',note:'Continuity and coherence between shots.'},
 {key:'controllability',label:'Controllability',note:'How effectively a model responds to direction and constraints.'}
];
export const specCriteria=[
 {key:'maxResolution',label:'Resolution',note:'Available output resolutions; settings depend on the selected workflow.'},
 {key:'maxDuration',label:'Duration',note:'Published output duration range or maximum.'},
 {key:'nativeAudioGeneration',label:'Native audio',note:'Availability of generated audio on the MaxVideoAI route.'},
 {key:'referenceImageStyle',label:'Image references',note:'Reference inputs supported by the selected model.'}
];
const pairSpecs=[
 ['minimax-h3-max','seedance-2-5','MiniMax / Seedance','Compare reference workflows, creative control and published output limits.'],
 ['kling-3-pro','seedance-2-5','Kling / Seedance','Camera direction, reference inputs and the look of the shot.'],
 ['ltx-2-5-fast','ltx-2-5-pro','LTX Fast / Pro','Two LTX variants with different output limits and editorial profiles.']
];
export const pairs=pairSpecs.map(([leftId,rightId,label,description])=>{
 const left=models.find(m=>m.id===leftId),right=models.find(m=>m.id===rightId);
 if(!left||!right)throw Error('Unpublished comparison model');
 const policy=registry.models.find(m=>m.id===leftId).publication.compare;
 const reverse=registry.models.find(m=>m.id===rightId).publication.compare;
 if(!policy.published||!reverse.published||!((policy.publishedPairIds||[]).includes(rightId)||(reverse.publishedPairIds||[]).includes(leftId)))throw Error('Unpublished pair '+label);
 const enrich=m=>{
  const score=scoreFile.scores.find(s=>s.modelSlug===m.slug||s.engineId===m.id),spec=specFile.specs.find(s=>s.modelSlug===m.slug||s.engineId===m.id);
  if(!score||!spec)throw Error('Missing comparison evidence '+m.id);
  for(const row of criteria)if(typeof score[row.key]!=='number'||score[row.key]<0||score[row.key]>10)throw Error('Invalid editorial score '+m.id+':'+row.key);
  return {...m,scores:Object.fromEntries(criteria.map(r=>[r.key,score[r.key]])),specs:Object.fromEntries(specCriteria.map(r=>[r.key,spec.keySpecs[r.key]||'Not documented'])),updated:score.last_updated};
 };
 return {left:enrich(left),right:enrich(right),label,description,url:'https://maxvideoai.com/ai-video-engines/'+[left.slug,right.slug].sort().join('-vs-')};
});
export const library={models,families,pairs,criteria,specCriteria,sourceVersion:scoreFile.version};
