import {buildPublicStorageUrl,getStorageObjectBuffer,uploadFileBufferToKey,StorageUploadError} from '@/server/storage';
import {storeDraftEditorialMedia} from './media-upload';
export async function readEditorialObject(key:string):Promise<Buffer|null>{
 try{return await getStorageObjectBuffer(key,{signal:AbortSignal.timeout(15000)});}catch(e){
  const error=e as {name?:string;$metadata?:{httpStatusCode?:number}};
  if(error.name==='NoSuchKey'||error.$metadata?.httpStatusCode===404)return null;throw e;
 }
}
export async function putEditorialObject(key:string,data:Buffer,mime:string,isPrivate:boolean){
 try{await uploadFileBufferToKey({key,data,mime,acl:null,conditionalCreate:true,cacheControl:isPrivate?'private, no-store':'public, max-age=31536000, immutable',signal:AbortSignal.timeout(20000)});}
 catch(e){if(!(e instanceof StorageUploadError)||e.context.code!=='precondition-conflict')throw e;const existing=await readEditorialObject(key);if(!existing?.equals(data))throw Error('Immutable media conflict');}
}
export async function uploadEditorialDraftMedia(data:Buffer,mime:string,sha256:string){
 if(process.env.EDITORIAL_DRAFT_MEDIA_PRIVATE_CONFIRMED!=='1')throw Error('Private draft storage policy required');
 return storeDraftEditorialMedia(data,mime,sha256,{read:readEditorialObject,put:(key,bytes,type)=>putEditorialObject(key,bytes,type,true),assertPrivate:async key=>{
  const response=await fetch(buildPublicStorageUrl(key),{method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(10000)});await response.body?.cancel();
  if(![401,403,404].includes(response.status))throw Error('Draft object privacy could not be verified');
 }});
}
