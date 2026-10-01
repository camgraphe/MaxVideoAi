import type {Project} from '../shared/types';
import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {StudioError} from '../shared/timeline';
export class ProjectStore {
 private locks=new Map<string,Promise<unknown>>();
 constructor(public root:string){}
 path(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new StudioError('Projet invalide.',404);return join(this.root,id+'.json');}
 async create(title='Sans titre'):Promise<Project>{
  if(typeof title!=='string'||!title.trim()||title.length>120)throw new StudioError('Titre invalide.');
  const now=new Date().toISOString(),p:Project={id:crypto.randomUUID(),title:title.trim(),createdAt:now,updatedAt:now,revision:0,settings:{ratio:'16:9',resolution:720,fps:24,fit:'cover',sourceAudio:true,targetDuration:60},clips:[],assets:[],messages:[],jobs:[],undo:[],redo:[],receipts:{}};
  await this.write(p);return p;
 }
 async get(id:string):Promise<Project>{try{return JSON.parse(await readFile(this.path(id),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')throw new StudioError('Projet introuvable.',404);throw e;}}
 async list():Promise<Project[]>{await mkdir(this.root,{recursive:true});return (await Promise.all((await readdir(this.root)).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).map(n=>this.get(n.slice(0,-5))))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
 async update(id:string,mutate:(p:Project)=>Project|Promise<Project>):Promise<Project>{
  const prior=this.locks.get(id)??Promise.resolve();
  const task=prior.catch(()=>{}).then(async()=>{const next=await mutate(await this.get(id));next.updatedAt=new Date().toISOString();await this.write(next);return next;});
  this.locks.set(id,task);try{return await task;}finally{if(this.locks.get(id)===task)this.locks.delete(id);}
 }
 private async write(p:Project){await mkdir(this.root,{recursive:true});const final=this.path(p.id),temp=final+'.'+crypto.randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(p));await rename(temp,final);}
}
