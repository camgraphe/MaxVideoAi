import React from 'react';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { getReleasedCreatorToolIds, isCreatorToolPublic, type CreatorToolId } from '@/lib/toolbox/creator-availability';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';
import { buildToolBreadcrumbJsonLd, serializeJsonLd } from '../landing/tool-marketing-json-ld';
import { CreatorWorkflowDemo } from './CreatorWorkflowDemo.client';
import { CreatorToolMark } from './CreatorIllustrations';
import { getCreatorMarketingCopy, getCreatorMarketingLabels } from './creator-copy';

/** Pure view; route admission and preview fixtures remain outside presentation. */
export function CreatorLandingView({ id, locale, publicReleased = isCreatorToolPublic(id) }: { id: CreatorToolId; locale: AppLocale; publicReleased?: boolean }) {
  const content = getCreatorMarketingCopy(locale, id), labels = getCreatorMarketingLabels(locale);
  const canonicalUrl = `https://maxvideoai.com${localizePathFromEnglish(locale, `/tools/${id}`)}`;
  const related = getReleasedCreatorToolIds().filter(tool => tool !== id);
  const appHref = `/app/tools/${id}`;
  const cta = (location: string) => publicReleased ? <a className="creator-primary" href={appHref} data-analytics-event="tool_cta_click" data-analytics-tool-name={id.replace(/-/g,'_')} data-analytics-tool-surface="public" data-analytics-cta-location={location}>{labels.open}<span aria-hidden="true">↗</span></a> : <p className="creator-preview-status">{labels.preview}</p>;
  return <div className="creator-tools-page" data-creator-tool={id}>
    <nav className="creator-breadcrumb" aria-label={labels.tools}><a href={localizePathFromEnglish(locale,'/tools')}>← {labels.tools}</a><span aria-hidden="true">/</span><span>{content.name}</span></nav>
    <section className="creator-hero"><div className="creator-hero-copy"><p className="creator-eyebrow">{labels.eyebrow}</p><h1>{content.title}</h1><p className="creator-intro">{content.intro}</p><div className="creator-actions">{cta('creator_tool_hero')}<a className="creator-text-link" href="#workflow">{labels.how}<span aria-hidden="true">↓</span></a></div></div><div className="creator-demo-container"><CreatorWorkflowDemo id={id} labels={labels}/></div></section>
    <div className="creator-flow-summary">{[[labels.inputs,content.input],[labels.settings,content.adjustment],[labels.result,content.output]].map(([title,body]) => <div key={title}><h2>{title}</h2><p>{body}</p></div>)}</div>
    <section id="workflow" className="creator-section creator-workflow"><header><p className="creator-eyebrow">{content.name}</p><h2>{labels.workflow}</h2></header><ol>{content.steps.map((step,index) => <li key={step}><span aria-hidden="true">0{index+1}</span><p>{step}</p></li>)}</ol></section>
    <section className="creator-section creator-limits"><h2>{labels.limits}</h2><ul>{content.limits.map(limit => <li key={limit}>{limit}</li>)}</ul></section>
    <section className="creator-section creator-faq"><h2>{labels.faq}</h2><div>{content.questions.map(question => <details key={question.question}><summary>{question.question}<span aria-hidden="true">+</span></summary><p>{question.answer}</p></details>)}</div></section>
    <section className="creator-quote"><div><p className="creator-eyebrow">{labels.next}</p><h2>{labels.quoteTitle}</h2><p>{labels.quoteBody}</p></div>{cta('creator_tool_final')}</section>
    {related.length ? <section className="creator-section creator-related"><h2>{labels.related}</h2><div>{related.map(tool => <a key={tool} href={localizePathFromEnglish(locale,`/tools/${tool}`)}><CreatorToolMark id={tool}/><span>{getCreatorMarketingCopy(locale,tool).name} ↗</span></a>)}</div></section> : null}
    {publicReleased ? <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd(buildToolBreadcrumbJsonLd({locale,canonicalUrl,breadcrumb:{home:labels.home,tools:labels.tools,current:content.name}}))}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd(buildMarketingServiceJsonLd({name:content.name,description:content.description,url:canonicalUrl,serviceType:content.name}))}}/></> : null}
  </div>;
}
