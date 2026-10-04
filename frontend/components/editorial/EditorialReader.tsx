/* Authenticated media must bypass the public Next image optimizer. */
/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { EditorialVisual } from './EditorialVisual';
import type { EditorialBlock, EditorialDraft } from '@/lib/editorial/schema';

type Locale = 'en' | 'fr' | 'es';
type MediaUrl = (assetId: string) => string;
export type EditorialReaderContent={article:EditorialDraft['locales']['en'];assets:Array<Pick<EditorialDraft['assets'][number],'id'|'kind'|'width'|'height'>>;sources:Array<Pick<EditorialDraft['sources'][number],'id'|'title'|'publisher'|'url'|'retrievedAt'>>};
export type EditorialImageProps={src:string;alt:string;width:number;height:number;priority:boolean;style?:React.CSSProperties};
type RenderImage=(props:EditorialImageProps)=>React.ReactNode;
const labels = {
  en: { illustration: 'Illustration', capture: 'Capture', sources: 'Sources', draft: 'Private draft', prompt: 'Example prompt' },
  fr: { illustration: 'Illustration', capture: 'Capture', sources: 'Sources', draft: 'Brouillon privé', prompt: 'Exemple de prompt · anglais' },
  es: { illustration: 'Ilustración', capture: 'Captura', sources: 'Fuentes', draft: 'Borrador privado · LATAM', prompt: 'Ejemplo de prompt · inglés' },
};
function renderBlock(block: EditorialBlock, draft: EditorialReaderContent, locale: Locale, mediaUrl: MediaUrl, renderImage:RenderImage, heroId:string|undefined) {
  if (block.type === 'diagram' || block.type === 'video') return <EditorialVisual key={block.id} block={block} sources={draft.sources} locale={locale} />;
  if (block.type === 'text') return <section key={block.id} id={block.id}>
    <h2>{block.heading}</h2>{block.paragraphs.map((p, i) => <p key={i}>
      {p.spans ? p.spans.map((s, j) => {
        const content = s.bold ? <strong>{s.text}</strong> : s.text;
        return s.href ? <a key={j} href={s.href.startsWith('/') ? `https://maxvideoai.com${s.href}` : s.href} rel="noopener noreferrer">{content}</a> : <React.Fragment key={j}>{content}</React.Fragment>;
      }) : p.text}
      {p.sourceIds.map(id => <sup key={id}> <a href={`#source-${id}`} aria-label={draft.sources.find(s => s.id === id)?.title}>[{draft.sources.findIndex(s => s.id === id) + 1}]</a></sup>)}
    </p>)}
  </section>;
  if (block.type === 'media') {
    const asset = draft.assets.find(a => a.id === block.assetId);
    if (!asset) return null;
    const url = mediaUrl(asset.id);
    return <section key={block.id} id={block.id}>
      {block.heading && <h2>{block.heading}</h2>}
      <figure className="ed-media">
        {block.presentation === 'storyboard' && block.panels ? <div className="ed-storyboard">{block.panels.map((panel, i) => <figure key={i}>
          <div className="ed-panel-image">{/* eslint-disable-next-line @next/next/no-img-element */}{renderImage({src:url,alt:panel.alt,width:asset.width,height:asset.height,priority:false,style:{objectPosition:`${i * 50}% center`}})}</div>
          <figcaption><strong>{panel.title}</strong><p>{panel.caption}</p></figcaption>
        </figure>)}</div> : renderImage({src:url,alt:block.alt??"",width:asset.width,height:asset.height,priority:block.id===heroId})}
        <figcaption>{asset.kind === 'generated-illustration' && !/illustration|ilustraci[oó]n/i.test(block.caption) && <span>{labels[locale].illustration} · </span>}{block.caption}</figcaption>
      </figure>
    </section>;
  }
  if (block.type === 'comparison') return <section key={block.id} id={block.id}>
    <h2>{block.heading}</h2><div className={`ed-comparison${block.columns.length > 2 ? " is-wide" : ""}`}><table><thead><tr>{block.columns.map((column,i) => <th scope="col" key={i}>{column}</th>)}</tr></thead><tbody>{block.rows.map((row,i) => <tr key={i}>{row.map((cell,j) => j === 0 ? <th scope="row" key={j}>{cell}</th> : <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
  </section>;
  if (block.type === 'steps') return <section key={block.id} id={block.id}>
    <h2>{block.heading}</h2><ol className="ed-steps">{block.steps.map((step,i) => <li key={i}><span className="ed-number">{String(i+1).padStart(2,'0')}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>{block.note && <p>{block.note}</p>}
  </section>;
  if (block.type === 'prompt') return <section key={block.id} id={block.id}>
    <h2>{block.heading}</h2><div className="ed-prompt"><details><summary>{labels[locale].prompt}</summary><pre>{block.template}</pre></details></div><p className="ed-prompt-note">{block.note}{(block.sourceIds ?? []).map(id => <sup key={id}> <a href={`#source-${id}`} aria-label={draft.sources.find(s => s.id === id)?.title}>[{draft.sources.findIndex(s => s.id === id) + 1}]</a></sup>)}</p>
  </section>;
  return <section key={block.id} id={block.id}><h2>{block.heading}</h2>{block.paragraphs.map((p,i) => <p key={i}>{p}</p>)}{block.cta && <a href={block.cta.href}>{block.cta.label} →</a>}</section>;
}

/** Shared by the public blog, authenticated admin and the local phone reader. */
export function EditorialReader({content,locale,mediaUrl,eyebrow,byline,renderImage}: {content:EditorialReaderContent;locale:Locale;mediaUrl:MediaUrl;eyebrow:string;byline?:React.ReactNode;renderImage?:RenderImage}) {
  const variant=content.article;
  const image=renderImage??(p=><img src={p.src} alt={p.alt} width={p.width} height={p.height} loading={p.priority?'eager':'lazy'} {...(p.priority?{fetchpriority:'high'}:{})} style={p.style}/>);
  const heroId=variant.blocks.find(b=>b.type==='media')?.id;
  return <article lang={locale === 'es' ? 'es-419' : locale === 'fr' ? 'fr-FR' : 'en'} className="ed-article">
    <header><span className="ed-eyebrow">{eyebrow}</span><h1>{variant.title}</h1><p className="ed-deck">{variant.description}</p>{byline}</header>
    {variant.blocks.map(block=>renderBlock(block,content,locale,mediaUrl,image,heroId))}
    <details className="ed-sources"><summary>{labels[locale].sources} · {content.sources.length}</summary><ol>{content.sources.map((source,i)=><li key={source.id} id={`source-${source.id}`}><a href={source.url} rel="noopener noreferrer">[{i+1}] {source.title}</a><p>{source.publisher} · {source.retrievedAt}</p></li>)}</ol></details>
  </article>;
}
