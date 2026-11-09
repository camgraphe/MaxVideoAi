/** JSDOM has no layout or ResizeObserver. Supply geometry, never collection behavior. */
export function installMediaGridGeometry(w:any) {
 w.requestAnimationFrame??=(callback:any)=>w.setTimeout(()=>callback(Date.now()),0);w.cancelAnimationFrame??=(id:number)=>w.clearTimeout(id);
 w.CSS={escape:(value:string)=>Array.from(String(value)).map(c=>'\\'+c.codePointAt(0)!.toString(16)+' ').join('')};
 w.ResizeObserver=class {constructor(private callback:any){} observe(target:any){Promise.resolve().then(()=>this.callback([{target,contentRect:{width:900,height:600},borderBoxSize:[{inlineSize:900,blockSize:600}]}]));}unobserve(){}disconnect(){}};
 Object.defineProperties(w.HTMLElement.prototype,{clientWidth:{configurable:true,get:()=>900},clientHeight:{configurable:true,get:()=>600},offsetWidth:{configurable:true,get:()=>900},offsetHeight:{configurable:true,get:()=>600}});
 w.HTMLElement.prototype.getBoundingClientRect=()=>({width:900,height:600,top:0,left:0,right:900,bottom:600});
 w.HTMLElement.prototype.getClientRects=function(){return [this.getBoundingClientRect()];};
 w.HTMLElement.prototype.scrollIntoView=function(){};
}
export function mediaGridGlobals(w:any) {
 installMediaGridGeometry(w);
 return Object.fromEntries(['CSS','Element','Node','NodeFilter','SVGElement','MutationObserver','ResizeObserver','HTMLInputElement','HTMLSelectElement','HTMLButtonElement','KeyboardEvent','MouseEvent','HTMLDivElement','HTMLTextAreaElement'].map(key=>[key,w[key]]).concat(['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,w[key].bind(w)])));
}
