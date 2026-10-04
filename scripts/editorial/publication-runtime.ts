import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import https from 'node:https';
import type {EditorialVersion} from '../../frontend/src/server/editorial/repository';
import {readEditorialObject,putEditorialObject} from '../../frontend/src/server/editorial/media-storage';
import sharp from '../../frontend/node_modules/sharp';
export function command(file:string,args:string[],options:{cwd?:string;env?:NodeJS.ProcessEnv;input?:string;timeout?:number}={}):Promise<string>{
 return new Promise((resolve,reject)=>{
  const child=spawn(file,args,{cwd:options.cwd,env:options.env??process.env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},options.timeout??60000);
  child.stdout.on('data',d=>{stdout+=d;if(stdout.length>20_000_000)child.kill();});child.stderr.on('data',d=>{stderr=(stderr+d).slice(-3000);});
  child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);if(code===0)resolve(stdout);else {const error=new Error(`Command ${file} ${timedOut?'timeout':'failed'} (${code}): ${stderr}`) as Error & {status?:number};const status=stderr.match(/HTTP (\d{3})/);if(status)error.status=Number(status[1]);reject(error);}});child.stdin.end(options.input);
 });
}
export function githubApi(repository:string){
 if(!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(repository))throw Error('Invalid configured repository');
 return async(method:string,path:string,body?:unknown)=>JSON.parse(await command('gh',['api',`repos/${repository}/${path}`,'--method',method,...(body===undefined?[]:['--input','-'])],{input:body===undefined?undefined:JSON.stringify(body)}));
}
export function publicMediaMap(record:EditorialVersion){return Object.fromEntries(record.draft.assets.map(a=>[a.id,`https://media.maxvideoai.com/${a.storageKey.replace('editorial/drafts/','editorial/published/')}`]));}
export async function verifiedMedia(record:EditorialVersion){
 const items=[];
 for(const asset of record.draft.assets){
  if(!asset.sha256||!/^editorial\/drafts\/[a-f0-9]{64}\.(webp|png|jpg)$/.test(asset.storageKey))throw Error('Invalid private media manifest');
  const bytes=await readEditorialObject(asset.storageKey);
  if(!bytes||bytes.length!==asset.bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Private media integrity mismatch');
  const meta=await sharp(bytes,{limitInputPixels:64_000_000}).metadata();
  if(meta.width!==asset.width||meta.height!==asset.height)throw Error('Private media dimensions mismatch');
  items.push({asset,bytes});
 }
 return items;
}
export async function promoteMedia(record:EditorialVersion,assertAllowed:()=>void){
 if(!record.approvedAt||!record.approvedBy)throw Error('Human approval required before public media');
 const map=publicMediaMap(record);
 for(const {asset,bytes} of await verifiedMedia(record)){
  assertAllowed();
  await putEditorialObject(asset.storageKey.replace('editorial/drafts/','editorial/published/'),bytes,asset.mime,false);
  const response=await fetch(map[asset.id],{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!response.ok||createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')!==asset.sha256)throw Error('Public media verification failed');
 }
 return map;
}
function publicAddress(ip:string){
 if(isIP(ip)===6)return /^2[0-9a-f]{3}:/i.test(ip)&&!/^2001:(db8|0):/i.test(ip);
 if(isIP(ip)!==4)return false;const [a,b]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));
}
/** Public HTTPS only, pinned DNS, no cookies/credentials, validates every redirect. */
export async function checkPublicLink(raw:string,redirects=0):Promise<number>{
 const url=new URL(raw,'https://maxvideoai.com');
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||redirects>5)throw Error('Unsafe source link');
 const addresses=await lookup(url.hostname,{all:true});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('Non-public source address');
 const chosen=addresses.find(a=>a.family===4)??addresses[0];
 return new Promise((resolve,reject)=>{
  const req=https.request(url,{method:'GET',headers:{'User-Agent':'MaxVideoAI-Editorial-LinkCheck/1.0'},lookup:((_host:any,_opts:any,cb:any)=>{if(_opts?.all)cb(null,[chosen]);else cb(null,chosen.address,chosen.family);}) as any},res=>{
   const status=res.statusCode??0,location=res.headers.location;res.destroy();
   if(status>=300&&status<400&&location)checkPublicLink(new URL(location,url).href,redirects+1).then(resolve,reject);else resolve(status);
  });req.setTimeout(15000,()=>req.destroy(Error('Source link timeout')));req.on('error',reject);req.end();
 });
}
