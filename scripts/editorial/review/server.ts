import {createServer, type IncomingMessage} from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {getEditorialVersion} from '../../../frontend/src/server/editorial/repository';
import {requestEditorialCorrection,listEditorialCorrections} from '../../../frontend/src/server/editorial/corrections';
import {reviewGrantSchema,validateReviewAccess,assertReviewOrigin} from '../../../frontend/src/server/editorial/review-access';
import {reviewPage} from './page';

const stateDir=process.env.EDITORIAL_REVIEW_STATE_DIR;
const mediaDir=process.env.EDITORIAL_LOCAL_MEDIA_DIR;
const db=process.env.DATABASE_URL;
if(!stateDir||!path.isAbsolute(stateDir)||!mediaDir||!path.isAbsolute(mediaDir)||!db||new URL(db).hostname!=='127.0.0.1')throw Error('Review trial requires explicit private directories and loopback database');
const port=Number(process.env.EDITORIAL_REVIEW_PORT??5684);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid review port');
const localOrigin=`http://127.0.0.1:${port}`;
async function jsonBody(req:IncomingMessage){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>8192)throw Error('Body too large');}return JSON.parse(data);}
let loginWindow=0,loginCount=0;
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
 const reply=(code:number,body:string,type='text/plain; charset=utf-8')=>{res.statusCode=code;res.setHeader('Content-Type',type);res.end(body);};
 try{
  const url=new URL(req.url??'/',localOrigin);
  const runtime=JSON.parse(await readFile(path.join(stateDir,'runtime.json'),'utf8'));
  const origins=[localOrigin,...(runtime.publicOrigin?[runtime.publicOrigin]:[])];
  if(!origins.some(o=>new URL(o).host===req.headers.host))return reply(403,'Forbidden host');
  if(req.method==='POST')assertReviewOrigin(req.headers.origin,origins);
  const grant=reviewGrantSchema.parse(JSON.parse(await readFile(path.join(stateDir,'grant.json'),'utf8')));
  if(url.pathname==='/session'&&req.method==='POST'){
   if(Date.now()-loginWindow>60000){loginWindow=Date.now();loginCount=0;}if(++loginCount>30)return reply(429,'Please wait');
   const {token}=await jsonBody(req);
   if(typeof token!=='string'||!validateReviewAccess(grant,token))return reply(401,'Invalid access');
   const secure=req.headers.host!==`127.0.0.1:${port}`;
   res.setHeader('Set-Cookie',`editorial_review=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.max(0,Math.floor((Date.parse(grant.expiresAt)-Date.now())/1000))}${secure?'; Secure':''}`);
   return reply(200,'{"ok":true}','application/json');
  }
  const token=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('editorial_review='))?.slice(17)??'';
  const authorized=validateReviewAccess(grant,token);
  if(!authorized){
   if(url.pathname==='/'&&req.method==='GET'){const page=reviewPage();res.setHeader('Content-Security-Policy',csp(page.nonce));return reply(200,page.html,'text/html; charset=utf-8');}
   return reply(401,'Private review');
  }
  const record=await getEditorialVersion(grant.articleId,grant.version);
  if(!record||record.digest!==grant.digest)return reply(409,'Review version changed');
  if(url.pathname==='/'&&req.method==='GET'){
   const locale=url.searchParams.get('locale');
   const page=reviewPage(record,locale==='fr'||locale==='es'?locale:'en',await listEditorialCorrections(record.articleId,record.version));
   res.setHeader('Content-Security-Policy',csp(page.nonce));return reply(200,page.html,'text/html; charset=utf-8');
  }
  if(req.method==='GET'&&/^\/media\/[a-z][a-z0-9-]{1,63}$/.test(url.pathname)){
   const asset=record.draft.assets.find(a=>a.id===url.pathname.split('/')[2]);
   if(!asset?.sha256)return reply(404,'Media unavailable');
   const buffer=await readFile(path.join(mediaDir,path.basename(asset.storageKey)));
   if(buffer.length!==asset.bytes||createHash('sha256').update(buffer).digest('hex')!==asset.sha256)return reply(409,'Media integrity mismatch');
   res.setHeader('Content-Type',asset.mime);res.setHeader('Content-Length',buffer.length);return res.end(buffer);
  }
  if(req.method==='POST'&&url.pathname==='/corrections'){
   const input=await jsonBody(req);
   if(input.articleId!==grant.articleId||input.version!==grant.version||input.digest!==grant.digest)return reply(409,'Exact review version required');
   try{const result=await requestEditorialCorrection(input,'owner-review-link');
    const inbox=path.join(stateDir,'corrections');await mkdir(inbox,{recursive:true,mode:0o700});
    const destination=path.join(inbox,input.requestId+'.json');
    await writeFile(destination+'.tmp',JSON.stringify({status:'pending',batchId:runtime.batchId,articleId:grant.articleId,version:grant.version,digest:grant.digest,eventId:result.id,input},null,2),{mode:0o600});await rename(destination+'.tmp',destination);
    return reply(200,JSON.stringify({...result,published:false}),'application/json');}
   catch(error){return reply(/latest exact|already used/.test((error as Error).message)?409:400,'Correction not recorded');}
  }
  return reply(404,'Not found');
 }catch(error){return reply((error as Error).message==='Forbidden origin'?403:400,'Review unavailable');}
});
function csp(nonce:string){return `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'self'; frame-src https://www.youtube-nocookie.com; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`;}
server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=30;
server.listen(port,'127.0.0.1',()=>console.log('Private editorial trial review listening on loopback port',port));
