const start=document.querySelector('#start');
start.addEventListener('click',async()=>{
 start.disabled=true;document.querySelector('#loading-status').textContent='Préparation de la scène et de l’objet 3D…';
 try{const {startExperience}=await import('./runtime.js');await startExperience();}
 catch(error){document.body.classList.add('no-3d');document.querySelector('#loading-status').textContent='La scène 3D ne peut pas démarrer ici. Le parcours illustré reste disponible ci-dessous.';start.disabled=false;start.textContent='Réessayer';console.error(error);}
});
if(new URLSearchParams(location.search).get('phone')==='1')document.body.classList.add('phone');
// Entering the mobile preview is an explicit request from the parent controls.
if(new URLSearchParams(location.search).get('preview')==='1' && self !== top)start.click();
