import Image from 'next/image';
import { ArrowRight, CheckCircle2, Gauge, Layers3, Maximize2, Sparkles } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/types';
import { Link } from '@/i18n/navigation';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { ButtonLink } from '@/components/ui/Button';

const SOURCE_IMAGE_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/d49ec543-8b71-42bb-aa7e-ce5289e28187.webp';
const OUTPUT_IMAGE_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp';
const DETAIL_IMAGE_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/7a859184-b718-4481-ae01-35efe66f4c9a.webp';

type UpscaleLandingContent = Dictionary['toolMarketing']['upscale'];

function serializeJsonLd(data: object) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function SectionIntro({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">{title}</h2>
      {body ? <p className="mt-3 text-sm leading-7 text-text-secondary sm:text-base">{body}</p> : null}
    </div>
  );
}

function HeroVisual({ beforeLabel, afterLabel }: { beforeLabel: string; afterLabel: string }) {
  return (
    <div className="rounded-[32px] border border-slate-950/10 bg-[linear-gradient(135deg,#111827,#1f2937_52%,#172554)] p-4 shadow-[0_42px_120px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between border-b border-white/10 px-2 pb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
        <span>Upscale Studio</span>
        <span>SeedVR2 · Topaz</span>
      </div>

      <div className="grid gap-4 pt-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-black">
            <Image
              src={SOURCE_IMAGE_URL}
              alt={beforeLabel}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 360px"
              className="scale-110 object-cover blur-[1.2px] saturate-[0.88]"
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            <span>{beforeLabel}</span>
            <span>1.2 MP</span>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.08] p-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-black">
            <Image
              src={OUTPUT_IMAGE_URL}
              alt={afterLabel}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 460px"
              className="object-cover"
            />
            <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              4x ready
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
            <span>{afterLabel}</span>
            <span>Delivery asset</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          ['Input', 'Image / video'],
          ['Pricing', 'Dynamic video'],
          ['Output', 'Library ready'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[18px] border border-white/10 bg-white/[0.06] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UpscaleLandingPage({ content }: { content: UpscaleLandingContent }) {
  const faqEntries = content.faq.map((entry) => ({ question: entry.q, answer: entry.a }));
  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: content.meta.title,
    description: content.meta.description,
    serviceType: 'AI image and video upscale',
    provider: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
    },
    areaServed: 'Worldwide',
  };

  return (
    <div className="bg-bg">
      <FAQSchema questions={faqEntries} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }} />

      <section className="border-b border-hairline bg-[linear-gradient(180deg,#ffffff,#f6f8fb)]">
        <div className="container-page grid min-h-[720px] max-w-6xl gap-10 py-16 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1fr)] lg:items-center lg:py-20">
          <div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted shadow-card">
              <Maximize2 className="h-3.5 w-3.5 text-brand" />
              {content.hero.badge}
            </div>
            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-text-primary sm:text-6xl">
              {content.hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-text-secondary sm:text-lg">{content.hero.body}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/app/tools/upscale" linkComponent={Link} size="lg">
                {content.hero.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/tools" linkComponent={Link} variant="outline" size="lg">
                {content.hero.secondaryCta}
              </ButtonLink>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                ['6', 'fal.ai models'],
                ['20s', 'video cap'],
                ['1', 'shared surface'],
              ].map(([value, label]) => (
                <div key={label} className="border-l border-hairline pl-4">
                  <p className="text-2xl font-semibold text-text-primary">{value}</p>
                  <p className="mt-1 text-xs text-text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <HeroVisual beforeLabel={content.hero.beforeLabel} afterLabel={content.hero.afterLabel} />
        </div>
      </section>

      <section className="section">
        <div className="container-page max-w-6xl stack-gap-md">
          <SectionIntro eyebrow={content.models.eyebrow} title={content.models.title} body={content.models.body} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {content.models.cards.map((card, index) => {
              const Icon = index === 0 ? Layers3 : index === 1 ? Sparkles : index === 2 ? Gauge : Maximize2;
              return (
                <article key={card.title} className="rounded-[22px] border border-hairline bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-[0_22px_70px_rgba(15,23,42,0.10)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-input bg-brand/10 text-brand">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">{card.badge}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-text-primary">{card.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-text-secondary">{card.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-hairline bg-surface section">
        <div className="container-page grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:items-center">
          <div className="relative aspect-[16/11] overflow-hidden rounded-[28px] border border-hairline bg-bg shadow-card">
            <Image src={DETAIL_IMAGE_URL} alt="" fill sizes="(max-width: 1024px) 100vw, 560px" className="object-cover" />
            <div className="absolute inset-x-5 bottom-5 rounded-[20px] border border-white/20 bg-black/45 p-4 text-white backdrop-blur">
              <p className="text-sm font-semibold">One output, reused everywhere</p>
              <p className="mt-1 text-xs leading-5 text-slate-200">The same upscale surface is ready for Library, job actions, and future generation flows.</p>
            </div>
          </div>

          <div className="stack-gap-md">
            <SectionIntro eyebrow={content.workflow.eyebrow} title={content.workflow.title} />
            <div className="grid gap-3">
              {content.workflow.steps.map((step, index) => (
                <div key={step.title} className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 rounded-[18px] border border-hairline bg-bg p-4 shadow-sm">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{step.title}</h3>
                    <p className="mt-1 text-sm leading-7 text-text-secondary">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page max-w-5xl stack-gap-md">
          <SectionIntro eyebrow="FAQ" title="Upscale details" />
          <div className="grid gap-3">
            {content.faq.map((entry) => (
              <div key={entry.q} className="rounded-[18px] border border-hairline bg-surface p-5">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-brand" />
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{entry.q}</h3>
                    <p className="mt-2 text-sm leading-7 text-text-secondary">{entry.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
