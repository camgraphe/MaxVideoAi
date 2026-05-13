import { ShieldCheck } from 'lucide-react';

import type { AppLocale } from '@/i18n/locales';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { ResponsiveDetails } from '@/components/ui/ResponsiveDetails.client';
import { UIIcon } from '@/components/ui/UIIcon';

import { MODEL_PAGE_ICON, MODEL_PAGE_ICON_MUTED, MODEL_PAGE_ICON_WRAP } from '../_lib/model-page-icon-styles';
import { SECTION_SCROLL_MARGIN, type SoraCopy } from '../_lib/model-page-specs';

type FaqEntry = {
  question: string;
  answer: string;
};

type ModelDecisionSafetyFaqSectionProps = {
  copy: SoraCopy;
  modelName: string;
  safetyRules: string[];
  safetyInterpretation: string[];
  faqList: FaqEntry[];
  faqTitle: string | null;
  locale: AppLocale;
  faqJsonLdEntries: FaqEntry[];
  safetyTitle: string;
};

function getSafetyCopy(locale: AppLocale, modelName: string) {
  if (locale === 'fr') {
    return {
      body: `Garde-fous intégrés et bonnes pratiques pour créer responsablement avec ${modelName}.`,
    };
  }
  if (locale === 'es') {
    return {
      body: `Controles integrados y buenas prácticas para crear de forma responsable con ${modelName}.`,
    };
  }
  return {
    body: `Built-in safeguards and best practices for responsible creation with ${modelName}.`,
  };
}

function getDecisionSafetyRules(locale: AppLocale) {
  if (locale === 'fr') {
    return [
      'Utilisez des personnages originaux et des références que vous possédez.',
      'Évitez les personnes réelles, célébrités et personnages protégés.',
      "N'utilisez pas la ressemblance d'une personne sans consentement.",
      'Évitez les franchises, logos et propriétés intellectuelles protégées.',
    ];
  }
  if (locale === 'es') {
    return [
      'Usa personajes originales y referencias que posees.',
      'Evita personas reales, celebridades y personajes protegidos.',
      'No uses la imagen o parecido de una persona sin consentimiento.',
      'Evita franquicias, logos y propiedad intelectual protegida.',
    ];
  }
  return [
    'Use original characters and owned references.',
    'Avoid real people, celebrities and protected characters.',
    "Do not use someone's likeness without consent.",
    'Avoid copyrighted franchises, logos and protected IP.',
  ];
}

export function ModelDecisionSafetyFaqSection({
  copy,
  modelName,
  safetyRules,
  safetyInterpretation,
  faqList,
  faqTitle,
  locale,
  faqJsonLdEntries,
  safetyTitle,
}: ModelDecisionSafetyFaqSectionProps) {
  const safetyCopy = getSafetyCopy(locale, modelName);
  const decisionSafetyRules = getDecisionSafetyRules(locale);
  const hasSafety = copy.safetyTitle || safetyRules.length || safetyInterpretation.length;

  return (
    <>
      {hasSafety ? (
        <section id="safety" className={`${SECTION_SCROLL_MARGIN} border-t border-hairline py-7`}>
          <div className="rounded-[22px] border border-slate-200/80 bg-white/92 p-6 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.30)] dark:border-white/10 dark:bg-slate-950/72">
            <div className="flex gap-4">
              <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${MODEL_PAGE_ICON_WRAP}`}>
                <UIIcon icon={ShieldCheck} size={26} className={MODEL_PAGE_ICON} />
              </span>
              <div>
                <h2 className="!text-left text-2xl font-semibold text-text-primary">{safetyTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{copy.safetyNote ?? safetyCopy.body}</p>
                <ul className="mt-3 grid gap-2 text-sm leading-5 text-text-secondary sm:grid-cols-2">
                  {decisionSafetyRules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <UIIcon icon={ShieldCheck} size={14} className={`mt-0.5 shrink-0 ${MODEL_PAGE_ICON_MUTED}`} />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
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
