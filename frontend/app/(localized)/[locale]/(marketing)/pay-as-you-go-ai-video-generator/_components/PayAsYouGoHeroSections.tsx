import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, ChevronDown, Play } from 'lucide-react';
import { PayAsYouGoQuoteReceipt } from './PayAsYouGoQuoteReceipt.client';
import { findProgrammePrint, PAYG_FILM_PROGRAMME } from '../_lib/payg-film-programme';
import type { PayAsYouGoShowcaseVideo } from '../_lib/payg-video-showcase';
import { CALIFORNIA_CURSOR_FILM } from '@/config/california-cursor-film';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { Link } from '@/i18n/navigation';
import type { PayAsYouGoHeroData, PayAsYouGoPageData } from '../_lib/payg-page-data';
import { PAYG_CONTAINER_CLASS_NAME, PayAsYouGoCatalog, PayAsYouGoSectionHeader } from './PayAsYouGoSectionPrimitives';

type PayAsYouGoPageDataProps = {
  data: PayAsYouGoPageData;
};

export function PayAsYouGoHeroSection({ data, quoteCard }: { data: PayAsYouGoHeroData; quoteCard: ReactNode }) {
  const film = CALIFORNIA_CURSOR_FILM;
  return (
    <header className="border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-8 sm:py-12 lg:py-16`}>
        <div className="grid items-center gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-micro text-brand">{data.hero.eyebrow}</p>
            <h1 className="mt-3 max-w-[18ch] font-serif text-[2.65rem] font-normal leading-[.99] tracking-tight text-text-primary sm:text-[3.75rem]">
              {data.hero.title}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-text-secondary sm:text-lg">{data.hero.intro}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1">
              <Link href="/app" prefetch={false} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-text-primary px-5 text-sm font-semibold text-bg hover:bg-brand focus-visible:outline-offset-4">
                {data.hero.primaryCta}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <Link href={data.pricing.fullMatrixHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-text-primary underline decoration-hairline underline-offset-4 hover:decoration-current">
                {data.hero.secondaryCta}
              </Link>
            </div>
          </div>
          <div className="min-w-0" data-nosnippet="">
            <figure>
              <Link href={`${film.watchHref}?from=%2Fpay-as-you-go-ai-video-generator`} prefetch={false}
                className="group relative block aspect-video overflow-hidden rounded-[10px] bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
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
  const options = data.pricing.rows.map(({ id, engineName, priceCells }) => ({ id, engineName, priceCells }));
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12 sm:py-16`}>
        <div className="grid items-center gap-8 lg:grid-cols-[1.25fr_.75fr] lg:gap-16">
          <div>
            <PayAsYouGoSectionHeader {...data.naturalQuestions.header} />
            <div className="mt-5 divide-y divide-hairline border-y border-hairline">
              {data.naturalQuestions.items.map(item => (
                <details key={item.question} className="group/answer">
                  <summary className="cursor-pointer list-none py-3.5 [&::-webkit-details-marker]:hidden">
                    <h2 className="flex items-center justify-between gap-4 text-base font-semibold leading-snug text-text-primary">
                      {item.question}<ChevronDown aria-hidden className="h-4 w-4 shrink-0 group-open/answer:rotate-180" />
                    </h2>
                  </summary>
                  <p className="max-w-prose pb-4 text-sm leading-6 text-text-secondary">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
          <PayAsYouGoQuoteReceipt options={options} label={data.hero.quote.consoleLabel}
            modelLabel={data.hero.quote.modelLabel} settingsLabel={data.naturalQuestions.settingsLabel}
            amountLabel={data.hero.quote.exampleCostLabel} wallet={data.hero.trustItems[1]} prices={data.hero.secondaryCta} />
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoModelTestingOrderSection({ data, videos }: PayAsYouGoPageDataProps & { videos: PayAsYouGoShowcaseVideo[] }) {
  const byId = new Map(videos.map(video => [video.id, video]));
  const sheets = PAYG_FILM_PROGRAMME.flatMap((film, index) => {
    const model = data.modelTesting.items.find(item => item.id === film.model);
    const selected = findProgrammePrint(film, byId);
    return model && selected?.contactSheet ? [{ model, video: selected.video, src: selected.contactSheet, intent: data.modelTesting.intents[index] }] : [];
  });
  return (
    <section id="payg-models" className="scroll-mt-16 border-b border-hairline bg-bg">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12 sm:py-16`}>
        <div className={sheets.length ? 'grid items-center gap-7 lg:grid-cols-[.7fr_1.3fr] lg:gap-12' : ''}>
          <div>
            <PayAsYouGoSectionHeader {...data.modelTesting.header} />
            {sheets.length ? <p className="mt-4 max-w-sm text-sm leading-6 text-text-secondary">{data.modelTesting.contactIntro}</p> : null}
          </div>
          {sheets.length ? <ul className="grid gap-4 sm:grid-cols-3">
            {sheets.map(({ model, video, src, intent }) => (
              <li key={model.id}>
                <Link href={model.href} className="group grid grid-cols-[100px_1fr] items-center gap-3 sm:block">
                  <div className="overflow-hidden border border-hairline bg-surface p-1 shadow-sm">
                    <Image src={src} alt={video.useCase} width={520} height={454} sizes="(min-width: 1024px) 210px, (min-width: 640px) 30vw, 100px"
                      className="h-auto w-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.025]" />
                  </div>
                  <div className="sm:mt-3">
                    <span className="font-mono text-xs text-text-secondary">{video.engineLabel}</span>
                    <p className="mt-1 text-base font-semibold leading-tight text-text-primary group-hover:underline">{intent} <span aria-hidden>↗</span></p>
                  </div>
                </Link>
              </li>
            ))}
          </ul> : null}
        </div>
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
