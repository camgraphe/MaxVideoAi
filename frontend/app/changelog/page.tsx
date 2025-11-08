import ChangelogPage from '../(localized)/[locale]/(marketing)/changelog/page';
import LocaleLayout from '../(localized)/[locale]/layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';
export { metadata } from '../(localized)/[locale]/(marketing)/changelog/page';

export default function ChangelogDefaultPage() {
  return (
    <LocaleLayout params={{ locale: DEFAULT_LOCALE }}>
      <ChangelogPage />
    </LocaleLayout>
  );
}
