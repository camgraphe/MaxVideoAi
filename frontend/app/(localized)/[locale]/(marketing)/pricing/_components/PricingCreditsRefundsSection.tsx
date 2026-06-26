import { BadgeDollarSign, CreditCard, Eye, RotateCcw } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';

const creditCardIcons = [BadgeDollarSign, Eye, RotateCcw, CreditCard] as const;

export function PricingCreditsRefundsSection({ locale }: { locale: AppLocale }) {
  const copy = getPricingHubCopy(locale);
  return (
    <section className="rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal text-text-primary">{copy.creditsRefunds.title}</h2>
          <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-secondary">{copy.creditsRefunds.intro}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {copy.creditsRefunds.cards.map((card, index) => {
          const Icon = creditCardIcons[index] ?? BadgeDollarSign;
          return (
            <article key={card.title} className="rounded-[8px] border border-hairline bg-bg p-4">
              <Icon className="h-5 w-5 text-[#1F5EFF]" strokeWidth={1.9} />
              <h3 className="mt-3 text-sm font-semibold text-text-primary">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{card.body}</p>
              {card.link ? (
                <Link href={card.link.href} className="mt-3 inline-flex text-sm font-semibold text-[#1F5EFF] hover:underline">
                  {card.link.label}
                </Link>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
