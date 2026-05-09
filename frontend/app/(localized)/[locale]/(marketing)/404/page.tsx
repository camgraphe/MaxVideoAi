import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/NotFoundContent';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { resolveDictionary } from '@/lib/i18n/server';

type Localized404PageProps = {
  params: Promise<{
    locale: AppLocale;
  }>;
};

export async function generateMetadata(props: Localized404PageProps): Promise<Metadata> {
  const params = await props.params;
  const { dictionary, fallback } = await resolveDictionary({ locale: params.locale });
  return {
    title: dictionary.notFound.metaTitle || fallback.notFound.metaTitle,
  };
}

export default async function Localized404Page(props: Localized404PageProps) {
  const params = await props.params;
  const { dictionary, fallback } = await resolveDictionary({ locale: params.locale });
  const copy = dictionary.notFound ?? fallback.notFound;

  return (
    <NotFoundContent
      homeHref={localizePathFromEnglish(params.locale, '/')}
      modelsHref={localizePathFromEnglish(params.locale, '/models')}
      title={copy.title}
      body={copy.body}
      homeLabel={copy.homeLabel}
      modelsLabel={copy.modelsLabel}
    />
  );
}
