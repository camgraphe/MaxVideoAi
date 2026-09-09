// Local review reader. Production integration must use the shared React playback owners.
export function createHeroPlayer({mount,film,poster,playButton,soundButton,status,data,copy,canAuto,onProgress}){
 let item=data,video=null,wanted=false,visible=true,suspended=false,manualPause=false,failedOver=false,serial=0,playing=false;
 const playIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7Z"/></svg>';
 const pauseIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
 const label=()=>{playButton.setAttribute('aria-label',playing?copy.pause:copy.play);playButton.innerHTML=playing?pauseIcon:playIcon;};
 function isCurrent(node,attempt){return node===video&&attempt===serial;}
 function detach(){
  serial++;if(video){video.pause();video.removeAttribute('src');video.load();video.remove();video=null;}
  film.classList.remove('is-playing');playing=false;label();onProgress(0);
 }
 function attach(){
  const node=document.createElement('video');const attempt=++serial;
  video=node;node.muted=true;node.playsInline=true;node.loop=true;node.preload='none';node.setAttribute('aria-hidden','true');
  const small=matchMedia('(max-width:767px)').matches||navigator.connection?.saveData;
  node.src=item[small?'mobile':'desktop']||item.original;mount.append(node);
  node.addEventListener('playing',()=>{if(!isCurrent(node,attempt))return;playing=true;status.textContent='';film.classList.add('is-playing');label();});
  node.addEventListener('waiting',()=>{if(isCurrent(node,attempt)&&wanted){status.textContent=copy.loading;film.classList.remove('is-playing');}});
  node.addEventListener('pause',()=>{if(!isCurrent(node,attempt))return;playing=false;label();});
  node.addEventListener('timeupdate',()=>{if(isCurrent(node,attempt))onProgress(node.duration?node.currentTime/node.duration:0);});
  node.addEventListener('error',()=>{
   if(!isCurrent(node,attempt))return;
   film.classList.remove('is-playing');
   if(!failedOver&&node.src!==item.original){failedOver=true;node.src=item.original;if(wanted&&visible&&!suspended&&!document.hidden)start();return;}
   status.textContent=copy.error;playing=false;label();
  });
  return node;
 }
 function start(){
  if(!wanted||!visible||suspended||document.hidden)return;
  const node=video||attach();const attempt=serial;
  status.textContent=copy.loading;
  node.play().catch(()=>{if(isCurrent(node,attempt)&&wanted&&visible&&!suspended&&!document.hidden){playing=false;label();status.textContent=copy.error;}});
 }
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else video?.pause();},{threshold:.12});
 observer.observe(film);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video?.pause();else start();});
 playButton.addEventListener('click',()=>{if(playing||wanted&&video&&!video.paused){manualPause=true;wanted=false;video?.pause();}else{manualPause=false;wanted=true;start();}});
 soundButton.addEventListener('click',()=>{
  if(!video){wanted=true;start();}
  if(!video)return;
  video.muted=!video.muted;soundButton.setAttribute('aria-label',video.muted?copy.sound:copy.mute);
  soundButton.innerHTML=video.muted?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4Zm5 5 6 6m0-6-6 6"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>';
 });
 return {
  select(next,{user=true}={}){
   detach();item=next;failedOver=false;poster.src=item.src;poster.alt=item.alt;
   soundButton.setAttribute('aria-label',copy.sound);
   soundButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4Zm5 5 6 6m0-6-6 6"/></svg>';
   wanted=user||canAuto();manualPause=false;start();
  },
  auto(){if(canAuto()&&!manualPause){wanted=true;start();}},
  suspend(value){suspended=value;if(value)video?.pause();else start();},
  reduce(){wanted=false;video?.pause();film.classList.remove('is-playing');},
  pauseForPreference(){if(!canAuto()){wanted=false;video?.pause();}},
 };
}

