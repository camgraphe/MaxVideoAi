import styles from './pricing-catalog.module.css';
import { CreditPurchaseNotes } from '@/components/marketing/CreditPurchaseNotes';
import { BadgeDollarSign, ChevronDown, CreditCard, Eye, RotateCcw } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localizeMarketingHref } from '@/lib/i18n/marketing-locale-switch';
import { pricingOpeningCopy } from '../_lib/pricing-opening-copy';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';

const creditCardIcons = [BadgeDollarSign, Eye, RotateCcw, CreditCard] as const;

export function PricingCreditsRefundsSection({ locale }: { locale: AppLocale }) {
  const copy = getPricingHubCopy(locale);
  const editorial = pricingOpeningCopy[locale];
  return (
    <section id="pricing-credits" className={styles.wallet}>
      <div className={styles.walletIntro}>
        <div>
          <h2 className="text-2xl font-semibold tracking-normal text-text-primary">{editorial.walletTitle}</h2>
          <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-secondary">{editorial.walletIntro}</p>
        </div>
      </div>
      <div className={styles.walletList}>
        {copy.creditsRefunds.cards.map((card, index) => {
          const Icon = creditCardIcons[index] ?? BadgeDollarSign;
          return (
            <details key={card.title}><summary>
              <Icon className="h-5 w-5 text-text-primary" strokeWidth={1.9} />
              <span>{index === 1 ? editorial.priceFirst : index === 2 ? editorial.technicalCredit : card.title}</span><ChevronDown size={17} aria-hidden="true" /></summary>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{card.body}</p>
              {card.link ? (
                <Link href={card.link.href} className="mt-3 inline-flex text-sm font-semibold text-text-primary hover:underline">
                  {card.link.label}
                </Link>
              ) : null}
            </details>
          );
        })}
      </div>
      <details className={styles.walletTerms}><summary>{copy.creditsRefunds.creditNotes.title}<ChevronDown size={17} aria-hidden="true" /></summary>
        <CreditPurchaseNotes copy={copy.creditsRefunds.creditNotes} />
      </details>
      <div className={styles.walletLinks}>
        <Link href="/ai-video-prompt-generator" locale={locale} prefetch={false} className="underline underline-offset-4">{locale === 'fr' ? 'Comprendre les niveaux et crédits Milo →' : locale === 'es' ? 'Conocer los niveles y créditos de Milo →' : 'Understand Milo levels and credits →'}</Link>
        <Link
          href={localizeMarketingHref('/blog/ai-video-project-cost', locale)}
          currentLocale={locale}
          prefetch={false}
          className="underline underline-offset-4"
        >
          {copy.creditsRefunds.projectBudgetLink}
        </Link>
      </div>
    </section>
  );
}
