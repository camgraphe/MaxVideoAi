import test from 'node:test';import assert from 'node:assert/strict';
import {validatePublishedHtml,validatePublicationSitemap} from '../scripts/editorial/publication-verification';
const urls=['https://maxvideoai.com/blog/demo','https://maxvideoai.com/fr/blog/demo-fr','https://maxvideoai.com/es/blog/demo-es'];
const html=`<html><head><link rel="canonical" href="${urls[0]}">${urls.map((u,i)=>`<link rel="alternate" hreflang="${['en','fr','es'][i]}" href="${u}">`).join('')}<script type="application/ld+json">${JSON.stringify({'@type':'Article',headline:'Demo',mainEntityOfPage:{'@id':urls[0]},datePublished:'2026-09-21T12:00:00Z',dateModified:'2026-09-21T12:00:00Z',image:'https://media.maxvideoai.com/demo.webp'})}</script><script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script></head><body><h1>Demo</h1><div data-editorial-digest="${'a'.repeat(64)}"></div></body></html>`;
test('deployment proof requires actual JSON-LD scripts, correct alternates, exact content and no noindex',()=>{
 assert.doesNotThrow(()=>validatePublishedHtml(html,{digest:'a'.repeat(64),url:urls[0],urls}));
 for(const bad of [html.replace('application/ld+json','text/plain'),html.replace(urls[2],urls[1]),html.replace('a'.repeat(64),'b'.repeat(64)),html.replace('</head>','<meta name="robots" content="noindex"></head>'),html.replace('"@type":"Article"','bad JSON')])assert.throws(()=>validatePublishedHtml(bad,{digest:'a'.repeat(64),url:urls[0],urls}));
});
test('sitemap proof requires URL and reciprocal localized links in its own entry',()=>{
 const entry=`<url><loc>${urls[0]}</loc>${urls.map((u,i)=>`<xhtml:link rel="alternate" hreflang="${['en','fr','es'][i]}" href="${u}"/>`).join('')}</url>`;
 assert.doesNotThrow(()=>validatePublicationSitemap(`<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml">${entry}</urlset>`,urls[0],urls));
 assert.throws(()=>validatePublicationSitemap('<urlset/>',urls[0],urls));
 assert.throws(()=>validatePublicationSitemap(`<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml">${entry.replace(urls[2],urls[1])}</urlset>`,urls[0],urls));
});
