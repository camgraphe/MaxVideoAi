import { BadgeDollarSign, Eye, RotateCcw } from 'lucide-react';

const creditCards = [
  {
    title: 'Pay-as-you-go credits',
    body: 'Use credits without a required subscription. Starter credits begin at $10, and you can top up when you need more generations.',
    icon: BadgeDollarSign,
  },
  {
    title: 'Exact price before launch',
    body: 'The app shows the live price for your selected engine, duration, resolution and options before generation, even as a guest.',
    icon: Eye,
  },
  {
    title: 'Failed generations refunded',
    body: 'Credits are charged only when a job completes successfully. Failed generations are refunded automatically.',
    icon: RotateCcw,
  },
] as const;

export function PricingCreditsRefundsSection() {
  return (
    <section className="rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal text-text-primary">Credits, live quotes and refunds</h2>
          <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-secondary">
            Pricing tables are preset references. The app remains the source for job-level live quotes before launch.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {creditCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="rounded-[8px] border border-hairline bg-bg p-4">
              <Icon className="h-5 w-5 text-[#1F5EFF]" strokeWidth={1.9} />
              <h3 className="mt-3 text-sm font-semibold text-text-primary">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{card.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
