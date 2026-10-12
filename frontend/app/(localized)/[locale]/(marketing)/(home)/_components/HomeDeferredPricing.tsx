import type { AppLocale } from '@/i18n/locales';
import { HomePricingSection } from '@/components/marketing/home/HomePricingSection';
import type { HomePriceModel } from '@/components/marketing/home/home-price-demo-types';
import type { SectionCopy } from '@/components/marketing/home/home-redesign-types';

export async function HomeDeferredPricing({ locale, models, copy }: {
  locale: AppLocale; models: Promise<HomePriceModel[]>; copy: SectionCopy;
}) {
  return <HomePricingSection locale={locale} models={await models} copy={copy} />;
}
