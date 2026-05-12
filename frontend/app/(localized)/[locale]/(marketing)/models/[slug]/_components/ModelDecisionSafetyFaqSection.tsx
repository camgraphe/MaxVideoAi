import { ArrowRight, ShieldCheck } from 'lucide-react';

import type { AppLocale } from '@/i18n/locales';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { ResponsiveDetails } from '@/components/ui/ResponsiveDetails.client';
import { UIIcon } from '@/components/ui/UIIcon';

import { SECTION_SCROLL_MARGIN, type SoraCopy } from '../_lib/model-page-specs';

type FaqEntry = {
  question: string;
  answer: string;
};

type ModelDecisionSafetyFaqSectionProps = {
  copy: SoraCopy;
  safetyRules: string[];
  safetyInterpretation: string[];
  faqList: FaqEntry[];
  faqTitle: string | null;
  locale: AppLocale;
  faqJsonLdEntries: FaqEntry[];
  safetyTitle: string;
};

function getSafetyCopy(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      body: 'Garde-fous integres et bonnes pratiques pour creer responsablement avec Seedance 2.0.',
      cta: 'Voir le guide securite',
    };
  }
  if (locale === 'es') {
    return {
      body: 'Guardrails integrados y mejores practicas para crear de forma responsable con Seedance 2.0.',
      cta: 'Ver guia de seguridad',
    };
  }
  return {
    body: 'Built-in safeguards and best practices for responsible creation with Seedance 2.0.',
    cta: 'View safety guide',
  };
}

export function ModelDecisionSafetyFaqSection({
  copy,
  safetyRules,
  safetyInterpretation,
  faqList,
  faqTitle,
  locale,
  faqJsonLdEntries,
  safetyTitle,
}: ModelDecisionSafetyFaqSectionProps) {
  const safetyCopy = getSafetyCopy(locale);
  const hasSafety = copy.safetyTitle || safetyRules.length || safetyInterpretation.length;

  return (
    <>
      {hasSafety ? (
        <section id="safety" className={`${SECTION_SCROLL_MARGIN} border-t border-hairline py-7`}>
          <div className="flex flex-col gap-5 rounded-[22px] border border-slate-200/80 bg-white/92 p-6 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.30)] dark:border-white/10 dark:bg-slate-950/72 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300">
                <UIIcon icon={ShieldCheck} size={26} />
              </span>
              <div>
                <h2 className="!text-left text-2xl font-semibold text-text-primary">{safetyTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{copy.safetyNote ?? safetyCopy.body}</p>
              </div>
            </div>
            <a
              href="#faq"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-5 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <span>{safetyCopy.cta}</span>
              <UIIcon icon={ArrowRight} size={15} />
            </a>
          </div>
        </section>
      ) : null}

      {faqList.length ? (
        <section id="faq" className={`${SECTION_SCROLL_MARGIN} space-y-5 pb-8`}>
          {faqTitle ? <h2 className="!text-left text-3xl font-semibold text-text-primary">{faqTitle}</h2> : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {faqList.map((entry) => (
              <ResponsiveDetails
                openOnDesktop
                key={entry.question}
                className="rounded-xl border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.30)] dark:border-white/10 dark:bg-slate-950/72"
                summaryClassName="cursor-pointer text-sm font-semibold text-text-primary"
                summary={entry.question}
              >
                <p className="mt-3 text-sm leading-6 text-text-secondary">{entry.answer}</p>
              </ResponsiveDetails>
            ))}
          </div>
        </section>
      ) : null}
      <FAQSchema questions={faqJsonLdEntries} />
    </>
  );
}
