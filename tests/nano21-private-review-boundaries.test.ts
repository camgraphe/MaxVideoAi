import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { JSDOM } from 'jsdom';
import { buildNano21PrivateReview } from '../scripts/lib/nano21-editorial-review';
import { nano21EditorialFixture } from './helpers/nano21-editorial-fixture';

function pngChunk(type: string, data: Buffer) {
  const body=Buffer.concat([Buffer.from(type),data]),chunk=Buffer.alloc(data.length+12);
  chunk.writeUInt32BE(data.length);body.copy(chunk,4);
  let crc=0xffffffff;
  for(const byte of body){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}
  chunk.writeUInt32BE((crc^0xffffffff)>>>0,chunk.length-4);return chunk;
}

function animatedPng(still: Buffer) {
  const chunks:Array<{type:string;data:Buffer}>=[];
  for(let offset=8;offset+12<=still.length;){const length=still.readUInt32BE(offset);
    chunks.push({type:still.toString('ascii',offset+4,offset+8),data:still.subarray(offset+8,offset+8+length)});offset+=length+12;}
  const header=chunks.find(chunk=>chunk.type==='IHDR')!.data;
  const pixels=Buffer.concat(chunks.filter(chunk=>chunk.type==='IDAT').map(chunk=>chunk.data));
  const animation=Buffer.alloc(8);animation.writeUInt32BE(2);
  const control=(sequence:number)=>{const bytes=Buffer.alloc(26);bytes.writeUInt32BE(sequence);header.subarray(0,8).copy(bytes,4);bytes.writeUInt16BE(1,20);bytes.writeUInt16BE(10,22);return bytes;};
  const frame=Buffer.alloc(pixels.length+4);frame.writeUInt32BE(2);pixels.copy(frame,4);
  return Buffer.concat([still.subarray(0,8),pngChunk('IHDR',header),pngChunk('acTL',animation),pngChunk('fcTL',control(0)),
    pngChunk('IDAT',pixels),pngChunk('fcTL',control(1)),pngChunk('fdAT',frame),pngChunk('IEND',Buffer.alloc(0))]);
}

async function fixture() {
  const directory=await mkdtemp(join(tmpdir(),'nano21-review-boundary-'));
  const originalFile=join(directory,'original.png'),displayFile=join(directory,'display.png'),responseFile=join(directory,'response.json');
  const bytes=await sharp({create:{width:64,height:36,channels:3,background:'#123456'}}).png().toBuffer();
  const record=nano21EditorialFixture();
  const draft={...record,status:'draft',media:{originalFile,displayFile},provenance:{kind:'external_vertex',location:'global',generatedAt:record.provenance.generatedAt,responseFile}};
  const replace=async(original:Buffer,display=bytes)=>Promise.all([writeFile(originalFile,original),writeFile(displayFile,display),writeFile(responseFile,
    JSON.stringify({candidates:[{content:{parts:[{inlineData:{data:original.toString('base64')}}]}}]}))]);
  await replace(bytes);
  return {directory,bytes,draft,replace,close:()=>rm(directory,{recursive:true,force:true})};
}

