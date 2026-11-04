import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, ChevronDown, Play } from 'lucide-react';
import { NEON_RACER_FILM } from '@/config/neon-racer-film';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { Link } from '@/i18n/navigation';
import type { PayAsYouGoHeroData, PayAsYouGoPageData } from '../_lib/payg-page-data';
import { PAYG_CONTAINER_CLASS_NAME, PayAsYouGoCatalog, PayAsYouGoSectionHeader } from './PayAsYouGoSectionPrimitives';

type PayAsYouGoPageDataProps = {
  data: PayAsYouGoPageData;
};

export function PayAsYouGoHeroSection({ data, quoteCard }: { data: PayAsYouGoHeroData; quoteCard: ReactNode }) {
  const film = NEON_RACER_FILM;
  return (
    <header className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-8 sm:py-12 lg:py-16`}>
        <div className="grid items-center gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-micro text-brand">{data.hero.eyebrow}</p>
            <h1 className="mt-3 text-[36px] font-semibold leading-[1.04] tracking-normal text-text-primary sm:text-[54px]">
              {data.hero.title}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-text-secondary sm:text-lg">{data.hero.intro}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1">
              <Link href="/app" prefetch={false} className="inline-flex min-h-12 items-center gap-2 rounded-[8px] bg-text-primary px-5 text-sm font-semibold text-bg hover:bg-text-primary/90">
                {data.hero.primaryCta}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <Link href={data.pricing.fullMatrixHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-text-primary underline decoration-hairline underline-offset-4 hover:decoration-current">
                {data.hero.secondaryCta}
              </Link>
            </div>
          </div>
          <figure className="min-w-0">
            <Link href={`/video/${film.jobId}?from=%2Fpay-as-you-go-ai-video-generator`} prefetch={false}
              className="group relative block aspect-video overflow-hidden rounded-xl bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
              aria-label={`${data.hero.film.watch} · ${data.hero.film.title} · ${film.model} · ${film.durationSeconds} s`}>
              <Image src={film.poster} alt={data.hero.film.posterAlt} fill priority
                sizes="(min-width: 1280px) 655px, (min-width: 1024px) 54vw, 92vw" className="object-cover" />
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/75 px-3.5 py-2 text-xs font-semibold text-white group-hover:bg-black">
                <Play aria-hidden className="h-3 w-3 fill-current" /> {data.hero.film.watch}
              </span>
            </Link>
            <figcaption className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
              <strong className="font-semibold text-text-primary">{data.hero.film.title}</strong>
              <span className="text-text-secondary">{film.model} · {film.durationSeconds} s</span>
            </figcaption>
          </figure>
        </div>
        <div className="mt-7 grid gap-3 border-t border-hairline pt-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-12">
          {quoteCard}
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-text-secondary lg:grid lg:grid-cols-2 lg:gap-y-3 lg:pt-1">
            {data.hero.trustItems.map(item => <li key={item} className="inline-flex items-center gap-1.5">
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand" />{item}
            </li>)}
          </ul>
        </div>
      </div>
    </header>
  );
}

export function PayAsYouGoNaturalQuestionsSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} grid gap-8 py-10 sm:py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start`}>
        <div>
          <PayAsYouGoSectionHeader {...data.naturalQuestions.header} />
          <div className="mt-5 rounded-[8px] border border-hairline bg-bg p-4 shadow-sm">
            <p className="text-sm font-semibold text-text-primary">{data.naturalQuestions.summaryLead}</p>
            <ul className="mt-3 grid gap-2">
              {data.naturalQuestions.summaryItems.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-text-secondary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14A46C]" strokeWidth={1.9} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="divide-y divide-hairline border-y border-hairline">
          {data.naturalQuestions.items.map(item => (
            <details key={item.question} className="group/answer">
              <summary className="cursor-pointer list-none py-3.5 [&::-webkit-details-marker]:hidden">
                <h2 className="flex items-center justify-between gap-4 text-base font-semibold leading-snug text-text-primary">
                  {item.question}<ChevronDown aria-hidden className="h-4 w-4 shrink-0 group-open/answer:rotate-180" />
                </h2>
              </summary>
              <p className="pb-4 text-sm leading-6 text-text-secondary">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoModelTestingOrderSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader {...data.modelTesting.header} />
        <PayAsYouGoCatalog id="models" label={data.modelTesting.disclosure} count={data.modelTesting.items.length}>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.modelTesting.items.map((model) => (
              <li key={model.id}>
                <Link
                  href={model.href}
                  className="group flex h-full gap-4 rounded-[8px] border border-hairline bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <EngineIcon engine={model.engineIcon} imageAlt={`${model.family} ${data.common.aiVideoModelAlt}`} size={28} rounded="full" />
                      <h3 className="text-sm font-semibold text-text-primary">{model.title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{model.body}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </PayAsYouGoCatalog>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary">
          {data.modelTesting.footer}
        </p>
      </div>
    </section>
  );
}
