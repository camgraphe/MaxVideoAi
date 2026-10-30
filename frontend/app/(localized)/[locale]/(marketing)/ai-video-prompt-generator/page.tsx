import type { Metadata } from 'next';
import { normalizeAppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { serializeJsonLd } from '@/lib/seo/jsonld';
import { MiloMarketingPage } from './_components/MiloMarketingPage';
import { getMiloCopy } from './_lib/milo-copy';
import { buildMiloSchema } from './_lib/milo-schema';
export const revalidate=3600;
type Props={params:Promise<{locale:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const locale=normalizeAppLocale((await params).locale);
  return buildSeoMetadata({locale,...getMiloCopy(locale).meta,englishPath:'/ai-video-prompt-generator'});
}
export default async function MiloPage({params}:Props){
  const locale=normalizeAppLocale((await params).locale);const copy=getMiloCopy(locale);
  return <><MiloMarketingPage locale={locale} copy={copy}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd(buildMiloSchema(locale,copy))}}/></>;
}
