import assert from 'node:assert/strict';
import test from 'node:test';
import {mountToolFixture} from './helpers/tool-selection-fixture';

const source=`
import {useImageComposerPersistence} from './app/(core)/(workspace)/app/image/_hooks/useImageComposerPersistence';
import {listFalEngines} from './src/config/falEngines';
const config=window.imageCase,entry=listFalEngines().find(x=>x.id===config.engineId),engines=[{id:entry.id,engineCaps:entry.engine,modes:['t2i','i2i'],aliases:[entry.id]}],references=[];
const setters=Object.fromEntries(['EngineId','Mode','Prompt','NumImages','AspectRatio','Resolution','Seed','OutputFormat','Quality','Background','Style','MaskUrl','EnableWebSearch','ThinkingLevel','LimitGenerations','Watermark','ReferenceSlots'].map(name=>['set'+name,noop]));
function App(){const [width,setWidth]=useState(''),[height,setHeight]=useState('');
 const storage=useImageComposerPersistence({...setters,...config,accountId:'owner',engines,prompt:'Synthetic manual prompt',customImageWidth:width,customImageHeight:height,persistableReferenceSlots:references,setCustomImageWidth:setWidth,setCustomImageHeight:setHeight});
 return <output data-ready={storage.storageHydrated}>{width}×{height}</output>;
}`;
const base={mode:'t2i',numImages:1,aspectRatio:'1:1',resolution:'1k',seed:'',outputFormat:null,quality:null,background:null,style:null,maskUrl:'',enableWebSearch:false,thinkingLevel:null,limitGenerations:false,watermark:false};

for(const scenario of [
 {name:'a model without dimension fields keeps them empty',engineId:'nano-banana-2-1',customImageSize:null,want:'×'},
 {name:'a saved custom size remains exact for a model with dimension fields',engineId:'gpt-image-2',resolution:'custom',customImageSize:{width:1536,height:1024},want:'1536×1024'},
 {name:'a supported dimension control still receives its ordinary defaults',engineId:'gpt-image-2',resolution:'custom',customImageSize:null,want:'1024×768'},
])test(scenario.name,async()=>{
 const config={...base,...scenario};
 const f=await mountToolFixture(source,{},w=>{w.imageCase=config;w.localStorage.setItem('maxvideoai.image.composer.v1:owner',JSON.stringify({...config,version:5,prompt:'Synthetic manual prompt',seed:null,referenceSlots:[]}));});
 try{const output=f.w.document.querySelector('output');assert.equal(output.dataset.ready,'true');assert.equal(output.textContent,scenario.want);}finally{await f.close();}
});
