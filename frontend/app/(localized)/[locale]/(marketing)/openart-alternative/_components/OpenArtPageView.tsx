import type { AppLocale } from '@/i18n/locales';
import { PlatformComparisonLinks } from '@/components/marketing/PlatformComparisonLinks';
import type { OpenArtCopy } from '../_content/types';
import { OpenArtBudget, OpenArtClosing, OpenArtQuestions, OpenArtSources, OpenArtWorkflow } from './OpenArtDetails';
import { OpenArtDecision, OpenArtHero } from './OpenArtLead';
import { OpenArtOfferTable } from './OpenArtOfferTable';
import styles from './openart.module.css';

export function OpenArtPageView({ copy, locale }: { copy: OpenArtCopy; locale: AppLocale }) {
  return (
    <article className={styles.page}>
      <OpenArtHero copy={copy.hero} />
      <div className={styles.container}>
        <OpenArtDecision copy={copy.decision} />
        <OpenArtOfferTable copy={copy.matrix} rows={copy.rows} labels={copy.sourceLabels} date={copy.evidence.date} />
      </div>
      <OpenArtWorkflow copy={copy.workflow} locale={locale} />
      <div className={styles.container}>
        <OpenArtBudget copy={copy.budget} locale={locale} />
        <PlatformComparisonLinks locale={locale} current="/openart-alternative" />
        <OpenArtClosing copy={copy.closing} locale={locale} />
        <OpenArtQuestions copy={copy.faq} />
        <OpenArtSources copy={copy.evidence} labels={copy.sourceLabels} />
      </div>
    </article>
  );
}
