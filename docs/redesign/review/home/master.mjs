import {writeFile} from 'node:fs/promises';
import {renderReview} from './rebuild.mjs';
import {library} from './master-data.mjs';
import {modelNetwork,catalogDialog,compareSection,connectSection,link,arrow} from './master-sections.mjs';

const base=await renderReview('en');
function between(start,end){
 const a=base.indexOf(start),b=base.indexOf(end,a+start.length);
 if(a<0||b<0)throw Error('Review section boundary changed: '+start);
 return base.slice(a,b);
}
const guides=between('<section class="guides','<section class="angle-section')
 .replace('id="models"','id="use-cases"')
 .replace('01 / FIND YOUR STARTING POINT','03 / FIND YOUR STARTING POINT');
const angle=between('<section class="angle-section','<section class="image-tools').replace('02 / DIRECT THE IMAGE','ANGLE / MOTION STUDY');
let imageTools=between('<section class="image-tools','<section class="assistant-section').replace('id="images"','id="tools"');
const angleTool=link('https://maxvideoai.com/tools/angle','<span class="tool-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="10" ry="5"/><path d="M17 3v5h5M7 21v-5H2"/><circle cx="12" cy="12" r="2"/></svg></span><span><h3>Angle</h3><p>Explore another point of view from one image.</p></span>'+arrow);
imageTools=imageTools.replace('<div class="image-models">',angleTool+'<div class="image-models">');
let html=base.slice(0,base.indexOf('<div class="provider-line">'))
 +modelNetwork()+'\n</section>\n'+compareSection()+'\n'+connectSection()+'\n'
 +guides+imageTools+base.slice(base.indexOf('<section class="pricing'));
const nav=link('#model-library','Models')+link('#compare','Compare')+link('https://maxvideoai.com/examples','Examples')+link('#connect','Connect')+link('#tools','Tools')+link('#pricing','Pricing');
html=html.replace(/(<header class="header shell">[\s\S]*?<nav[^>]*>)[\s\S]*?(<\/nav>)/,(m,a,b)=>a+nav+b)
 .replace(/(<dialog id="menu-dialog"[\s\S]*?<nav>)[\s\S]*?(<\/nav>)/,(m,a,b)=>a+nav+b)
 .replace(/<select id="language"[\s\S]*?<\/select>/,'<span class="master-language" aria-label="Language: English">EN</span>')
 .replace(/<div class="review-bar"><span>[\s\S]*?<\/span>/,'<div class="review-bar"><span>English master · 04 <i>· LOCAL REVIEW</i></span>')
 .replace('<link rel="stylesheet" href="home/rebuild.css">','<link rel="stylesheet" href="home/rebuild.css"><link rel="stylesheet" href="home/master.css">')
 .replace('src="home/rebuild.client.mjs"','src="home/master.client.mjs"')
 .replace('<dialog id="menu-dialog"',catalogDialog()+'\n<dialog id="menu-dialog"')
 .replace(/(<dialog id="mobile-dialog"[\s\S]*?<nav>)[\s\S]*?(<\/nav>)/,(m,a,b)=>a+[['hero','Results'],['compare','Compare'],['connect','Connect'],['tools','Tools'],['pricing','Pricing']].map(([id,label])=>' <button data-preview-section="'+id+'">'+label+'</button>').join('')+b);
html=html.replace('<iframe id="mobile-frame"','<label class="preview-step-control" id="preview-connect-control" hidden>Connect step <select id="preview-connect-step"><option value="0">01 · Context</option><option value="1">02 · Plan</option><option value="2">03 · Result</option></select></label><iframe id="mobile-frame"');
html=html.replace(/(<script id="page-data" type="application\/json">)([\s\S]*?)(<\/script>)/,(m,a,json,b)=>{
 const data=JSON.parse(json);delete data.angleSources;
 data.library={pairs:library.pairs,criteria:library.criteria,specCriteria:library.specCriteria};
 data.copy=Object.fromEntries(['cost','costNote','mcpProof','mcpProofNote','motionOn','reduced','error','loading','mute','pause','play','sound'].map(key=>[key,data.copy[key]]));
 return a+JSON.stringify(data).replace(/</g,'\\u003c')+b;
});
const faqEnd=html.indexOf('</div></section>',html.indexOf('<section class="faq'));
html=html.slice(0,faqEnd)+'<details><summary>Can I create AI videos with Claude, ChatGPT or Codex?<span>+</span></summary><p>Yes. Connect your assistant to MaxVideoAI through MCP. It can prepare a generation request, compare suitable models and show a quote for your settings. You approve the paid generation, then receive the result in the conversation and your MaxVideoAI library. <a href="https://maxvideoai.com/mcp" target="_blank" rel="noopener">See how to connect your assistant.</a></p></details>'+html.slice(faqEnd);
html=html.replace(/<title>[^<]*<\/title>/,'<title>AI Video Generator, Model Comparisons & Assistant Workflows | MaxVideoAI — English master</title>');
await writeFile(new URL('../home-en.html',import.meta.url),html+'\n');
const angleData=JSON.parse(base.match(/<script id="page-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
await writeFile(new URL('../angle-en.html',import.meta.url),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Angle — motion study</title><link rel="stylesheet" href="home/rebuild.css"></head><body><div class="review-bar"><a href="home-en.html">← English homepage</a><span>Angle / retained motion study</span><button id="motion-toggle" aria-pressed="false">Reduce motion</button></div><main>'+angle+'</main><script id="page-data" type="application/json">'+JSON.stringify({copy:angleData.copy,angleSources:angleData.angleSources}).replace(/</g,'\\u003c')+'</script><script type="module" src="home/angle.client.mjs"></script></body></html>\n');
console.log('Built English master 04 and retained Angle study. FR/ES remain archived proposition 03.');
