import test from 'node:test';import assert from 'node:assert/strict';
import {preparePublicationBranch} from '../frontend/src/server/editorial/publication-git';
const files=['en','fr','es'].flatMap(l=>[{path:`content/${l}/blog/shot-list-${l}.mdx`,content:'metadata '+l},{path:`content/${l}/blog/shot-list-${l}.article.json`,content:'{}'}]);
test('publication creates all locales in one tree, preserves base tree and recovers a lost ref response',async()=>{
 let ref:string|null=null;let commits=0;let trees=0;let saved:any={};let first=true;
 const api=async(method:string,path:string,body?:any):Promise<any>=>{
  if(path==='git/ref/heads/codex/editorial-test'){if(!ref){const e:any=new Error('not found');e.status=404;throw e;}return {object:{sha:ref}};}
  if(path==='git/ref/heads/main')return {object:{sha:'a'.repeat(40)}};
  if(path==='git/commits/'+ 'a'.repeat(40))return {tree:{sha:'b'.repeat(40)}};
  if(path.startsWith('git/trees/')&&method==='GET')return {tree:[],truncated:false};
  if(path==='git/trees'){trees++;assert.equal(body.base_tree,'b'.repeat(40));assert.equal(body.tree.length,6);return {sha:'c'.repeat(40)};}
  if(path==='git/commits'){commits++;assert.deepEqual(body.parents,['a'.repeat(40)]);return {sha:'d'.repeat(40)};}
  if(path==='git/refs'){ref=body.sha;if(first){first=false;throw Error('response lost');}return {};}
  throw Error('unexpected '+method+' '+path);
 };
 await assert.rejects(preparePublicationBranch({api,branch:'codex/editorial-test',files,message:'publish',receipt:saved,checkpoint:async r=>{saved=r;}}),/lost/);
 const result=await preparePublicationBranch({api,branch:'codex/editorial-test',files,message:'publish',receipt:saved,checkpoint:async r=>{saved=r;}});
 assert.equal(result.commit,ref);assert.equal(commits,1);assert.equal(trees,1);
});
test('publication refuses existing content and unsafe or incomplete paths',async()=>{
 const api=async(_method:string,path:string):Promise<any>=>{if(path.endsWith('codex/editorial-test')){const e:any=new Error();e.status=404;throw e;}if(path.startsWith('git/ref'))return {object:{sha:'a'.repeat(40)}};if(path.startsWith('git/commits'))return {tree:{sha:'b'.repeat(40)}};return {tree:[{path:files[0].path}],truncated:false};};
 const args={api,branch:'codex/editorial-test',files,message:'publish',receipt:{},checkpoint:async()=>{}};
 await assert.rejects(preparePublicationBranch(args),/collision/i);
 await assert.rejects(preparePublicationBranch({...args,files:files.slice(1)}),/bundle/i);
 await assert.rejects(preparePublicationBranch({...args,files:[...files.slice(1),{path:'.github/workflows/evil.yml',content:'evil'}]}),/path|bundle/i);
});
