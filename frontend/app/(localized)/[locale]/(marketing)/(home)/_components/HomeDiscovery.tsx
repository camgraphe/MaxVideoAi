import { HomeModelDiscovery } from '@/components/marketing/home/HomeModelDiscovery';
import type { HomeExampleCard, ProviderItem } from '@/components/marketing/home/home-redesign-types';
import type { AppLocale } from '@/i18n/locales';
import type { RedesignContent } from '../_lib/home-route-data/types';

export async function HomeDiscovery({ locale, examples, providers, copy }: {
  locale: AppLocale;
  examples: Promise<HomeExampleCard[]>;
  providers: ProviderItem[];
  copy: RedesignContent['examples'];
}) {
  return <HomeModelDiscovery locale={locale} examples={await examples} providers={providers} copy={copy} />;
}
