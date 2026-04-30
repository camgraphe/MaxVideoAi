import ExamplesPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/examples/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = async (
  props: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }
) => {
  const searchParams = await props.searchParams;
  return generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }), searchParams: Promise.resolve(searchParams ?? {}) });
};

export default async function ExamplesDefaultPage(
  props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }
) {
  return (
    <DefaultMarketingLayout>
      <ExamplesPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} searchParams={(await props.searchParams) ?? {}} />
    </DefaultMarketingLayout>
  );
}
