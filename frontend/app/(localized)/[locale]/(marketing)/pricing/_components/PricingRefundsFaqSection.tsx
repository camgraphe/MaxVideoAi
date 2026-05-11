type PricingFaqContent = {
  title?: string;
};

type PricingFaqEntry = {
  answer: string;
  question: string;
};

type PricingRefundsFaqSectionProps = {
  faq: PricingFaqContent;
  faqEntries: PricingFaqEntry[];
};

export function PricingRefundsFaqSection({ faq, faqEntries }: PricingRefundsFaqSectionProps) {
  return (
    <section id="pricing-faq" className="rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-2xl font-semibold tracking-normal text-text-primary">{faq.title ?? 'Pricing FAQ'}</h2>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        {faqEntries.map((entry) => (
          <div key={entry.question} className="rounded-[8px] border border-hairline bg-bg p-4">
            <dt className="text-sm font-semibold leading-6 text-text-primary">{entry.question}</dt>
            <dd className="mt-2 text-sm leading-6 text-text-secondary">{entry.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
