import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import FaqJsonLd from '@/components/FaqJsonLd';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';

const COMPARE_SLUG_MAP = buildSlugMap('compare');
const COMPARE_META: Record<AppLocale, { title: string; description: string }> = {
  en: {
    title: 'AI Video Engines — Compare Sora, Veo, Pika | MaxVideoAI',
    description: 'Compare availability, latency, and compliance routes for Sora 2, Veo 3, Pika, and MiniMax engines in Europe.',
  },
  fr: {
    title: 'Comparatif moteurs vidéo IA — Sora, Veo, Pika | MaxVideoAI',
    description: 'Comparez disponibilité, latence et conformité pour Sora 2, Veo 3, Pika et MiniMax en Europe.',
  },
  es: {
    title: 'Motores de vídeo IA — Compara Sora, Veo, Pika | MaxVideoAI',
    description: 'Compara disponibilidad, latencia y rutas de cumplimiento para Sora 2, Veo 3, Pika y MiniMax en Europa.',
  },
};

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const metadataUrls = buildMetadataUrls(locale, COMPARE_SLUG_MAP);
  const metaCopy = COMPARE_META[locale] ?? COMPARE_META.en;

  return {
    title: metaCopy.title,
    description: metaCopy.description,
    alternates: {
      canonical: metadataUrls.canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      title: metaCopy.title,
      description: metaCopy.description,
      url: metadataUrls.canonical,
      siteName: 'MaxVideoAI',
      images: [
        {
          url: '/og/price-before.png',
          width: 1200,
          height: 630,
          alt: metaCopy.title,
        },
      ],
      locale: metadataUrls.ogLocale,
      alternateLocale: metadataUrls.alternateOg,
    },
    twitter: {
      card: 'summary_large_image',
      title: metaCopy.title,
      description: metaCopy.description,
      images: ['/og/price-before.png'],
    },
  };
}

const FAQ_ITEMS = [
  {
    question: 'Does MaxVideoAI support European billing for Fal.ai engines?',
    answer:
      'Yes. We process invoices in EUR or GBP and map them to Fal.ai usage so finance teams can reconcile spend without US subsidiaries or prepaid card workarounds.',
  },
  {
    question: 'How quickly can teams launch a Sora 2 project?',
    answer:
      'Most creative teams start prompting within two business days. We keep onboarding templates ready and provide fallback Veo or Pika presets while Sora access is finalised.',
  },
  {
    question: 'Can I monitor model changes without refreshing documentation?',
    answer:
      'The MaxVideoAI workspace highlights latency, output limits, and policy updates in real time, so producers know when to retry or pivot to alternative engines.',
  },
];

