import type { AppLocale } from '@/i18n/locales';
import { PrivacyArticleEn } from './PrivacyArticleEn';
import { PrivacyArticleEs } from './PrivacyArticleEs';
import { PrivacyArticleFr } from './PrivacyArticleFr';

export type PrivacyBodyProps = {
  locale: AppLocale;
  version: string;
  effective: string | null;
  links: {
    mentionsHref: string;
    subprocessorsHref: string;
    cookiesHref: string;
  };
};

export function PrivacyArticle({ locale, version, effective, links }: PrivacyBodyProps) {
  switch (locale) {
    case 'fr':
      return <PrivacyArticleFr version={version} effective={effective} links={links} />;
    case 'es':
      return <PrivacyArticleEs version={version} effective={effective} links={links} />;
    default:
      return <PrivacyArticleEn version={version} effective={effective} links={links} />;
  }
}
