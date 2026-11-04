import Image, { getImageProps } from 'next/image';
import { ArrowUpRight, CheckCircle2, ChevronDown, Clapperboard, Sparkles } from 'lucide-react';
import type { PayAsYouGoShowcaseVideo } from '../_lib/payg-video-showcase';
import { Link } from '@/i18n/navigation';
import type { PayAsYouGoPageData } from '../_lib/payg-page-data';
import {
  PAYG_CONTAINER_CLASS_NAME,
  PayAsYouGoSectionHeader,
  PayAsYouGoSemanticIcon,
} from './PayAsYouGoSectionPrimitives';

type PayAsYouGoPageDataProps = {
  data: PayAsYouGoPageData;
};

export function PayAsYouGoMeaningSection({ data, example }: PayAsYouGoPageDataProps & { example?: PayAsYouGoShowcaseVideo }) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} grid items-center gap-7 py-10 sm:py-14 lg:grid-cols-[1fr_1fr] lg:gap-16`}>
        {example?.posterUrl ? <figure className="min-w-0">
          <Link href={example.href} prefetch={false} className="group block rounded-md focus-visible:outline-offset-4" aria-label={`${example.title} · ${example.engineLabel} · ${example.durationLabel}`}>
            <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-surface-2">
              <Image src={example.posterUrl} alt={example.title} fill sizes="(min-width: 1024px) 530px, 92vw" className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.02]" />
            </div>
          </Link>
          <figcaption className="mt-2 flex flex-wrap justify-between gap-x-3 text-xs leading-5 text-text-secondary">
              <span className="font-semibold text-text-primary">{example.title} ↗</span>{example.engineLabel} · {example.durationLabel}
          </figcaption>
        </figure> : null}
        <div className={example?.posterUrl ? '' : 'lg:col-span-2'}>
          <PayAsYouGoSectionHeader title={data.meaning.title} intro={data.meaning.body} />
          <ul className="mt-4 grid gap-1">
            {data.meaning.bullets.map(bullet => <li key={bullet} className="flex gap-2 text-sm leading-6 text-text-secondary">
              <CheckCircle2 aria-hidden className="mt-1.5 h-3.5 w-3.5 shrink-0 text-brand" />{bullet}
            </li>)}
          </ul>
          <details className="group/meaning mt-5 border-y border-hairline">
            <summary className="cursor-pointer list-none py-3.5 [&::-webkit-details-marker]:hidden">
              <h2 className="flex items-center justify-between gap-4 text-base font-semibold text-text-primary">{data.noSubscription.title}<ChevronDown aria-hidden className="h-4 w-4 group-open/meaning:rotate-180" /></h2>
            </summary>
            <p className="pb-3 text-sm leading-6 text-text-secondary">{data.noSubscription.body}</p>
            <dl className="grid gap-3 pb-4">{data.noSubscription.cards.map(card => <div key={card.title}>
              <dt className="text-sm font-semibold text-text-primary">{card.title}</dt><dd className="text-sm leading-6 text-text-secondary">{card.body}</dd>
            </div>)}</dl>
          </details>
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoAudienceFitSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.audienceFit.cards.map((card) => (
            <article key={card.title} className="rounded-[8px] border border-hairline bg-bg p-5 shadow-sm sm:p-6">
              <h2 className="text-2xl font-semibold tracking-normal text-text-primary">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">{card.body}</p>
              <ul className="mt-5 grid gap-2">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2 text-sm leading-6 text-text-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14A46C]" strokeWidth={1.9} />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoSubscriptionComparisonSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader {...data.subscriptionComparison.header} />
        <div className="mt-6 overflow-x-auto rounded-[8px] border border-hairline bg-bg shadow-card">
          <table className="min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                {data.subscriptionComparison.columns.map((column) => (
                  <th key={column} className="px-4 py-3">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.subscriptionComparison.rows.map((row) => (
                <tr key={row.label} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-4 font-semibold text-text-primary">{row.label}</td>
                  <td className="px-4 py-4 text-text-secondary">{row.payg}</td>
                  <td className="px-4 py-4 text-text-secondary">{row.subscription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoWorkflowSection({ data }: PayAsYouGoPageDataProps) {
  const { workspace, assistance } = data.workflow;
  const base = `/assets/marketing/payg/${workspace.capture}`;
  const desktop = getImageProps({ src: `${base}-wide.webp`, alt: workspace.alt, width: 1410, height: 1418, sizes: '(min-width: 640px) 570px, 92vw' }).props;
  const mobile = getImageProps({ src: `${base}-phone.webp`, alt: workspace.alt, width: 700, height: workspace.phoneHeight, sizes: '90vw' }).props;
  const workspaceHref = '/app?engine=wan-3-prime&from=d642825b-7a63-448a-b0dd-e32bf38782d0';
  return (
    <section id="payg-workspace" data-payg-workflow="" className="scroll-mt-20 bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-10 sm:py-16`}>
        <div className="grid items-center gap-7 lg:grid-cols-[.82fr_1.18fr] lg:gap-14">
          <div>
            <PayAsYouGoSectionHeader {...data.workflow.header} />
            <Link href={workspaceHref} prefetch={false} className="mt-5 inline-flex min-h-11 items-center gap-1.5 border-b border-brand text-sm font-semibold text-brand hover:text-text-primary">
              {workspace.open}<ArrowUpRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
          <figure className="mx-auto w-full min-w-0 max-w-[570px] lg:mr-0">
            <div className="overflow-hidden rounded-[12px] border border-[#cbb9a6] bg-[#dfd7ce] bg-[radial-gradient(ellipse_at_9%_12%,#f4cbb6_0%,transparent_57%),radial-gradient(ellipse_at_95%_95%,#b5c4d9_0%,transparent_66%)] p-3 sm:p-7">
              <picture className="block overflow-hidden rounded border border-black/15 bg-[#eeeee4] shadow-[0_8px_26px_#42392f28]">
                <source media="(max-width: 639px)" srcSet={mobile.srcSet} sizes={mobile.sizes} width={700} height={workspace.phoneHeight} />
                <img {...desktop} alt={workspace.alt} className="h-auto w-full" />
              </picture>
            </div>
            <figcaption className="mt-2.5 text-xs leading-5 text-text-secondary">{workspace.caption}</figcaption>
          </figure>
        </div>
        <ol className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.workflow.items.map((item, index) => <li key={item.title} className="border-t border-hairline pt-3">
            <span aria-hidden className="font-mono text-xs text-brand">{String(index + 1).padStart(2, '0')}</span>
            <h3 className="mt-1 text-base font-semibold text-text-primary">{item.title}</h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{item.body}</p>
          </li>)}
        </ol>
        <div className="mt-7 grid gap-5 border-t border-hairline pt-5 sm:grid-cols-2">
          {([[assistance.milo, '/ai-video-prompt-generator', Sparkles], [assistance.studio, '/studio', Clapperboard]] as const).map(([item, href, Icon]) => (
            <div key={href} className="grid grid-cols-[1.5rem_1fr] items-start gap-2">
              <Icon aria-hidden className="mt-1 h-4 w-4 text-brand" />
              <div><Link href={href} className="inline-flex min-h-8 items-center text-sm font-semibold text-text-primary hover:underline">{item.title}</Link>
                <p className="max-w-lg text-xs leading-5 text-text-secondary">{item.body}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PayAsYouGoMcpPlanningSection({ data }: PayAsYouGoPageDataProps) {
  if (!data.mcpPlanning) return null;
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold tracking-normal text-text-primary">{data.mcpPlanning.title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{data.mcpPlanning.body}</p>
        </div>
        <Link href={data.mcpPlanning.href} className="shrink-0 text-sm font-semibold text-brand hover:text-brandHover">
          {data.mcpPlanning.label} →
        </Link>
      </div>
    </section>
  );
}

export function PayAsYouGoQuoteFactorsSection({ data }: PayAsYouGoPageDataProps) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className={`${PAYG_CONTAINER_CLASS_NAME} py-12`}>
        <PayAsYouGoSectionHeader {...data.quoteFactors.header} />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.quoteFactors.items.map((item) => (
            <article key={item.title} className="border-t border-hairline pt-4">
              <PayAsYouGoSemanticIcon id={item.icon} className="h-5 w-5 text-brand" />
              <h3 className="mt-4 text-sm font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
