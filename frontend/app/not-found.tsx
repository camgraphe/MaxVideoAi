import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/NotFoundContent';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { resolveDictionary } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary, fallback } = await resolveDictionary();
  return {
    title: dictionary.notFound.metaTitle || fallback.notFound.metaTitle,
  };
}

export default async function NotFound() {
  const { locale, dictionary, fallback } = await resolveDictionary();
  const copy = dictionary.notFound ?? fallback.notFound;

  return (
    <NotFoundContent
      homeHref={localizePathFromEnglish(locale, '/')}
      modelsHref={localizePathFromEnglish(locale, '/models')}
      title={copy.title}
      body={copy.body}
      homeLabel={copy.homeLabel}
      modelsLabel={copy.modelsLabel}
    />
  );
}
