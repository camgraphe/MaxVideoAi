const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const clamp=n=>Math.max(0,Math.min(1,n));
export function initConnect({motionOff,canScroll}){
 const stage=$('#connect-stage'),runway=$('#connect-runway'),canvas=$('#connect-canvas');
 let scene=null,loading=false,destroyed=false,visible=false,near=false,manual=false,raf=0,previousTime=0,playing=null,blocked=false;
 let target=0,current=0,step=-1,pointer={x:0,y:0},pointerTarget={x:0,y:0};
 function updateCopy(p){
  const next=p<.26?0:p<.76?1:2;
  $('#scene-progress-fill').style.transform='scaleX('+p+')';
  if(next===step)return;step=next;stage.dataset.step=String(next);
  all('[data-connect-step]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.connectStep===next)));
  all('[data-connect-panel]').forEach((panel,i)=>{panel.hidden=i!==next;panel.inert=i!==next;});
  $('#connect-count').textContent='0'+(next+1)+' / 03';
  $('#scene-label').textContent=['WEBSITE / BRIEF / REFERENCES','DIRECTION / MODEL / QUOTE','ACTUAL CLAUDE INTEGRATION EXAMPLE'][next];
 }
 function hints(){
  $('#connect-hint').textContent=canScroll()&&!manual?'Scroll to explore the workflow':'Choose a step to explore';
  $('#connect-resume').hidden=!canScroll()||!manual;
  $('#connect-play').disabled=motionOff();
 }
 function stopPlay(){
  playing=null;$('#connect-play').querySelector('span').textContent='Play the story';
  $('#connect-play').setAttribute('aria-label','Play the workflow animation');
 }
 function schedule(){if(!raf&&!destroyed&&!document.hidden&&!blocked&&visible)raf=requestAnimationFrame(draw);}
 function draw(now){
  raf=0;if(destroyed||document.hidden||blocked||!visible){previousTime=0;return;}
  const delta=previousTime?Math.min(50,now-previousTime):16.7;previousTime=now;
  if(playing){
   target=clamp(playing.from+(now-playing.start)/10000);
   if(target>=1)stopPlay();
  }
  const ease=motionOff()?1:1-Math.exp(-delta/88);
  current+= (target-current)*ease;pointer.x+=(pointerTarget.x-pointer.x)*ease;pointer.y+=(pointerTarget.y-pointer.y)*ease;
  if(Math.abs(target-current)<.0002)current=target;
  updateCopy(current);scene?.render(current,pointer);
  if(playing||Math.abs(target-current)>.0002||Math.abs(pointerTarget.x-pointer.x)>.001||Math.abs(pointerTarget.y-pointer.y)>.001)schedule();
  else previousTime=0;
 }
 async function prepare(){
  if(scene||loading||destroyed||navigator.connection?.saveData)return;
  loading=true;
  try{
   const {createConnectScene}=await import('./connect-runtime.js');
   if(destroyed)return;
   const candidate=await createConnectScene(canvas,{compact:stage.clientWidth<650});
   if(destroyed){candidate.dispose();return;}
   scene=candidate;scene.resize(stage.clientWidth,stage.clientHeight,devicePixelRatio);
   scene.render(current,pointer);stage.classList.add('has-3d');stage.dataset.renderer='webgl';schedule();
  }catch(error){stage.dataset.renderer='illustrated';}
  finally{loading=false;}
 }
 function fromScroll(){
  if(!canScroll()||manual||playing)return;
  const bounds=runway.getBoundingClientRect(),range=Math.max(1,runway.offsetHeight-$('.connect-sticky').offsetHeight);
  target=clamp((20-bounds.top)/range);schedule();
 }
 function select(next){
  if(!Number.isInteger(next)||next<0||next>2)return;
  manual=true;stopPlay();target=[0,.5,1][next];hints();
  if(motionOff()){current=target;updateCopy(current);scene?.render(current,{x:0,y:0});}
  schedule();
 }
 all('[data-connect-step]').forEach(b=>b.addEventListener('click',()=>select(+b.dataset.connectStep)));
 $('.connect-steps').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(step+(event.key==='ArrowRight'?1:2))%3;
  select(next);all('[data-connect-step]')[next].focus({preventScroll:true});
 });
 $('#connect-play').addEventListener('click',()=>{
  if(playing){stopPlay();return;}
  manual=true;hints();if(target>.96){current=0;target=0;}
  playing={start:performance.now(),from:current};$('#connect-play').querySelector('span').textContent='Pause story';
  $('#connect-play').setAttribute('aria-label','Pause the workflow animation');schedule();
 });
 $('#connect-resume').addEventListener('click',()=>{manual=false;stopPlay();hints();fromScroll();});
 stage.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse'||motionOff()||!matchMedia('(pointer:fine)').matches)return;
  const rect=stage.getBoundingClientRect();
  pointerTarget={x:(event.clientX-rect.left)/rect.width*2-1,y:(event.clientY-rect.top)/rect.height*2-1};schedule();
 },{passive:true});
 stage.addEventListener('pointerleave',()=>{pointerTarget={x:0,y:0};schedule();});
 const nearObserver=new IntersectionObserver(entries=>{near=entries[0].isIntersecting;if(near)prepare();},{rootMargin:'700px 0px'});
 nearObserver.observe(stage);
 const visibleObserver=new IntersectionObserver(entries=>{
  visible=entries[0].isIntersecting;
  if(visible){fromScroll();schedule();}else{stopPlay();cancelAnimationFrame(raf);raf=0;previousTime=0;}
 },{threshold:0});
 visibleObserver.observe(stage);
 const resizeObserver=new ResizeObserver(()=>{scene?.resize(stage.clientWidth,stage.clientHeight,devicePixelRatio);fromScroll();schedule();});
 resizeObserver.observe(stage);
 window.addEventListener('scroll',fromScroll,{passive:true});
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){stopPlay();cancelAnimationFrame(raf);raf=0;previousTime=0;}else schedule();
 });
 document.addEventListener('review-overlay',event=>{
  blocked=Boolean(event.detail);stopPlay();
  if(blocked){cancelAnimationFrame(raf);raf=0;previousTime=0;}else schedule();
 });
 canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();stopPlay();scene?.dispose();scene=null;stage.classList.remove('has-3d');stage.dataset.renderer='illustrated';
 });
 window.addEventListener('pagehide',event=>{stopPlay();cancelAnimationFrame(raf);raf=0;previousTime=0;if(event.persisted)return;destroyed=true;nearObserver.disconnect();visibleObserver.disconnect();resizeObserver.disconnect();scene?.dispose();});
 window.addEventListener('pageshow',event=>{if(event.persisted){fromScroll();schedule();}});
 updateCopy(0);hints();
 return{
  selectConnectStep:select,
  syncPreferences(){
   hints();if(motionOff()){stopPlay();pointer={x:0,y:0};pointerTarget={x:0,y:0};target=[0,.5,1][Math.max(0,step)];current=target;updateCopy(current);scene?.render(current,pointer);}
   if(near)prepare();fromScroll();schedule();
  }
 };
}
