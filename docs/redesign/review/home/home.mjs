const $ = selector => document.querySelector(selector);
const state = {notes:false};
const isPhone = new URLSearchParams(location.search).get('phone')==='1';
if(isPhone)document.body.classList.add('phone-preview');
$('#language').addEventListener('change',event=>{location.href=event.target.value+(isPhone?'?phone=1':'');});
$('#review-toggle').addEventListener('click',event=>{
 state.notes=!state.notes;event.currentTarget.setAttribute('aria-pressed',String(state.notes));event.currentTarget.textContent=state.notes?event.currentTarget.dataset.hide:event.currentTarget.dataset.show;
 document.querySelectorAll('.effect-note').forEach(note=>note.hidden=!state.notes);
});
const modelData=JSON.parse($('#model-data').textContent);
document.querySelectorAll('[data-model]').forEach(button=>button.addEventListener('click',()=>{
 const data=modelData[Number(button.dataset.model)];
 document.querySelectorAll('[data-model]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
 const picture=$('.model-image');picture.src=data.src;picture.alt=data.alt;
 $('#model-name').textContent=data.name;$('#model-meta').textContent=data.meta;$('#model-text').textContent=data.text;$('#model-details').href=data.href;$('#model-examples').href=data.examplesHref;
}));
const menu=$('#menu-dialog');
$('#menu-open').addEventListener('click',()=>{menu.showModal();$('#menu-open').setAttribute('aria-expanded','true');});
menu.addEventListener('close',()=>$('#menu-open').setAttribute('aria-expanded','false'));
menu.querySelectorAll('a').forEach(anchor=>anchor.addEventListener('click',()=>menu.close()));
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{
 if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
});
const mobile=$('#mobile-dialog'), frame=$('#mobile-frame');
$('#mobile-open').addEventListener('click',()=>{if(!frame.src)frame.src=frame.dataset.src;mobile.showModal();});
$('#preview-width').addEventListener('change',event=>{mobile.style.setProperty('--preview-width',`${event.target.value}px`);});
document.querySelectorAll('[data-preview-section]').forEach(button=>button.addEventListener('click',()=>frame.contentWindow?.postMessage({type:'home-preview-section',id:button.dataset.previewSection},location.origin)));
addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='home-preview-section')return;
 if(!['hero','assistant','ideas','models','pricing'].includes(event.data.id))return;
 const target=event.data.id==='assistant'?document.querySelector('.assistant-stage'):document.getElementById(event.data.id);
 target?.scrollIntoView({behavior:'instant',block:'start'});
});
