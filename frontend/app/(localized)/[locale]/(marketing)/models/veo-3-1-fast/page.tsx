import type { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import { getExampleDemoForEngine } from '@/server/engine-demos';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

const PAGE_TITLE = 'Veo 3.1 Fast – High-Speed AI Video Generation (with or without Audio)';
const PAGE_DESCRIPTION =
  'Use Veo 3.1 Fast for affordable, rapid AI video generation. Up to 8-second clips with optional native audio—perfect for social formats and fast iteration via MaxVideoAI.';
const CANONICAL_URL = 'https://maxvideoai.com/models/veo-3-1-fast';
const OG_IMAGE = '/og/veo-3-1-fast-og.jpg';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: CANONICAL_URL,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: CANONICAL_URL,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Veo 3.1 Fast generating cinematic AI video with optional audio via MaxVideoAI.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default async function Veo31FastModelPage() {
  const { dictionary } = await resolveDictionary();
  const example = await getExampleDemoForEngine('veo-3-1-fast');
  const demoVideoUrl = example?.videoUrl ?? 'https://v3b.fal.media/files/b/kangaroo/fast_output.mp4';
  const demoPoster = example?.posterUrl ?? '/hero/veo3.jpg';
  const brand = PARTNER_BRAND_MAP.get('google-veo');

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <Link href="/models" className="text-sm font-semibold text-accent hover:text-accentSoft">
        {'←'} {dictionary.models.hero.title}
      </Link>

      <div className="mt-6 rounded-card border border-hairline bg-white p-8 shadow-card">
        {brand ? (
          <div className="mb-6 flex justify-center">
            <span className="flex items-center gap-4">
              <Image src={brand.assets.light.svg} alt={brand.alt.light} width={140} height={40} className="h-10 w-auto dark:hidden" />
              <Image src={brand.assets.dark.svg} alt={brand.alt.dark} width={140} height={40} className="hidden h-10 w-auto dark:inline-flex" />
            </span>
          </div>
        ) : null}
        <header className="text-center">
          <h1 className="text-4xl font-semibold text-text-primary">Veo 3.1 Fast – Faster AI Video with Optional Audio</h1>
          <p className="mt-5 text-lg text-text-secondary">
            Veo 3.1 Fast brings DeepMind’s cinematic engine to rapid-fire generation. You get the same prompt fidelity and shot control,
            with a reduced cost per second—and audio is optional. Perfect for agile testing or looping content that needs a touch of sound.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Create short AI clips (up to 8 seconds) with optional native audio</li>
              <li>Generate fast loops for social content in 9:16 or 16:9</li>
              <li>Test narrative prompts quickly before longer runs</li>
              <li>Balance quality and speed for rapid creative iteration</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Duration:</strong> Up to 8-second clips for quick iterations{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://fal.ai/models/fal-ai/veo3.1/fast"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  fal.ai
                </a>
              </div>
              <div>
                <strong>Resolution:</strong> 1080p output in 16:9 and 9:16 formats{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://deepmind.google/models/veo"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  DeepMind Veo
                </a>
              </div>
              <div>
                <strong>Audio:</strong> Optional native audio—toggle on for voice and ambience{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://fal.ai/models/fal-ai/veo3.1/fast"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  fal.ai
                </a>
              </div>
              <div>
                <strong>Inputs:</strong> Text prompts only—ideal for quick prompt iteration
              </div>
              <div>
                <strong>Modes:</strong> Text-to-video with on/off audio control; no reference images
              </div>
              <div>
                <strong>Pricing:</strong> Pay-as-you-go via MaxVideoAI — $0.15/s with audio, $0.10/s without (~$1.20 per clip max)
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              “A misty forest at dawn, camera slowly zooms in on a mossy rock, sun rays piercing through the trees, ambient birdsong, no dialogue.”
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">Keep prompts tight and sensory-rich:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Describe light, texture, and focal subjects clearly</li>
              <li>Call out camera moves and time of day to set the mood</li>
              <li>Add ambient sound cues (wind, rain, birds) when audio is enabled</li>
              <li>Stay under ~25 words to keep runs fast and cost-efficient</li>
              <li>Stick to single-scene prompts—this Fast mode excels at focused shots</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>⚡ Ideal for quick output with optional sound design</li>
              <li>🎧 Toggle audio on for voice or ambience, off for silent prototyping</li>
              <li>🪶 Excels at nature scenes, dreamscapes, and mood-driven cuts</li>
              <li>🧪 Use it as a testbed before moving to full Veo 3.1 for longer runs</li>
              <li>📱 Export 9:16 for reels or 16:9 for YouTube Shorts</li>
            </ul>
          </div>
        </section>

        <div className="my-12">
          <div className="mx-auto my-8 w-full max-w-[720px] overflow-hidden rounded-3xl border border-black/5 bg-neutral-950/95 p-2 shadow-2xl">
            <video
              controls
              playsInline
              poster={demoPoster}
              src={demoVideoUrl}
              className="h-full w-full rounded-2xl object-cover opacity-90 transition hover:opacity-100"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/generate?engine=veo-3-1-fast"
            className="inline-flex items-center justify-center rounded-pill bg-accent px-6 py-3 text-base font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-analytics-event="cta_click"
            data-analytics-engine="veo-3-1-fast"
            data-analytics-position="bottom"
          >
            🚀 Try Veo 3.1 Fast
          </Link>
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/models" className="font-semibold text-accent hover:text-accentSoft">
              See all engines
            </Link>{' '}
            •{' '}
            <Link href="/workflows" className="font-semibold text-accent hover:text-accentSoft">
              Explore workflows
            </Link>{' '}
            •{' '}
            <Link href="/pricing" className="font-semibold text-accent hover:text-accentSoft">
              View pricing
            </Link>
          </p>
        </div>
      </div>
      <div className="mt-8 rounded-card border border-hairline bg-white p-6 text-sm text-text-secondary shadow-card sm:p-8">
        <h2 className="text-lg font-semibold text-text-primary">Veo 3.1 Fast FAQ</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="font-semibold text-text-primary">Where does Veo 3.1 Fast sit in the lineup?</dt>
            <dd className="mt-1">
              It bridges Veo 3 Fast and Veo 3.1. You get the framing controls and Dolby previews from Veo 3.1 with a
              slightly shorter turnaround time—great for reviews that still demand quality.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Can I reuse Veo 3.1 presets?</dt>
            <dd className="mt-1">
              Yes—clone any Veo 3.1 render and switch the engine to 3.1 Fast. All camera and tone presets transfer, so
              stakeholders can compare outputs apples-to-apples.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">How does pricing compare?</dt>
            <dd className="mt-1">
              Veo 3.1 Fast sits between Fast and 3.1. Expect ~15% savings versus full 3.1 runs while keeping premium
              framing. The calculator and queue display the exact rate before each render.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
