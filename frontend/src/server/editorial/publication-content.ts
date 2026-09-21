import {validateEditorialCheckReport} from '@/lib/editorial/checks';
import {digestEditorialDraft} from '@/lib/editorial/schema';
import {publicEditorialArticleSchema,type PublicEditorialArticle} from '@/lib/editorial/public-article';
import type {EditorialVersion} from './repository';

export type PublicationFile={path:string;content:string};
export function projectPublicEditorialArticle(record:EditorialVersion,locale:'en'|'fr'|'es',media:Record<string,string>):PublicEditorialArticle{
 const draft=record.draft;
 return publicEditorialArticleSchema.parse({schemaVersion:1,canonicalSlug:draft.canonicalSlug,
  publication:{articleId:record.articleId,version:record.version,digest:record.digest,publishedAt:record.approvedAt??record.createdAt},
  article:draft.locales[locale],
  sources:draft.sources.map(({id,title,publisher,url,retrievedAt,publishedAt})=>({id,title,publisher,url,retrievedAt,...(publishedAt?{publishedAt}:{})})),
  assets:draft.assets.map(({id,kind,width,height,sha256})=>({id,kind,width,height,sha256,url:media[id]})),
 });
}
export function buildEditorialPublicationFiles(record:EditorialVersion,media:Record<string,string>,checks:unknown){
 if(!record.approvedAt||!record.approvedBy)throw Error('Human approval required');
 if(digestEditorialDraft(record.draft)!==record.digest)throw Error('Approved digest mismatch');
 if(record.draft.assets.some(a=>!media[a.id]))throw Error('Public media missing');
 if(!checks)throw Error('Publication checks required');
 validateEditorialCheckReport(record.draft,record.digest,checks);
 return buildEditorialPreviewFiles(record,media);
}
/** Files for an isolated private QA checkout only; this never authorizes publication. */
export function buildEditorialPreviewFiles(record:EditorialVersion,media:Record<string,string>){
 if(digestEditorialDraft(record.draft)!==record.digest)throw Error('Candidate digest mismatch');
 const files:PublicationFile[]=[],slugs={} as Record<'en'|'fr'|'es',string>;
 for(const locale of ['en','fr','es'] as const){
  const artifact=projectPublicEditorialArticle(record,locale,media),a=artifact.article;slugs[locale]=a.slug;
  const hero=a.blocks.find(b=>b.type==='media'),image=hero?.type==='media'?media[hero.assetId]:undefined;
  const metadata={title:a.title,description:a.description,date:artifact.publication.publishedAt,image,keywords:a.keywords,slug:a.slug,canonicalSlug:record.draft.canonicalSlug,lang:locale,canonical:`https://maxvideoai.com${locale==='en'?'':`/${locale}`}/blog/${a.slug}`,editorialArtifact:`${a.slug}.article.json`};
  files.push({path:`content/${locale}/blog/${a.slug}.mdx`,content:`---\n${Object.entries(metadata).map(([key,value])=>`${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n`});
  files.push({path:`content/${locale}/blog/${a.slug}.article.json`,content:JSON.stringify(artifact,null,2)+'\n'});
 }
 return {canonicalSlug:record.draft.canonicalSlug,slugs,files};
}