test('the real private-review CLI refuses direct and symlink-served lexical outputs and still writes only private new files',async t=>{
  const f=await fixture();
  const run=promisify(execFile),input=join(f.directory,'draft.json');
  await writeFile(input,JSON.stringify(f.draft));
  const cli=async(output:string)=>{
    try{return {code:0,...await run('pnpm',['exec','tsx','--tsconfig','frontend/tsconfig.json','scripts/preview-nano21-editorial.ts',input,output],{cwd:process.cwd(),timeout:20000})};}
    catch(error){const result=error as {code:number;stdout:string;stderr:string};return {code:result.code,stdout:result.stdout,stderr:result.stderr};}
  };
  try{
    const privateDir=join(f.directory,'private');await mkdir(privateDir);
    for(const name of ['public','.next']) await t.test(name,async()=>{
      const served=join(f.directory,name);await mkdir(served);
      const outward=join(served,'outward');await symlink(privateDir,outward);
      const inverse=join(f.directory,`looks-private-${name}`);await symlink(served,inverse);
      for(const [label,output] of [['direct',join(served,'direct.html')],['outward',join(outward,`${name}-outward.html`)],
        ['inverse',join(inverse,'inverse.html')],['normalized',join(served,'outward','..','outward',`${name}-normalized.html`)]]){
        const result=await cli(output);
        assert.equal(result.code,1,`${label} ${name} path must be refused: ${result.stderr}`);
        assert.match(result.stderr,/publicly served/);
        await assert.rejects(()=>stat(output),{code:'ENOENT'});
      }
    });
    await t.test('private new output and no overwrite',async()=>{
      const output=join(privateDir,'review.html');
      assert.equal((await cli(output)).code,0);
      assert.match(await readFile(output,'utf8'),/Private Nano21 draft review/);
      assert.equal((await stat(output)).mode&0o777,0o600);
      assert.equal((await cli(output)).code,1);
    });
  }finally{await f.close();}
});

test('private review fully decodes bounded single-frame bytes and separates declarations from measurements',async t=>{
  const f=await fixture();
  try{
    await t.test('declared model/settings/date are not presented as measured or authenticated facts',async()=>{
      const html=await buildNano21PrivateReview(f.draft),dom=new JSDOM(html);
      const declared=JSON.parse(dom.window.document.querySelector('[data-declared-facts]')?.textContent??'null');
      const measured=JSON.parse(dom.window.document.querySelector('[data-measured-facts]')?.textContent??'null');
      assert.equal(declared?.modelId,'gemini-nano-banana-2.1');assert.equal(declared?.settings.maxOutputTokens,4096);
      assert.equal(declared?.generatedAt,'2026-10-25T12:00:00Z');
      assert.deepEqual(Object.keys(measured).sort(),['display','original','promptSha256','responseSha256','suppliedResponseContainsOriginal']);
      assert.equal(measured.suppliedResponseContainsOriginal,true);assert.equal(measured.original.width,64);
      assert.equal(measured.display.height,36);dom.window.close();
    });
    const noisy=await sharp(Buffer.from(Uint8Array.from({length:64*36*3},(_,i)=>(i*37+Math.floor(i/192))&255)),{raw:{width:64,height:36,channels:3}}).png().toBuffer();
    const truncated=noisy.subarray(0,Math.floor(noisy.length/2));
    assert.equal((await sharp(truncated).metadata()).width,64,'fixture keeps a readable header but incomplete pixels');
    const animated=await sharp(Buffer.concat([Buffer.alloc(8*8*3,0x20),Buffer.alloc(8*8*3,0xd0)]),
      {raw:{width:8,height:16,channels:3,pageHeight:8}}).webp({loop:0,delay:[100,100]}).toBuffer();
    assert.equal((await sharp(animated).metadata()).pages,2,'fixture is actually animated');
    const apng=animatedPng(f.bytes);
    assert.equal((await sharp(apng).metadata()).width,64);
    for(const [label,bytes] of [['truncated',truncated],['animated WebP',animated],['animated PNG',apng]] as const){
      for(const target of ['original','display']) await t.test(`${label} ${target}`,async()=>{
        await f.replace(target==='original'?bytes:f.bytes,target==='display'?bytes:f.bytes);
        await assert.rejects(()=>buildNano21PrivateReview(f.draft));
      });
    }
    await t.test('pixel budget rejects a readable oversized still before full decode',async()=>{
      const oversized=await sharp({create:{width:4097,height:4096,channels:3,background:'#123456'}}).png().toBuffer();
      assert.equal((await sharp(oversized).metadata()).width,4097);
      await f.replace(oversized);
      await assert.rejects(()=>buildNano21PrivateReview(f.draft));
    });
    await t.test('malformed image',async()=>{
      await f.replace(Buffer.from('not an image'));
      await assert.rejects(()=>buildNano21PrivateReview(f.draft));
    });
  }finally{await f.close();}
});
