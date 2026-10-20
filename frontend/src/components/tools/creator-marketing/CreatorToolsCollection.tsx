import React from 'react';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { getReleasedCreatorToolIds } from '@/lib/toolbox/creator-availability';
import { getCreatorMarketingCopy, getCreatorMarketingLabels } from './creator-copy';
import { CreatorToolMark } from './CreatorIllustrations';
export function CreatorToolsCollection({ locale }: { locale: AppLocale }) {
  const ids = getReleasedCreatorToolIds();
  if (!ids.length) return null;
  const labels = getCreatorMarketingLabels(locale);
  return <section className="tools-hub-collection"><div className="container-page"><header><p className="tool-kicker">{labels.eyebrow}</p><h2>{labels.operation}</h2></header><div className="tools-hub-workshops">{ids.map(id => { const copy = getCreatorMarketingCopy(locale,id); return <article key={id}><a className="tools-hub-card" href={localizePathFromEnglish(locale,`/tools/${id}`)} data-analytics-event="tool_card_click" data-analytics-tool-name={id.replace(/-/g,'_')} data-analytics-tool-surface="public" data-analytics-cta-location="creator_tools_hub"><div><CreatorToolMark id={id}/></div><small>{labels.illustration}</small><h3>{copy.name} ↗</h3><p>{copy.input}</p></a></article>; })}</div></div></section>;
}
