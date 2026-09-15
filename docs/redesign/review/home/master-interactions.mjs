import {initConnect} from './connect-controller.mjs';
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
export function initMasterInteractions({data,openDialog,motionOff,canScroll}){
 const {library}=data;
 let pairIndex=0,boardView='scores',kind='all';
 const board=$('#comparison-board'),rail=$('#network-rail');
 function syncBoard(){
  const pair=library.pairs[pairIndex];
  for(const side of ['left','right']){
   const model=pair[side],heading=$('#board-'+side);
   heading.querySelector('h3').textContent=model.name;
   all('[data-table-'+side+']').forEach(cell=>cell.textContent=model.name);
   heading.querySelector('img').src='/frontend/public/brand/partners/'+model.mark;
   heading.querySelector('div>span').textContent=boardView==='scores'?'Editorial score / 10':'Published capabilities';
   library.criteria.forEach(row=>{
    const score=$('[data-'+side+'-score="'+row.key+'"]');
    score.textContent=model.scores[row.key].toFixed(1);
    score.setAttribute('aria-label',model.name+': '+model.scores[row.key].toFixed(1)+' out of 10 for '+row.label);
    $('[data-'+side+'-bar="'+row.key+'"]').style.setProperty('--score',String(model.scores[row.key]/10));
   });
   library.specCriteria.forEach(row=>{$('[data-'+side+'-spec="'+row.key+'"]').textContent=model.specs[row.key];});
  }
  $('#pair-link').href=pair.url;
  $('#pair-description').textContent=pair.description;
  $('#compare-pair').value=String(pairIndex);
  all('[data-pair]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.pair===pairIndex)));
  all('[data-board]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.board===boardView)));
  $('#score-rows').hidden=boardView!=='scores';$('#spec-rows').hidden=boardView!=='specs';
  $('#score-method').textContent=boardView==='scores'?'Six criteria from MaxVideoAI’s published editorial scorecards. Scores are editorial assessments.':'Published model capabilities. Available settings depend on the selected generation mode. See the full comparison for details.';
  $('#score-dates').textContent=boardView==='scores'?'Scorecards updated: '+pair.left.updated+' / '+pair.right.updated:'Source: MaxVideoAI’s published model specifications.';
 }
 all('[data-pair]').forEach(b=>b.addEventListener('click',()=>{pairIndex=+b.dataset.pair;syncBoard();}));
 $('#compare-pair').addEventListener('change',event=>{pairIndex=+event.target.value;syncBoard();});
 all('[data-board]').forEach(b=>b.addEventListener('click',()=>{boardView=b.dataset.board;syncBoard();}));
 const scoreObserver=new IntersectionObserver(entries=>{
  if(entries.some(e=>e.isIntersecting)){
   if(!motionOff())$('#score-rows').classList.add('entered');
   scoreObserver.disconnect();
  }
 },{threshold:.25});
 scoreObserver.observe(board);
 $('#score-rows').addEventListener('animationend',event=>{if(event.target.matches('[data-right-bar="controllability"]'))$('#score-rows').classList.remove('entered');});
 syncBoard();

 function filterLibrary(){
  const query=$('#library-search').value.trim().toLocaleLowerCase('en');
  let count=0;
  all('.library-model').forEach(a=>{
   const show=(kind==='all'||a.dataset.kind===kind)&&a.dataset.search.includes(query);
   a.hidden=!show;if(show)count++;
  });
  $('#library-count').textContent=count+' '+(count===1?'model':'models');$('#library-empty').hidden=count>0;
  all('[data-library-kind]').forEach(b=>b.setAttribute('aria-pressed',String(kind===b.dataset.libraryKind)));
 }
 $('#library-open').addEventListener('click',event=>openDialog($('#library-dialog'),event.currentTarget));
 $('#library-search').addEventListener('input',filterLibrary);
 all('[data-library-kind]').forEach(b=>b.addEventListener('click',()=>{kind=b.dataset.libraryKind;filterLibrary();}));
 function railControls(){
  $('#network-prev').disabled=rail.scrollLeft<2;
  $('#network-next').disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2;
 }
 for(const [id,dir] of [['prev',-1],['next',1]]){
  $('#network-'+id).addEventListener('click',()=>rail.scrollBy({left:dir*rail.clientWidth*.75,behavior:motionOff()?'instant':'smooth'}));
 }
 rail.addEventListener('scroll',railControls,{passive:true});
 new ResizeObserver(railControls).observe(rail);railControls();

 const connect=initConnect({motionOff,canScroll});
 return {selectConnectStep:connect.selectConnectStep,syncPreferences(){railControls();connect.syncPreferences();}};
}
