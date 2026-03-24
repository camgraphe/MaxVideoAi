import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { NotFoundContent } from '@/components/NotFoundContent';
import { resolveDictionary } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary, fallback } = await resolveDictionary();
  return {
    title: dictionary.notFound.metaTitle || fallback.notFound.metaTitle,
  };
}

export default async function NotFound() {
  const { dictionary, fallback } = await resolveDictionary();
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
