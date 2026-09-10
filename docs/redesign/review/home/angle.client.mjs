const data=JSON.parse(document.querySelector('#page-data').textContent),c=data.copy;
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion:reduce)'),compact=matchMedia('(max-width:900px)'),short=matchMedia('(max-height:570px)');
let manualReduced=false,angleIndex=0,angleManual=false,angleVisible=false,frame=0,angleRequest=0;
const motionOff=()=>manualReduced||reduced.matches;
const canScroll=()=>!motionOff()&&!compact.matches&&!short.matches;
const angleImages=all('[data-angle-image]'),runway=$('#angle-runway');
const dotPositions=[[130,129],[220,82],[38,75],[130,24]];
function loadView(i){
 const image=angleImages[i];
 if(!image.getAttribute('src'))image.src=image.dataset.src;
 return image.decode().catch(()=>null);
}
async function setAngle(i,{manual=false}={}){
 if(manual){angleManual=true;$('#angle-reset').hidden=!canScroll();$('#angle-hint').textContent=c.angleManual;}
 const request=++angleRequest;
 await loadView(i);
 if(request!==angleRequest||!angleImages[i].naturalWidth)return;
 angleIndex=i;
 angleImages.forEach((image,n)=>{image.classList.toggle('current',n===i);image.setAttribute('aria-hidden',String(n!==i));});
 all('[data-angle]').forEach(button=>button.setAttribute('aria-pressed',String(+button.dataset.angle===i)));
 $('#angle-current').textContent=c.angleControls[i];$('#angle-count').textContent='0'+(i+1)+' / 04';
 $('#angle-step').textContent='0'+(i+1);$('#angle-title').textContent=c.angleSteps[i];$('#angle-description').textContent=c.angleDesc[i];
 $('#view-dot').setAttribute('cx',dotPositions[i][0]);$('#view-dot').setAttribute('cy',dotPositions[i][1]);
}
all('[data-angle]').forEach(b=>b.addEventListener('click',()=>setAngle(+b.dataset.angle,{manual:true})));
$('.angle-nav').addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?3:(angleIndex+(event.key==='ArrowRight'?1:3))%4;
 setAngle(next,{manual:true});all('[data-angle]')[next].focus({preventScroll:true});
});
function onScroll(){
 frame=0;if(!canScroll()||angleManual||!angleVisible)return;
 const bounds=runway.getBoundingClientRect(),range=Math.max(1,runway.offsetHeight-innerHeight);
 const progress=Math.max(0,Math.min(1,-bounds.top/range));
 const i=Math.min(3,Math.floor(progress*4));
 if(i!==angleIndex)setAngle(i);
}
function scheduleScroll(){if(!frame)frame=requestAnimationFrame(onScroll);}
window.addEventListener('scroll',scheduleScroll,{passive:true});
new IntersectionObserver(entries=>{
 angleVisible=entries[0].isIntersecting;if(!angleVisible)return;
 if(!navigator.connection?.saveData){for(let i=1;i<4;i++)loadView(i);}
 scheduleScroll();
},{rootMargin:'180px 0px'}).observe(runway);
$('#angle-reset').addEventListener('click',()=>{angleManual=false;$('#angle-reset').hidden=true;$('#angle-hint').textContent=c.angleScroll;scheduleScroll();});
let drag=null;
$('#angle-canvas').addEventListener('pointerdown',event=>{
 if(event.target.closest('button')||event.pointerType==='mouse'&&event.button!==0)return;
 drag={x:event.clientX,y:event.clientY,id:event.pointerId};
});
$('#angle-canvas').addEventListener('pointerup',event=>{
 if(!drag||event.pointerId!==drag.id)return;
 const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag=null;
 if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)setAngle((angleIndex+(dx<0?1:3))%4,{manual:true});
});
$('#angle-canvas').addEventListener('pointercancel',()=>{drag=null;});
function syncPreferences(){
 root.classList.toggle('reduced',motionOff());
 $('#motion-toggle').disabled=reduced.matches;$('#motion-toggle').textContent=manualReduced&&!reduced.matches?c.motionOn:c.reduced;$('#motion-toggle').setAttribute('aria-pressed',String(motionOff()));
 $('#angle-hint').textContent=canScroll()&&!angleManual?c.angleScroll:c.angleManual;$('#angle-reset').hidden=!canScroll()||!angleManual;
 scheduleScroll();
}
$('#motion-toggle').addEventListener('click',()=>{manualReduced=!motionOff();syncPreferences();});
reduced.addEventListener('change',syncPreferences);compact.addEventListener('change',syncPreferences);short.addEventListener('change',syncPreferences);
window.addEventListener('resize',()=>{scheduleScroll();},{passive:true});syncPreferences();
