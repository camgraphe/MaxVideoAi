import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=(await readFile(new URL('./playback.mjs',import.meta.url),'utf8')).replace('export function','function')+'\ncreateHeroPlayer';
function harness({auto=true,small=false}={}){
 class Element {
  constructor(){this.events={};this.attrs={};this.paused=true;this.src='';this.playCount=0;this.classList={add(){},remove(){}};}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  emit(name){for(const fn of this.events[name]??[])fn({});}
  setAttribute(name,value){this.attrs[name]=value;}
  removeAttribute(name){if(name==='src')this.src='';delete this.attrs[name];}
  play(){this.paused=false;this.playCount++;return Promise.resolve();}
  pause(){this.paused=true;this.emit('pause');}
  load(){}
  remove(){this.removed=true;}
 }
 const nodes=[],doc=new Element();doc.hidden=false;doc.createElement=()=>{const v=new Element();nodes.push(v);return v;};
 let observer;
 const create=vm.runInNewContext(source,{document:doc,navigator:{},matchMedia:()=>({matches:small}),IntersectionObserver:class{constructor(fn){observer=fn;}observe(){}unobserve(){}}});
 const playButton=new Element(),soundButton=new Element(),status=new Element();
 const data={original:'https://media.example/original.mp4',desktop:'https://media.example/desktop.mp4',mobile:'https://media.example/mobile.mp4',src:'poster.webp',alt:'Poster'};
 const player=create({mount:{append(){}},film:new Element(),poster:new Element(),playButton,soundButton,status,data,copy:{play:'play',pause:'pause',sound:'sound',mute:'mute',loading:'loading',error:'error'},canAuto:()=>auto,onProgress(){}});
 return{player,nodes,doc,playButton,status,data,visibility:v=>observer([{isIntersecting:v}])};
}
test('no video mounts without intent; visibility preserves a manual pause',()=>{
 const h=harness();assert.equal(h.nodes.length,0);
 h.visibility(false);h.player.auto();assert.equal(h.nodes.length,0);
 h.visibility(true);const video=h.nodes[0];assert.equal(video.playCount,1);video.emit('playing');
 h.playButton.emit('click');assert.equal(video.paused,true);
 h.visibility(false);h.visibility(true);h.player.auto();assert.equal(video.playCount,1);
});
test('hidden or suspended readers pause and resume only existing intent',()=>{
 const h=harness();h.player.auto();const video=h.nodes[0];video.emit('playing');
 h.doc.hidden=true;h.doc.emit('visibilitychange');assert.equal(video.paused,true);
 h.doc.hidden=false;h.doc.emit('visibilitychange');assert.equal(video.playCount,2);
 h.player.suspend(true);h.visibility(false);h.visibility(true);assert.equal(video.playCount,2);
 h.player.suspend(false);assert.equal(video.playCount,3);
});
test('derivative failure falls back once; errors from replaced videos are ignored',()=>{
 const h=harness();h.player.auto();const old=h.nodes[0];
 old.emit('error');assert.equal(old.src,h.data.original);const count=old.playCount;
 old.emit('error');assert.equal(old.playCount,count);assert.equal(h.status.textContent,'error');
 h.player.select({...h.data,original:'https://media.example/next.mp4'});const current=h.nodes[1];
 old.emit('error');old.emit('playing');assert.equal(current.playCount,1);assert.equal(old.removed,true);
});
test('restricted autoplay stays idle; an explicit action selects the mobile rendition',()=>{
 const h=harness({auto:false,small:true});h.player.auto();assert.equal(h.nodes.length,0);
 h.playButton.emit('click');assert.equal(h.nodes.length,1);assert.equal(h.nodes[0].src,h.data.mobile);
 h.player.reduce();assert.equal(h.nodes[0].paused,true);
 h.visibility(false);h.visibility(true);assert.equal(h.nodes[0].playCount,1);
});
test('moving the reader releases the old video and targets the selected panel',()=>{
 const h=harness();h.player.auto();const old=h.nodes[0];old.emit('playing');
 const mounted=[],poster={};
 h.player.move({mount:{append(node){mounted.push(node);}},film:{classList:{add(){},remove(){}}},poster});
 assert.equal(old.removed,true);assert.equal(old.paused,true);assert.equal(old.src,'');
 h.player.select({...h.data,src:'second.webp',alt:'Second scene'});
 assert.equal(mounted.length,1);assert.equal(mounted[0],h.nodes[1]);assert.equal(poster.src,'second.webp');
 assert.equal(poster.alt,'Second scene');
 old.emit('error');assert.equal(mounted[0].src,h.data.desktop);
});
