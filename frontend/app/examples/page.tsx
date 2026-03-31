import ExamplesPage, { generateMetadata as generateLocalizedMetadata } from '../(localized)/[locale]/(marketing)/examples/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = ({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) => generateLocalizedMetadata({ params: { locale: DEFAULT_LOCALE }, searchParams: searchParams ?? {} });

export default function ExamplesDefaultPage(props: { searchParams?: Record<string, string | string[] | undefined> }) {
  return (
    <DefaultMarketingLayout>
      <ExamplesPage searchParams={props.searchParams ?? {}} />
    </DefaultMarketingLayout>
  );
}
