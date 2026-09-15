import {createHeroPlayer} from './playback.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const data=JSON.parse($('#page-data').textContent),e=data.copy;
const reduced=matchMedia('(prefers-reduced-motion:reduce)'),narrow=matchMedia('(max-width:900px)'),shortViewport=matchMedia('(max-height:540px)');
const state={shot:0,case:0,limit:reduced.matches||shortViewport.matches,stage:-1};
let autoReady=false;
const isPhone=new URLSearchParams(location.search).get('phone')==='1';
if(isPhone)document.body.classList.add('phone-preview');
document.body.classList.add('motion-ready');
const player=createHeroPlayer({
 mount:$('#hero-video-mount'),film:$('#hero-film'),poster:$('.hero-poster'),playButton:$('#hero-play'),soundButton:$('#hero-sound'),status:$('#playback-status'),data:data.shots[0],copy:e,
 canAuto:()=>autoReady&&!state.limit&&!narrow.matches&&!navigator.connection?.saveData,
 onProgress:p=>$('[data-shot][aria-pressed=true]')?.style.setProperty('--play-progress',String(p)),
});
$('#language').addEventListener('change',event=>{location.href=event.target.value+(isPhone?'?phone=1':'');});
$$('[data-shot]').forEach(button=>button.addEventListener('click',()=>{
 state.shot=Number(button.dataset.shot);const s=data.shots[state.shot];
 $$('[data-shot]').forEach(b=>{b.setAttribute('aria-pressed',String(b===button));b.style.removeProperty('--play-progress');});
 $('#hero-model').textContent=s.name+' · '+(state.shot===1?'10s':'12s');
 $('.film-format').textContent='16:9 / '+(state.shot===1?'10s':'12s');
 $('#hero-scene').textContent=s.title;$('.film-watch').dataset.watch=String(state.shot);
 player.select(s);
}));
$$('[data-case]').forEach(button=>button.addEventListener('click',()=>{
 state.case=Number(button.dataset.case);const c=data.cases[state.case];
 $$('[data-case]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 $('.case-poster').src=c.src;$('.case-poster').alt=c.alt;$('#case-credit').textContent=c.caption;$('#case-text').textContent=c.text;$('#case-guide').href=c.href;
 $('[data-case-watch]').hidden=c.shot===null;
 if(!state.limit)$('.case-poster').animate([{opacity:.55,transform:'scale(1.025)'},{opacity:1,transform:'scale(1)'}],{duration:450,easing:'ease-out'});
}));
const modal=$('#media-dialog'),modalMedia=$('#dialog-media');
let modalVideo=null,modalResume=false;
function stopModalVideo(){if(modalVideo){modalVideo.pause();modalVideo.removeAttribute('src');modalVideo.load();modalVideo=null;}modalMedia.replaceChildren();}
function openVideo(index){
 const shot=data.shots[index];if(!shot)return;
 stopModalVideo();modal.classList.remove('is-image');
 $('#media-title').textContent=shot.name;$('#media-meta').textContent=shot.meta;$('#media-kind').textContent=e.details;
 $('#media-link').href=shot.href;$('#media-link').textContent=e.details+' ↗';
 const video=document.createElement('video');modalVideo=video;
 video.controls=true;video.playsInline=true;video.preload='none';video.poster=shot.src;video.src=shot.original;
 video.setAttribute('aria-label',shot.name+' — '+shot.meta);modalMedia.append(video);
 player.suspend(true);modal.showModal();
 video.play().catch(()=>{if(modalVideo===video)$('#media-meta').textContent=e.error+' '+shot.meta;});
}
$$('[data-watch]').forEach(button=>button.addEventListener('click',()=>openVideo(Number(button.dataset.watch))));
$('[data-case-watch]').addEventListener('click',()=>openVideo(data.cases[state.case].shot));
$$('[data-image]').forEach(button=>button.addEventListener('click',()=>{
 const item=data.images[Number(button.dataset.image)];stopModalVideo();modal.classList.add('is-image');
 const image=new Image();image.src=item.src;image.alt=item.alt;modalMedia.append(image);
 $('#media-title').textContent=item.title;$('#media-meta').textContent=e.sourceNote;$('#media-kind').textContent=e.imageDialog;
 $('#media-link').href='https://maxvideoai.com/app/image';$('#media-link').textContent=e.toolNames[0]+' ↗';
 player.suspend(true);modal.showModal();
}));
modal.addEventListener('close',()=>{stopModalVideo();player.suspend(false);});
document.addEventListener('visibilitychange',()=>{if(!modalVideo)return;if(document.hidden){modalResume=!modalVideo.paused;modalVideo.pause();}else if(modalResume){modalResume=false;modalVideo.play().catch(()=>{});}});
const menu=$('#menu-dialog');
$('#menu-open').addEventListener('click',()=>{menu.showModal();$('#menu-open').setAttribute('aria-expanded','true');player.suspend(true);});
menu.addEventListener('close',()=>{$('#menu-open').setAttribute('aria-expanded','false');player.suspend(false);});
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.close()));
$$('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}));
const mobile=$('#mobile-dialog'),frame=$('#mobile-frame');
$('#mobile-open').addEventListener('click',()=>{if(!frame.src)frame.src=frame.dataset.src;mobile.showModal();player.suspend(true);frame.contentWindow?.postMessage({type:'home-preview-visibility',hidden:false},location.origin);});
mobile.addEventListener('close',()=>{player.suspend(false);frame.contentWindow?.postMessage({type:'home-preview-visibility',hidden:true},location.origin);});
$('#preview-width').addEventListener('change',event=>mobile.style.setProperty('--preview-width',event.target.value+'px'));
$$('[data-preview-section]').forEach(b=>b.addEventListener('click',()=>frame.contentWindow?.postMessage({type:'home-preview-section',id:b.dataset.previewSection},location.origin)));
$$('[data-preview-progress]').forEach(b=>b.addEventListener('click',()=>frame.contentWindow?.postMessage({type:'home-preview-progress',progress:Number(b.dataset.previewProgress)},location.origin)));

const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));
const ease=t=>t*t*(3-2*t);
const portion=(p,start,end)=>ease(clamp((p-start)/(end-start)));
const runway=$('#story-runway'),stage=$('#story-stage'),gallery=$('.image-gallery');
const laptop=$('.laptop'),lid=$('.laptop-lid'),reference=$('.reference-window'),proposal=$('.proposal-window'),approval=$('.approval-window'),library=$('.library-window');
let scheduled=false;
function paint(){
 scheduled=false;
 if(state.limit)return;
 const bounds=runway.getBoundingClientRect(),vh=innerHeight;
 const p=clamp(-bounds.top/Math.max(1,bounds.height-$('.story-sticky').getBoundingClientRect().height));
 if(bounds.bottom>0&&bounds.top<vh){
  const open=portion(p,0,.23),propose=portion(p,.18,.32),approve=portion(p,.39,.49),finish=portion(p,.64,.76),small=narrow.matches;
  stage.style.setProperty('--p',String(p));
  laptop.style.transform=`translateY(${30*open+30*finish}px) scale(${1-.14*propose-.08*finish}) rotateY(${-10*propose}deg)`;
  lid.style.transform=`rotateX(${-72+68*open}deg)`;
  reference.style.transform=`translate(${(small?60:170)*(1-open)-(small?12:20)*propose}px,${60*(1-open)-25*open}px) rotate(${-8+6*finish}deg) scale(${1-.12*finish})`;
  reference.style.opacity=String(1-.45*finish);
  proposal.style.opacity=String(propose*(1-.65*finish));
  proposal.style.transform=`translate(${(small?30:65)*(1-propose)+(small?12:30)*finish}px,${80*(1-propose)-18*approve}px) rotate(${8*(1-propose)+3*propose}deg) scale(${.85+.15*propose-.08*finish})`;
  approval.style.opacity=String(approve*(1-finish));
  approval.style.transform=`translateY(${45*(1-approve)}px) scale(${.88+.12*approve})`;
  library.style.opacity=String(finish);
  library.inert=finish<.9;
  library.setAttribute('aria-hidden',String(finish<.1));
  library.style.transform=`translateY(${90*(1-finish)}px) rotate(${-8*(1-finish)}deg) scale(${.65+.35*finish})`;
  const step=p<.25?0:p<.49?1:p<.73?2:3;
  if(state.stage!==step){state.stage=step;stage.dataset.step=String(step);$$('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stage)===step)));$$('[data-statement]').forEach(s=>{const active=Number(s.dataset.statement)===step;s.style.display=active?'block':'none';s.setAttribute('aria-hidden',String(!active));});}
 }
 const gr=gallery.getBoundingClientRect();
 if(gr.top<vh&&gr.bottom>0)gallery.style.setProperty('--gallery',String(ease(clamp((vh-gr.top)/(vh*.85)))));
 const hr=$('#hero-film').getBoundingClientRect();
 if(!narrow.matches&&hr.bottom>0&&hr.top<vh)$('#hero-media').style.transform=`translateY(${Math.max(0,-hr.top)*.12}px) scale(1.04)`;
}
function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(paint);}}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
function moveStory(p){
 if(state.limit)return;
 const r=runway.getBoundingClientRect();
 scrollTo({top:scrollY+r.top+clamp(p)*Math.max(0,r.height-$('.story-sticky').getBoundingClientRect().height),behavior:'instant'});
 schedule();
}
$$('[data-stage]').forEach(b=>b.addEventListener('click',()=>moveStory([.10,.37,.60,.94][Number(b.dataset.stage)])));
function setLimited(value){
 state.limit=value;document.body.classList.toggle('reduced-motion',value);$('#motion-toggle').setAttribute('aria-pressed',String(value));
 $$('[data-statement]').forEach(s=>s.removeAttribute('aria-hidden'));
 if(value){player.reduce();library.inert=false;library.removeAttribute('aria-hidden');}else{state.stage=-1;player.auto();schedule();}
}
$('#motion-toggle').addEventListener('click',()=>setLimited(!state.limit));
reduced.addEventListener('change',event=>setLimited(event.matches||shortViewport.matches));
shortViewport.addEventListener('change',event=>setLimited(event.matches||reduced.matches));
narrow.addEventListener('change',()=>{player.pauseForPreference();schedule();});
setLimited(state.limit);schedule();
function prepareAuto(){if(document.readyState!=='complete')return;const run=()=>{autoReady=true;player.auto();};if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:1800});else setTimeout(run,300);}
if(document.readyState==='complete')prepareAuto();else addEventListener('load',prepareAuto,{once:true});
addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent)return;
 if(event.data?.type==='home-preview-section'&&['hero','models','assistant','ideas','pricing'].includes(event.data.id))document.getElementById(event.data.id)?.scrollIntoView({behavior:'instant',block:'start'});
 if(event.data?.type==='home-preview-progress'&&typeof event.data.progress==='number'&&Number.isFinite(event.data.progress))moveStory(event.data.progress);
 if(event.data?.type==='home-preview-visibility'&&typeof event.data.hidden==='boolean')player.suspend(event.data.hidden);
});
