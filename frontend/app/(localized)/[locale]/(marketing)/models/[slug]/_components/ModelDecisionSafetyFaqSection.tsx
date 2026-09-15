import { ShieldCheck } from 'lucide-react';

import type { AppLocale } from '@/i18n/locales';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { UIIcon } from '@/components/ui/UIIcon';

import { MODEL_PAGE_ICON_MUTED } from '../_lib/model-page-icon-styles';
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
  const decisionSafetyRules = [...new Set(safetyRules.length ? safetyRules : getDecisionSafetyRules(locale))];
  const hasSafety = copy.safetyTitle || safetyRules.length || safetyInterpretation.length;

  return (
    <>
      {hasSafety ? (
        <section id="safety" className={`${SECTION_SCROLL_MARGIN} border-t border-hairline py-7`}>
          <details className="model-disclosure model-safety-notes">
            <summary>
              <h2>{safetyTitle}</h2>
              <span className="model-disclosure-sign" aria-hidden="true" />
            </summary>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{copy.safetyNote ?? safetyCopy.body}</p>
            <ul className="mt-4 grid gap-3 text-sm leading-6 text-text-secondary sm:grid-cols-2">
              {decisionSafetyRules.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <UIIcon icon={ShieldCheck} size={16} className={`mt-1 shrink-0 ${MODEL_PAGE_ICON_MUTED}`} />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            {safetyInterpretation.length ? (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-text-secondary">
                {safetyInterpretation.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
          </details>
        </section>
      ) : null}

      {faqList.length ? (
        <section id="faq" className={`model-faq ${SECTION_SCROLL_MARGIN} pb-8`}>
          {faqTitle ? <h2 className="!text-left text-3xl font-semibold text-text-primary">{faqTitle}</h2> : null}
          <div className="model-faq-list">
            {faqList.map((entry) => (
              <details key={entry.question} className="model-disclosure">
                <summary>
                  <span>{entry.question}</span>
                  <span className="model-disclosure-sign" aria-hidden="true" />
                </summary>
                <p className="model-faq-answer">{entry.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
      <FAQSchema questions={faqJsonLdEntries} />
    </>
  );
}
