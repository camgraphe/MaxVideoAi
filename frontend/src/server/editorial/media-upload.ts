import {createHash} from 'node:crypto';
import sharp from 'sharp';
export const EDITORIAL_MEDIA_MAX_BYTES=5_000_000;
type MediaDependencies={read:(key:string)=>Promise<Buffer|null>;put:(key:string,data:Buffer,mime:string)=>Promise<void>;assertPrivate:(key:string)=>Promise<void>};
export async function storeDraftEditorialMedia(data:Buffer,mime:string,expectedHash:string,dependencies:MediaDependencies){
 if(!data.length||data.length>EDITORIAL_MEDIA_MAX_BYTES)throw Error('Editorial image size invalid');
 const sha256=createHash('sha256').update(data).digest('hex');if(sha256!==expectedHash)throw Error('Image hash mismatch');
 const formats={'image/webp':'webp','image/png':'png','image/jpeg':'jpeg'} as const;
 const format=formats[mime as keyof typeof formats];if(!format)throw Error('Unsupported image format');
 const metadata=await sharp(data,{limitInputPixels:64_000_000}).metadata();
 if(metadata.format!==format||(metadata.pages??1)>1)throw Error('Image format mismatch');
 const {width,height}=metadata;if(!width||!height||width<320||height<160||width>8000||height>8000)throw Error('Image dimensions invalid');
 const storageKey=`editorial/drafts/${sha256}.${format==='jpeg'?'jpg':format}`;
 const existing=await dependencies.read(storageKey);
 if(existing){if(!existing.equals(data))throw Error('Immutable media conflict');}
 else await dependencies.put(storageKey,data,mime);
 await dependencies.assertPrivate(storageKey);
 return {storageKey,sha256,mime,width,height,bytes:data.length};
}
