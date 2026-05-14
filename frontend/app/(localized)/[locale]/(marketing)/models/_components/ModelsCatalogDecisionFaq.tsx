import { ChevronRight } from 'lucide-react';

type ModelsCatalogDecisionFaqProps = {
  title: string;
  items: Array<{ question: string; answer: string }>;
};

export function ModelsCatalogDecisionFaq({ title, items }: ModelsCatalogDecisionFaqProps) {
  return (
    <section id="faq" className="scroll-mt-24 rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
      <div className="mt-4 divide-y divide-hairline border-y border-hairline">
        {items.map((item) => (
          <details key={item.question} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <h3 className="text-sm font-semibold text-text-primary">{item.question}</h3>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition group-open:rotate-90" aria-hidden />
            </summary>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
