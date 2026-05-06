import { FAQSchema } from '@/components/seo/FAQSchema';
import { ResponsiveDetails } from '@/components/ui/ResponsiveDetails.client';
import {
  FULL_BLEED_SECTION,
  SECTION_BG_A,
  SECTION_BG_B,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  type SoraCopy,
} from '../_lib/model-page-specs';

type FaqEntry = {
  question: string;
  answer: string;
};

type ModelSafetyFaqSectionProps = {
  copy: SoraCopy;
  safetyRules: string[];
  safetyInterpretation: string[];
  faqList: FaqEntry[];
  faqTitle: string | null;
  isSoraPrompting: boolean;
  faqJsonLdEntries: FaqEntry[];
};

export function ModelSafetyFaqSection({
  copy,
  safetyRules,
  safetyInterpretation,
  faqList,
  faqTitle,
  isSoraPrompting,
  faqJsonLdEntries,
}: ModelSafetyFaqSectionProps) {
  return (
<>
        {copy.safetyTitle || safetyRules.length || safetyInterpretation.length ? (
          <section
            id="safety"
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
              {copy.safetyTitle ?? 'Safety & people / likeness'}
            </h2>
            <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
              {safetyRules.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {safetyRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              ) : null}
              {safetyInterpretation.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {safetyInterpretation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            {copy.safetyNote ? <p className="text-sm text-text-secondary">{copy.safetyNote}</p> : null}
          </section>
        ) : null}

        {faqList.length ? (
          <section
            id="faq"
            className={`${FULL_BLEED_SECTION} ${isSoraPrompting ? SECTION_BG_A : SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            {faqTitle ? (
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{faqTitle}</h2>
            ) : null}
            <div className="stack-gap-sm">
              {faqList.map((entry) => (
                <ResponsiveDetails
                  openOnDesktop
                  key={entry.question}
                  className="rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
                  summaryClassName="cursor-pointer text-sm font-semibold text-text-primary"
                  summary={entry.question}
                >
                  <p className="mt-2 text-sm text-text-secondary">{entry.answer}</p>
                </ResponsiveDetails>
              ))}
            </div>
          </section>
        ) : null}
        <FAQSchema questions={faqJsonLdEntries} />
</>
  );
}
