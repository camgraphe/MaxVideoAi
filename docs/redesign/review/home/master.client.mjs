import {initMasterInteractions} from './master-interactions.mjs';
import {createHeroPlayer} from './playback.mjs';
const data=JSON.parse(document.querySelector('#page-data').textContent),c=data.copy;
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion:reduce)'),compact=matchMedia('(max-width:900px)'),short=matchMedia('(max-height:650px)');
const embedded=new URL(location.href).searchParams.has('phone');
if(embedded)root.classList.add('phone');
let selected=0,manualReduced=false;
const motionOff=()=>manualReduced||reduced.matches;
const canScroll=()=>!motionOff()&&!compact.matches&&!short.matches;
const canAuto=()=>!motionOff()&&!matchMedia('(max-width:767px)').matches&&!navigator.connection?.saveData&&!embedded;
const panels=all('[data-panel]'),controls=$('#shared-controls');
panels[0].append(controls);
const player=createHeroPlayer({mount:panels[0].querySelector('.video-mount'),film:panels[0],poster:panels[0].querySelector('.reel-poster'),playButton:$('#hero-play'),soundButton:$('#hero-sound'),status:$('#playback-status'),data:data.shots[0],copy:c,canAuto,onProgress:p=>panels[selected].style.setProperty('--progress',String(p))});
function selectShot(i){
 if(i===selected)return;
 selected=i;const item=data.shots[i],panel=panels[i];
 panels.forEach((p,n)=>p.classList.toggle('active',n===i));
 all('[data-shot]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.shot===i)));
 all('[data-model-tab]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.modelTab===i)));
 panel.append(controls);
 player.move({mount:panel.querySelector('.video-mount'),film:panel,poster:panel.querySelector('.reel-poster')});
 player.select(item,{user:canAuto()});
 $('#selected-cost').replaceChildren(document.createTextNode(item.cost),Object.assign(document.createElement('small'),{textContent:'USD'}));
 $('#selected-mode').replaceChildren(document.createTextNode(item.modeLabel),Object.assign(document.createElement('span'),{textContent:item.duration+' s · 16:9'}));
 $('#selected-model').href=item.href;$('#selected-examples').href=item.examplesHref;
 $('#reel-index').textContent='0'+(i+1)+' / 05';
}
all('[data-shot],[data-model-tab]').forEach(b=>b.addEventListener('click',()=>selectShot(Number(b.dataset.shot??b.dataset.modelTab))));
$('#reel').addEventListener('keydown',event=>{
 if(!event.target.matches('[data-shot]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();
 const i=event.key==='Home'?0:event.key==='End'?4:(selected+(event.key==='ArrowRight'?1:4))%5;
 selectShot(i);panels[i].querySelector('[data-shot]').focus({preventScroll:true});
});
const startAmbient=()=>{if('requestIdleCallback'in window)requestIdleCallback(()=>player.auto(),{timeout:1800});else setTimeout(()=>player.auto(),400);};
if(document.readyState==='complete')startAmbient();else window.addEventListener('load',startAmbient,{once:true});

const detail=$('#detail-dialog'),detailMedia=$('#detail-media');let opener=null;
function openDialog(dialog,trigger){
 opener=trigger||document.activeElement;player.suspend(true);dialog.showModal();document.body.style.overflow='hidden';document.dispatchEvent(new CustomEvent('review-overlay',{detail:true}));
 if(dialog.id==='menu-dialog')$('#menu-open').setAttribute('aria-expanded','true');
}
all('dialog').forEach(dialog=>{
 dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{
  if(dialog===detail){detailMedia.querySelector('video')?.pause();detailMedia.replaceChildren();}
  if(dialog.id==='mobile-dialog')$('#mobile-frame').removeAttribute('src');
  document.body.style.overflow='';player.suspend(false);document.dispatchEvent(new CustomEvent('review-overlay',{detail:false}));$('#menu-open').setAttribute('aria-expanded','false');opener?.focus({preventScroll:true});
 });
});
$('#cost-info').addEventListener('click',event=>{
 detailMedia.replaceChildren();$('#detail-title').textContent=c.cost;$('#detail-text').textContent=c.costNote;openDialog(detail,event.currentTarget);
});
$('#hero-zoom').addEventListener('click',event=>{
 const item=data.shots[selected],v=document.createElement('video');
 v.src=item.original;v.poster=item.src;v.controls=true;v.playsInline=true;v.preload='none';
 detailMedia.replaceChildren(v);$('#detail-title').textContent=item.name+' — '+item.title;$('#detail-text').textContent=item.modeLabel+' · '+item.duration+' s · 16:9';
 openDialog(detail,event.currentTarget);v.play().catch(()=>{});
});
$('#mcp-proof').addEventListener('click',event=>{
 const image=document.createElement('img');image.src='/frontend/public/media/mcp/claude-inline-video-proof.jpg';image.alt=c.mcpProof;image.width=1152;image.height=768;
 detailMedia.replaceChildren(image);$('#detail-title').textContent=c.mcpProof;$('#detail-text').textContent=c.mcpProofNote;
 openDialog(detail,event.currentTarget);
});
$('#menu-open').addEventListener('click',event=>openDialog($('#menu-dialog'),event.currentTarget));
all('#menu-dialog a').forEach(a=>a.addEventListener('click',()=>$('#menu-dialog').close()));
$('#language')?.addEventListener('change',event=>{location.href=event.target.value+(embedded?'?phone=1':'');});

const master=initMasterInteractions({data,openDialog,motionOff,canScroll});
function syncPreferences(){
 root.classList.toggle('reduced',motionOff());
 $('#motion-toggle').disabled=reduced.matches;$('#motion-toggle').textContent=manualReduced&&!reduced.matches?c.motionOn:c.reduced;$('#motion-toggle').setAttribute('aria-pressed',String(motionOff()));
 player.pauseForPreference();master.syncPreferences();
}
$('#motion-toggle').addEventListener('click',()=>{manualReduced=!motionOff();syncPreferences();});
reduced.addEventListener('change',syncPreferences);compact.addEventListener('change',syncPreferences);short.addEventListener('change',syncPreferences);
window.addEventListener('resize',syncPreferences,{passive:true});syncPreferences();

$('#mobile-open').addEventListener('click',event=>{
 $('#preview-connect-control').hidden=true;$('#preview-connect-step').value='0';
 $('#mobile-frame').src=$('#mobile-frame').dataset.src;openDialog($('#mobile-dialog'),event.currentTarget);
});
$('#preview-width').addEventListener('change',event=>{$('#mobile-frame').style.width=event.target.value+'px';});
all('[data-preview-section]').forEach(b=>b.addEventListener('click',()=>{
 $('#preview-connect-control').hidden=b.dataset.previewSection!=='connect';
 $('#mobile-frame').contentWindow?.postMessage({type:'redesign-section',section:b.dataset.previewSection},location.origin);
}));
$('#preview-connect-step').addEventListener('change',event=>{
 $('#mobile-frame').contentWindow?.postMessage({type:'redesign-section',section:'connect-story',connectStep:Number(event.target.value)},location.origin);
});
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||!embedded||event.data?.type!=='redesign-section')return;
 if(event.data.section==='menu'){openDialog($('#menu-dialog'),$('#menu-open'));return;}
 if(Number.isInteger(event.data.connectStep))master.selectConnectStep(event.data.connectStep);
 const target=document.getElementById(event.data.section);if(target)target.scrollIntoView({behavior:'instant',block:'start'});
});