export default function AiVideoEnginesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">
          Run AI Video Generators in Europe — Sora 2, Veo 3, Pika &amp; More
        </h1>
        <p className="text-base text-text-secondary">
          MaxVideoAI keeps cinematic text-to-video engines compliant, monitored, and production-ready for European teams. Use this hub
          to understand availability, compare creative trade-offs, and launch projects with the right guardrails from day one.
        </p>
        <p className="text-base text-text-secondary">
          Not sure which model to pick? Read our{' '}
          <Link href={{ pathname: '/blog/[slug]', params: { slug: 'compare-ai-video-engines' } }} className="font-semibold text-accent hover:text-accentSoft">
            comparison article
          </Link>
          .
        </p>
      </header>

      <section className="mt-12 space-y-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Sora 2 availability and alternatives</h2>
          <p className="text-base leading-relaxed text-text-secondary">
            Sora 2 remains a staged rollout, so MaxVideoAI handles the verification trail, regional compliance, and predictive routing
            when capacity spikes. Producers can benchmark storyboards against{' '}
            <Link href={{ pathname: '/models/[slug]', params: { slug: 'sora-2' } }} className="font-semibold text-accent hover:text-accentSoft">
              Sora 2 reference projects
            </Link>{' '}
            and switch to Sora 2 Pro presets or Veo 3 sequences when turnaround speed matters more than frontier fidelity. We document
            prompt structures, footage approvals, and post-production best practices so every brief stays aligned with OpenAI review
            criteria while still shipping on time. Regional producers also receive weekly availability notes covering audio support,
            frame length, and compliance traceability for regulated sectors.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Veo 3: cinematic text-to-video for creators</h2>
          <p className="text-base leading-relaxed text-text-secondary">
            Veo 3.1 bridges the gap between storyboard accuracy and polished motion, especially when social or advertising deliverables
            need voice-over sync. Our routing keeps latency predictable and lets directors compare the fast preset with the longer-run
            tier before booking studio time. Review the latest guardrails, aspect ratios, and narration-ready examples on the{' '}
            <Link href={{ pathname: '/models/[slug]', params: { slug: 'veo-3-1' } }} className="font-semibold text-accent hover:text-accentSoft">
              Veo 3.1 overview
            </Link>{' '}
            or tap the Fast variant when iteration speed outranks audio or frame count. We also surface a change log inside the workspace
            so editors can see when motion controls, audio fidelity, or policy notes adjust between releases.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Pika 2.2 for fast social content</h2>
          <p className="text-base leading-relaxed text-text-secondary">
            When teams need playful loops or short-form edits, Pika 2.2 delivers multi-aspect outputs at a fraction of the budget.
            MaxVideoAI exposes curated presets so editors can jump from vertical reels to square product shots without leaving the
            workspace. Compare text-to-video and image-to-video modes side-by-side on our{' '}
            <Link href={{ pathname: '/models/[slug]', params: { slug: 'pika-text-to-video' } }} className="font-semibold text-accent hover:text-accentSoft">
              Pika quickstart guide
            </Link>{' '}
            and reuse prompt banks that have already been cleared for brand-safe campaigns. Daily QA passes flag style drift or artefacts
            so you know when to regenerate, upscale, or hand off to animators for refinement.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">How MaxVideoAI routes Fal.ai engines</h2>
          <p className="text-base leading-relaxed text-text-secondary">
            Fal.ai powers the multi-engine routing backbone behind MaxVideoAI, letting us burst to capacity while surfacing a consistent
            interface to creative leads. Our orchestration layer keeps prompts portable, logs every render, and exposes diagnostics so
            you know when to retry or hand off to another engine like{' '}
            <Link href={{ pathname: '/models/[slug]', params: { slug: 'veo-3-fast' } }} className="font-semibold text-accent hover:text-accentSoft">
              Veo 3 Fast
            </Link>{' '}
            or{' '}
            <Link href={{ pathname: '/models/[slug]', params: { slug: 'minimax-hailuo-02-text' } }} className="font-semibold text-accent hover:text-accentSoft">
              MiniMax Hailuo
            </Link>{' '}
            for stylised outputs. Teams also gain access to rate cards, audit trails, and regional compliance notes in one workspace, and
            automated playbooks explain how to escalate priority or swap render regions when demand peaks.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-text-primary">Compare engines and pricing live</h2>
          <p className="text-base leading-relaxed text-text-secondary">
            The MaxVideoAI console keeps an always-on comparison across Sora, Veo, Pika, and MiniMax so producers can share real-time
            trade-offs with clients. Start with the curated{' '}
            <Link href="/models" className="font-semibold text-accent hover:text-accentSoft">
              model directory
            </Link>{' '}
            to shortlist engines, then open the{' '}
            <Link href="/pricing" className="font-semibold text-accent hover:text-accentSoft">
              live pricing estimator
            </Link>{' '}
            to preview per-second costs, queue forecasts, and audio availability before kicking off renders or approvals. Shared compare
            views show voice support, max durations, and turn-key presets so clients can sign off without waiting for another deck.
          </p>
        </div>
      </section>

      <section className="mt-16 space-y-4">
        <h2 className="text-2xl font-semibold text-text-primary">AI video routing FAQ</h2>
        <div className="space-y-3 text-base leading-relaxed text-text-secondary">
          {FAQ_ITEMS.map((item) => (
            <article key={item.question} className="rounded-card border border-hairline bg-white p-5 shadow-card">
              <h3 className="text-lg font-semibold text-text-primary">{item.question}</h3>
              <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
      <FaqJsonLd qa={FAQ_ITEMS.map(({ question, answer }) => ({ q: question, a: answer }))} />
      <div className="mt-16 rounded-card border border-hairline bg-white p-6 text-sm leading-relaxed text-text-secondary shadow-card">
        Looking for sequenced prompt recipes? Read the latest guides on the{' '}
        <Link href="/blog" className="font-semibold text-accent hover:text-accentSoft">
          MaxVideoAI blog
        </Link>{' '}
        for branded storytelling walkthroughs and engine updates.
      </div>
    </div>
  );
}
