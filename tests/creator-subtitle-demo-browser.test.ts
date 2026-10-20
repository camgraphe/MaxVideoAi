import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from '@playwright/test';
import {createCreatorMarketingFixture} from './helpers/creator-marketing-browser-fixture';

test('subtitle demonstration plays real exports only on intent and preserves playback when switching styles', {timeout:90_000},async()=>{
 const fixture=await createCreatorMarketingFixture(),browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),requests:string[]=[],errors:string[]=[];
  page.on('request',request=>{if(request.url().includes('.mp4'))requests.push(request.url())});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(fixture.url+'/en/subtitles');await page.waitForFunction(()=>!!(window as any).creatorReady);
  await page.locator('video').scrollIntoViewIfNeeded();await page.waitForTimeout(250);assert.deepEqual(requests,[],'manual demo must not fetch video before playback');
  const video=page.locator('video');await page.getByRole('button',{name:'Play the scene',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('video')!.currentTime>.3);
  assert.deepEqual(await video.evaluate((v:HTMLVideoElement)=>[v.videoWidth,v.videoHeight]),[854,480]);
  assert.ok(Math.abs(await video.evaluate((v:HTMLVideoElement)=>v.duration)-12)<.15);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('slider',{name:'Playback position'}).fill('1.1');await page.waitForFunction(()=>!document.querySelector('video')!.seeking);
  await page.getByRole('button',{name:'Mute',exact:true}).click();assert.equal(await video.evaluate((v:HTMLVideoElement)=>v.muted),true);
  await page.getByRole('button',{name:'Turn sound on',exact:true}).click();assert.equal(await video.evaluate((v:HTMLVideoElement)=>v.muted),false);
  await page.getByRole('button',{name:'Full screen',exact:true}).click();await page.waitForFunction(()=>!!document.fullscreenElement);
  await page.getByRole('button',{name:'Full screen',exact:true}).click();await page.waitForFunction(()=>!document.fullscreenElement);
  const pixels=()=>video.evaluate((v:HTMLVideoElement)=>{const c=document.createElement('canvas');c.width=854;c.height=480;const ctx=c.getContext('2d')!;ctx.drawImage(v,0,0);return Array.from(ctx.getImageData(0,340,854,100).data)});
  const pop=await pixels();await page.getByRole('button',{name:'Cinema',exact:true}).click();await page.waitForFunction(()=>{const v=document.querySelector('video')!;return v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-1.1)<.2});
  const cinema=await pixels();assert.ok(pop.reduce((n,v,i)=>n+Math.abs(v-cinema[i]),0)/pop.length>1,'rendered caption styles must differ in actual decoded pixels');
  assert.equal(await video.evaluate((v:HTMLVideoElement)=>v.paused),true,'paused selection must remain paused');
  await video.evaluate((v:HTMLVideoElement)=>v.play());await page.getByRole('button',{name:'Contrast',exact:true}).click();
  await page.waitForFunction(()=>{const v=document.querySelector('video')!;return v.readyState>=2&&!v.paused&&v.currentTime>1});
  assert.match(await video.getAttribute('src')??'',/high-contrast/);
  assert.equal(await page.locator('a[download]').getAttribute('href'),await video.getAttribute('src'));
  await page.getByRole('checkbox',{name:'Without captions'}).check();await page.waitForFunction(()=>document.querySelector('video')!.readyState>=2);assert.match(await video.getAttribute('src')??'',/original/);
  assert.deepEqual(errors,[]);await page.close();
 }finally{await browser.close();await fixture.close()}
});
