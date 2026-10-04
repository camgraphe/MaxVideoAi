import { makeEditorialDraft } from './editorial-draft.ts';
import { parseEditorialDraft, digestEditorialDraft } from '../../frontend/lib/editorial/schema.ts';
export function checkedFixture(){
 const draft=parseEditorialDraft(makeEditorialDraft());draft.assets[0].sha256='a'.repeat(64);const digest=digestEditorialDraft(draft);
 const report={digest,rendererVersion:'editorial-reader-v2',checkedAt:new Date().toISOString(),links:[{url:'https://example.org/shot-list',status:200},{url:'/tools',status:200}],media:[{id:'a1',sha256:'a'.repeat(64),bytes:120000,width:1200,height:630}],views:['en','fr','es'].flatMap(locale=>[360,768,1440].map(width=>({locale,width,failures:[],title:draft.locales[locale as 'en'|'fr'|'es'].title+' — MaxVideo AI',description:draft.locales[locale as 'en'|'fr'|'es'].description,canonical:`https://maxvideoai.com${locale==='en'?'':`/${locale}`}/blog/shot-list-${locale}`,languages:['en','fr','es'],schemaTypes:['Article','BreadcrumbList'],h1Count:1,imagesLoaded:1})))};
 return {draft,digest,report};
}
