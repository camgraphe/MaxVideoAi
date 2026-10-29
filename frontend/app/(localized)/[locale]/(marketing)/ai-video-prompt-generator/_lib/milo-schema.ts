import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import { getLocalizedUrl } from '@/lib/metadataUrls';
import type { MiloCopy } from './milo-copy';
export function buildMiloSchema(locale: AppLocale,copy: MiloCopy) {
  const url=getLocalizedUrl(locale,'/ai-video-prompt-generator');
  return {'@context':'https://schema.org','@graph':[
    {'@type':'WebPage','@id':`${url}#webpage`,url,name:copy.meta.title,description:copy.meta.description,inLanguage:localeRegions[locale]},
    {'@type':'FAQPage','@id':`${url}#faq`,inLanguage:localeRegions[locale],mainEntity:copy.faq.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))},
  ]};
}
