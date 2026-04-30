import ExamplesModelPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../../(localized)/[locale]/(marketing)/examples/[model]/page';
import DefaultMarketingLayout from '../../default-marketing-layout';
import { DEFAULT_LOCALE } from '../../default-locale-wrapper';
import { getMarketingExampleRouteSlugs } from '@/lib/model-families';

export function generateStaticParams() {
  return getMarketingExampleRouteSlugs().map((model) => ({ model }));
}

export const generateMetadata = async (
  props: {
    params: Promise<{ model: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }
) => {
  const searchParams = await props.searchParams;
  const params = await props.params;

  return generateLocalizedMetadata({
    params: Promise.resolve({ locale: DEFAULT_LOCALE, model: params.model }),
    searchParams: Promise.resolve(searchParams ?? {}),
  });
};

export default async function ExamplesModelDefaultPage(
  props: {
    params: Promise<{ model: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return (
    <DefaultMarketingLayout>
      <ExamplesModelPage
        params={Promise.resolve({ locale: DEFAULT_LOCALE, model: params.model })}
        searchParams={Promise.resolve(searchParams ?? {})}
      />
    </DefaultMarketingLayout>
  );
}
