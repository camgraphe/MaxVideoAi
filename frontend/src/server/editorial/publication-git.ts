import {z} from 'zod';
import type {PublicationFile} from './publication-content';
import type {PublicationReceipt} from './publication-queue';
export type GitApi=(method:string,path:string,body?:unknown)=>Promise<unknown>;
const sha=z.string().regex(/^[a-f0-9]{40}$/);
const reference=z.object({object:z.object({sha})}),commitResult=z.object({sha});
export function validatePublicationBundle(files:PublicationFile[]){
 if(files.length!==6||new Set(files.map(f=>f.path)).size!==6)throw Error('Incomplete publication bundle');
 for(const locale of ['en','fr','es']){
  const local=files.filter(f=>f.path.startsWith(`content/${locale}/blog/`));
  if(local.length!==2||!local.some(f=>f.path.endsWith('.mdx'))||!local.some(f=>f.path.endsWith('.article.json')))throw Error('Incomplete locale bundle');
 }
 for(const f of files)if(!/^content\/(en|fr|es)\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\.(mdx|article\.json)$/.test(f.path)||Buffer.byteLength(f.content)>1_000_000)throw Error('Unsafe publication path or size');
}
export async function preparePublicationBranch({api,branch,files,message,receipt,checkpoint}:{api:GitApi;branch:string;files:PublicationFile[];message:string;receipt:PublicationReceipt;checkpoint:(receipt:PublicationReceipt)=>Promise<void>}):Promise<PublicationReceipt>{
 validatePublicationBundle(files);
 if(!/^codex\/editorial-[a-z0-9-]+$/.test(branch))throw Error('Invalid publication branch');
 let existing:string|null=null;
 try{existing=reference.parse(await api('GET',`git/ref/heads/${branch}`)).object.sha;}catch(e){if((e as {status?:number}).status!==404)throw e;}
 if(existing){if(!receipt.commit||existing!==receipt.commit)throw Error('Publication branch conflict');return {...receipt,branch};}
 let commit=receipt.commit;
 if(!commit){
  const head=reference.parse(await api('GET','git/ref/heads/main')).object.sha;
  const base=z.object({tree:z.object({sha})}).parse(await api('GET',`git/commits/${head}`)).tree.sha;
  const tree=z.object({tree:z.array(z.object({path:z.string()})),truncated:z.boolean()}).parse(await api('GET',`git/trees/${base}?recursive=1`));
  if(tree.truncated)throw Error('Cannot establish complete content inventory');
  if(files.some(f=>tree.tree.some((entry:{path:string})=>entry.path===f.path)))throw Error('Publication path collision; existing articles require an explicit update workflow');
  const createdTree=commitResult.parse(await api('POST','git/trees',{base_tree:base,tree:files.map(f=>({path:f.path,mode:'100644',type:'blob',content:f.content}))}));
  commit=commitResult.parse(await api('POST','git/commits',{message,tree:createdTree.sha,parents:[head]})).sha;
  if(!commit||!/^[a-f0-9]{40}$/.test(commit))throw Error('Invalid Git commit receipt');
  // Persist intent before the remote ref write. Lost responses resume at GET ref.
  await checkpoint({...receipt,branch,commit});
 }
 await api('POST','git/refs',{ref:`refs/heads/${branch}`,sha:commit});
 return {...receipt,branch,commit};
}
