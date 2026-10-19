import React from 'react';
import { ArrowDown, ArrowRight, Plus } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { getReleasedCreatorToolIds, isCreatorToolPublic, type CreatorToolId } from '@/lib/toolbox/creator-availability';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';
import { buildToolBreadcrumbJsonLd, serializeJsonLd } from '../landing/tool-marketing-json-ld';
import { CreatorWorkflowDemo } from './CreatorWorkflowDemo.client';
import { CreatorArtwork } from './CreatorArtwork';
import { CreatorToolMark } from './CreatorIllustrations';
import { getCreatorMarketingCopy, getCreatorMarketingLabels } from './creator-copy';
import { getCreatorDetailCopy } from './creator-detail-copy';

/** Pure view; route admission and preview fixtures remain outside presentation. */
export function CreatorLandingView({ id, locale, publicReleased = isCreatorToolPublic(id) }: { id: CreatorToolId; locale: AppLocale; publicReleased?: boolean }) {
  const content = getCreatorMarketingCopy(locale, id), labels = getCreatorMarketingLabels(locale);
  const detail = getCreatorDetailCopy(locale), toolDetail = detail.tools[id];
  const canonicalUrl = `https://maxvideoai.com${localizePathFromEnglish(locale, `/tools/${id}`)}`;
  const related = getReleasedCreatorToolIds().filter(tool => tool !== id);
  const appHref = `/app/tools/${id}`;
  const cta = (location: string) => publicReleased
    ? <a className="creator-primary" href={appHref} data-analytics-event="tool_cta_click" data-analytics-tool-name={id.replace(/-/g, '_')} data-analytics-tool-surface="public" data-analytics-cta-location={location}>{toolDetail.action}<ArrowRight aria-hidden="true" size={20}/></a>
    : <p className="creator-preview-status">{labels.preview}</p>;
  return <div className="creator-tools-page" data-creator-tool={id}>
    <section className="creator-hero">
      <div className="creator-hero-copy">
        <nav className="creator-breadcrumb" aria-label={labels.tools}><a href={localizePathFromEnglish(locale, '/tools')}>{labels.tools}</a><span aria-hidden="true">/</span><span>{content.name}</span></nav>
        <h1>{content.title}</h1>
        <p className="creator-intro">{content.intro}</p>
        <div className="creator-actions">{cta('creator_tool_hero')}<a className="creator-text-link" href="#workflow">{labels.how}<ArrowDown aria-hidden="true" size={17}/></a></div>
      </div>
      <figure className="creator-hero-art"><CreatorArtwork id={id} alt={toolDetail.artAlt} priority sizes="(max-width: 760px) 100vw, (max-width: 1100px) 54vw, 58vw"/><figcaption>{labels.illustration}</figcaption></figure>
    </section>

    <div className="creator-flow-summary">{[[labels.inputs, content.input], [labels.settings, content.adjustment], [labels.result, content.output]].map(([title, body]) => <div key={title}><h2>{title}</h2><p>{body}</p></div>)}</div>

    <section id="workflow" className="creator-workflow">
      <div className="creator-workflow-copy"><h2>{toolDetail.title}</h2><p className="creator-section-intro">{toolDetail.intro}</p>
        <ol>{content.steps.map((step, index) => <li key={step}><span aria-hidden="true">0{index + 1}</span><div><h3>{toolDetail.steps[index]}</h3><p>{step}</p></div></li>)}</ol>
      </div>
      <div className="creator-demo-container"><CreatorWorkflowDemo id={id} labels={labels} locale={locale}/></div>
    </section>

    <section className="creator-continuation"><div><h2>{detail.continuationTitle}</h2><p>{id === 'subtitles' ? detail.captionContinuation : detail.continuationBody}</p></div><ol aria-label={detail.continuationTitle}><li>{detail.media}</li><li><ArrowRight aria-hidden="true"/>{detail.studio}</li><li><ArrowRight aria-hidden="true"/>{detail.export}</li></ol></section>

    <section className="creator-limits"><h2>{labels.limits}</h2><ul>{content.limits.map(limit => <li key={limit}>{limit}</li>)}</ul></section>
    <section className="creator-faq" aria-label={labels.faq}>{content.questions.map(question => <details key={question.question}><summary>{question.question}<Plus aria-hidden="true" size={22}/></summary><p>{question.answer}</p></details>)}</section>
    <section className="creator-quote"><div><h2>{labels.quoteTitle}</h2><p>{labels.quoteBody}</p></div>{cta('creator_tool_final')}</section>
    {related.length ? <section className="creator-related"><h2>{labels.related}</h2><div>{related.map(tool => <a key={tool} href={localizePathFromEnglish(locale, `/tools/${tool}`)}><CreatorToolMark id={tool}/><span>{getCreatorMarketingCopy(locale, tool).name}<ArrowRight aria-hidden="true" size={18}/></span></a>)}</div></section> : null}
    {publicReleased ? <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildToolBreadcrumbJsonLd({ locale, canonicalUrl, breadcrumb: { home: labels.home, tools: labels.tools, current: content.name } })) }}/><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildMarketingServiceJsonLd({ name: content.name, description: content.description, url: canonicalUrl, serviceType: content.name })) }}/></> : null}
  </div>;
}
