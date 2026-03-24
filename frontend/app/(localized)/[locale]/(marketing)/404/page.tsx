import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { NotFoundContent } from '@/components/NotFoundContent';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';

type Localized404PageProps = {
  params: {
    locale: AppLocale;
  };
};

export async function generateMetadata({ params }: Localized404PageProps): Promise<Metadata> {
  const { dictionary, fallback } = await resolveDictionary({ locale: params.locale });
  return {
    title: dictionary.notFound.metaTitle || fallback.notFound.metaTitle,
  };
}

export default async function Localized404Page({ params }: Localized404PageProps) {
  const { dictionary, fallback } = await resolveDictionary({ locale: params.locale });
  const copy = dictionary.notFound ?? fallback.notFound;

  return (
    <NotFoundContent
      linkComponent={Link}
      homeHref={{ pathname: '/' }}
      modelsHref={{ pathname: '/models' }}
      title={copy.title}
      body={copy.body}
      homeLabel={copy.homeLabel}
      modelsLabel={copy.modelsLabel}
    />
  );
}
