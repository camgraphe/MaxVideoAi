import {JSDOM} from 'jsdom';
const languages=['en','fr','es'];
function alternatesMatch(node:ParentNode,urls:string[]){
 for(let i=0;i<languages.length;i++){
  const links=Array.from(node.querySelectorAll('[hreflang]')).filter(e=>e.getAttribute('rel')==='alternate'&&e.getAttribute('hreflang')?.split('-')[0]===languages[i]);
  if(!links.length||links.some(e=>e.getAttribute('href')!==urls[i]))throw Error('Missing or incorrect localized alternate');
 }
}
export function validatePublishedHtml(html:string,{digest,url,urls}:{digest:string;url:string;urls:string[]}){
 const dom=new JSDOM(html);try{
  const d=dom.window.document;
  if(d.querySelectorAll('link[rel="canonical"]').length!==1||d.querySelector('link[rel="canonical"]')?.getAttribute('href')!==url)throw Error('Canonical mismatch');
  if(Array.from(d.querySelectorAll('meta[name="robots"],meta[name="googlebot"]')).some(e=>/noindex|none/i.test(e.getAttribute('content')??'')))throw Error('Public article is noindex');
  if(d.querySelectorAll('h1').length!==1||d.querySelector('[data-editorial-digest]')?.getAttribute('data-editorial-digest')!==digest)throw Error('Published content mismatch');
  alternatesMatch(d,urls);
  const schemas=Array.from(d.querySelectorAll('script[type="application/ld+json"]')).flatMap(e=>{const value=JSON.parse(e.textContent??'');return Array.isArray(value)?value:value['@graph']??[value];});
  const a=schemas.find(s=>s['@type']==='Article');
  if(!a||a.mainEntityOfPage?.['@id']!==url||!a.headline||!a.image||!Number.isFinite(Date.parse(a.datePublished))||!Number.isFinite(Date.parse(a.dateModified))||!schemas.some(s=>s['@type']==='BreadcrumbList'))throw Error('Missing or invalid article JSON-LD');
 }finally{dom.window.close();}
}
export function validatePublicationSitemap(xml:string,url:string,urls:string[]){
 const dom=new JSDOM(xml,{contentType:'text/xml'});try{
  const nodes=Array.from(dom.window.document.querySelectorAll('url')).filter(n=>n.querySelector('loc')?.textContent===url);
  if(nodes.length!==1)throw Error('Article missing or duplicated in sitemap');
  alternatesMatch(nodes[0],urls);
 }finally{dom.window.close();}
}
