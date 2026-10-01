import {createHash} from 'node:crypto';import {CommandService} from './commands';import type {Command,CommandResult} from '../shared/types';import {isEdit,sequenceDuration,StudioError} from '../shared/timeline';
export interface ChatInput {text:string;requestId:string;context?:{clipId?:string;assetIds?:string[];revision?:number};}
export class Director {
 private locks=new Map<string,Promise<unknown>>();constructor(public service:CommandService){}
 async respond(id:string,input:ChatInput):Promise<CommandResult>{
  const prior=this.locks.get(id)??Promise.resolve(),task=prior.catch(()=>{}).then(()=>this.perform(id,input));this.locks.set(id,task);try{return await task;}finally{if(this.locks.get(id)===task)this.locks.delete(id);}
 }
 private async perform(id:string,input:ChatInput):Promise<CommandResult>{
  if(typeof input.text!=='string'||!input.text.trim()||input.text.length>4000||typeof input.requestId!=='string'||!input.requestId||input.requestId.length>100)throw new StudioError('Message invalide.');
  const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex'),key='chat:'+input.requestId;
  let p=await this.service.store.get(id);if(p.receipts[key]){if(p.receipts[key].hash!==hash)throw new StudioError('Cet identifiant de message a déjà été utilisé.',409);return {project:p,replayed:true};}
  const text=input.text.trim(),lower=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),context=input.context??{};
  await this.service.store.update(id,p=>{if(!p.messages.some(m=>m.id===key))p.messages.push({id:key,role:'user',text,assets:context.assetIds?.filter(id=>p.assets.some(a=>a.id===id)),createdAt:new Date().toISOString()});return p;});
  const commands:Command[]=[];let reply='';const clip=p.clips.find(c=>c.id===context.clipId)??p.clips.find(c=>c.track==='video');
  const selected=p.assets.filter(a=>context.assetIds?.includes(a.id));const seconds=Number(lower.match(/(\d+(?:[.,]\d+)?)\s*(?:s\b|sec|seconde)/)?.[1]?.replace(',','.'));
  if(/export|rendu|render/.test(lower))commands.push({type:'export'});
  else if(/annul|undo/.test(lower))commands.push({type:'undo'});
  else if(/retabli|redo/.test(lower))commands.push({type:'redo'});
  else if(/voix|voice|narration/.test(lower)&&!/ajout|place|montage/.test(lower)){
   const quoted=text.match(/[«“"](.+?)[»”"]/s)?.[1]??text.split(':').slice(1).join(':').trim();
   if(quoted)commands.push({type:'voice',text:quoted.trim()});else reply='Donnez-moi le texte à lire, par exemple : Crée une voix : « La lumière a un parfum. »';
  }else if(/musique|ambiance sonore|soundtrack/.test(lower)&&!/ajout|place/.test(lower))commands.push({type:'music',duration:seconds||sequenceDuration(p)||p.settings.targetDuration});
  else if(/ajout|place|inser/.test(lower)&&/son|audio|musique|voix|ambiance/.test(lower)){
   const a=selected.find(a=>a.kind==='audio')??p.assets.filter(a=>a.kind==='audio').at(-1);if(a)commands.push({type:'insert',assetId:a.id,track:/musique|ambiance/.test(lower)?'music':'voice'});else reply='Importez un son ou demandez une voix/ambiance ; je pourrai ensuite le placer dans le montage.';
  }else if(/coupe|trim|raccour|garde/.test(lower)&&clip){
   if(seconds)commands.push({type:'trim',clipId:clip.id,inFrame:clip.inFrame,outFrame:clip.inFrame+Math.round(seconds*p.settings.fps)});else reply='Sélectionnez un plan et dites la durée à garder, par exemple : Garde 4 secondes.';
  }else if(/deplace|premier|position|dernier/.test(lower)&&clip){
   commands.push({type:'move',clipId:clip.id,index:/fin|dernier/.test(lower)?p.clips.filter(c=>c.track==='video').length-1:/premier|debut/.test(lower)?0:Math.max(0,Number(lower.match(/position\s*(\d+)/)?.[1]??1)-1)});
  }else if(/supprim|retire/.test(lower)&&clip)commands.push({type:'remove',clipId:clip.id});
  else if(/9:16|16:9|1:1|vertical|carre|horizontal|1080|720|fps|duree cible/.test(lower)){
   const settings:Extract<Command,{type:'settings'}>['settings']={};if(/9:16|vertical/.test(lower))settings.ratio='9:16';else if(/1:1|carre/.test(lower))settings.ratio='1:1';else if(/16:9|horizontal/.test(lower))settings.ratio='16:9';if(/1080/.test(lower))settings.resolution=1080;else if(/720/.test(lower))settings.resolution=720;if(/30\s*fps/.test(lower))settings.fps=30;else if(/24\s*fps/.test(lower))settings.fps=24;if(/duree cible/.test(lower)&&seconds)settings.targetDuration=seconds;commands.push({type:'settings',settings});
  }else if(/assembl|monte|montage/.test(lower)&&p.assets.some(a=>a.kind==='video')){
   const chosen=selected.filter(a=>a.kind==='video'),videos=chosen.length?chosen:p.assets.filter(a=>a.kind==='video'&&!p.jobs.some(j=>j.kind==='export'&&j.outputIds.includes(a.id)));commands.push({type:'assemble',assetIds:videos.slice(-12).map(a=>a.id)});
  }else if(/anim|mouvement/.test(lower)){
   const images=selected.filter(a=>a.kind==='image').length?selected.filter(a=>a.kind==='image'):p.assets.filter(a=>a.kind==='image').slice(-3);
   for(const a of images)commands.push({type:'animate',assetId:a.id,duration:seconds||Math.min(30,p.settings.targetDuration/Math.max(1,images.length)),motion:/panoram/.test(lower)?'pan':/fixe/.test(lower)?'still':'gentle'});
   if(!commands.length)reply='Ajoutez une image de référence ou créez les visuels de démonstration pour les animer.';
  }else if(/image|visuel|direction|variation|reference/.test(lower)){
   commands.push({type:'images',count:3,prompt:text});reply='Je travaille avec les trois visuels parfum de démonstration. Vos références restent attachées au brief ; une génération fidèle à une autre direction nécessitera le fournisseur réel.';
  }else if(/pub|film|parfum|video|demonstration/.test(lower)){
   commands.push({type:'images',count:3,prompt:text,buildFilm:!(/etape/.test(lower))});reply='Je prépare le film parfum de démonstration avec trois plans animés. Vous pourrez ajuster la coupe et l’ordre, puis ajouter une voix ou une ambiance.';
  }else reply='Je peux préparer le film parfum de démonstration, animer vos images, assembler vos vidéos, couper un plan sélectionné, créer une voix ou une ambiance et exporter. Pour une interview ou un podcast, importez vos références audio/vidéo.';
  let result:CommandResult={project:p};
  try{
   for(const [index,command] of commands.entries())result=await this.service.execute(id,{requestId:input.requestId+':'+index,expectedRevision:isEdit(command)?(context.revision??p.revision)+index:undefined,command});
   if(commands.length&&commands.every(isEdit))reply='Le montage a été mis à jour. Vous pouvez le relire ou annuler cette modification.';
  }catch(e){reply=e instanceof Error?e.message:'Cette action a échoué.';}
  p=await this.service.store.update(id,p=>{if(reply)p.messages.push({id:crypto.randomUUID(),role:'assistant',text:reply,createdAt:new Date().toISOString()});p.receipts[key]={hash,revision:p.revision};return p;});return {...result,project:p};
 }
}
