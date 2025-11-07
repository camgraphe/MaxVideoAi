import type { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import { getExampleDemoForEngine } from '@/server/engine-demos';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

const PAGE_TITLE = 'MiniMax Hailuo 02 (Text-to-Video) – Fast, Stylized AI Generation';
const PAGE_DESCRIPTION =
  'Generate fast, stylized video from text prompts with MiniMax Hailuo 02. Ideal for quick loops, motion tests, and experimental visuals—silent and budget-friendly via MaxVideoAI.';
const CANONICAL_URL = 'https://maxvideoai.com/models/minimax-hailuo-02-text';
const OG_IMAGE = '/og/minimax-hailuo-02-text-og.jpg';

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
        alt: 'MiniMax Hailuo 02 stylized AI video output via MaxVideoAI.',
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

export default async function MiniMaxTextToVideoPage() {
  const { dictionary } = await resolveDictionary();
  const example = await getExampleDemoForEngine('minimax-hailuo-02-text');
  const demoVideoUrl = example?.videoUrl ?? 'https://v3.fal.media/files/b/kangaroo/minimax_t2v.mp4';
  const demoPoster = example?.posterUrl ?? '/hero/minimax-video01.jpg';
  const brand = PARTNER_BRAND_MAP.get('minimax');

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
          <h1 className="text-4xl font-semibold text-text-primary">MiniMax Hailuo 02 – Text-to-Video AI Engine for Fast Visuals</h1>
          <p className="mt-5 text-lg text-text-secondary">
            MiniMax’s Hailuo 02 engine generates short, stylized videos from pure text prompts—no image upload required. It’s designed for
            testing motion, structure, and rhythm with fast turnaround, silent output, and low cost.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Create stylized, quick visual sketches from text</li>
              <li>Test ideas for transitions, mood, or motion structure</li>
              <li>Generate fast clips for editing or prototyping workflows</li>
              <li>Produce experimental visuals for reels or background loops</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Duration:</strong> 6 or 10-second clips for rapid iteration{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://fal.ai/models/fal-ai/minimax-hailuo-02-text"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  fal.ai model page
                </a>
              </div>
              <div>
                <strong>Resolution:</strong> 720p or 1080p in landscape and portrait{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://www.minimax.chat/developer/docs/video"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  MiniMax API Docs
                </a>
              </div>
              <div>
                <strong>Audio:</strong> Silent output—designed for visual exploration only
              </div>
              <div>
                <strong>Inputs:</strong> Text prompts only—focus on motion, lighting, and style cues
              </div>
              <div>
                <strong>Modes:</strong> Text-to-video drafts—no reference images or audio toggles
              </div>
              <div>
                <strong>Pricing:</strong> Pay-as-you-go via MaxVideoAI — $0.05/s (no audio)
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              “A stylized fox running through a windy forest, camera follows from behind, swirling leaves, cinematic depth of field.”
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">Keep prompts short and motion-driven:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Describe a clear subject in motion</li>
              <li>Add environmental movement—wind, fog, leaves, shadows</li>
              <li>Call out cinematic camera cues: pan, follow, tracking, zoom</li>
              <li>Skip audio references—Hailuo 02 is visual-only</li>
              <li>Use concise language for the best control and speed</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>🦊 Great for sketching motion ideas or animated cutaways</li>
              <li>⚡ Build short creative loops or story beats quickly</li>
              <li>📷 Think like a DoP—mention lenses, tracking, lighting</li>
              <li>🎨 Layer visual texture: foggy, glowing, ink-style, sketch</li>
              <li>❌ Silent output—perfect for adding custom sound in post</li>
            </ul>
          </div>
        </section>

        <div className="my-12">
          <video
            controls
            playsInline
            poster={demoPoster}
            src={demoVideoUrl}
            className="mx-auto my-8 w-full max-w-[720px] rounded-lg shadow-2xl bg-black/95 opacity-90 transition hover:opacity-100"
            style={{ mixBlendMode: 'screen' }}
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="text-center">
          <Link
            href="/generate?engine=minimax-hailuo-02-text"
            className="inline-flex items-center justify-center rounded-pill bg-accent px-6 py-3 text-base font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-analytics-event="cta_click"
            data-analytics-engine="minimax-hailuo-02-text"
            data-analytics-position="bottom"
          >
            🚀 Try MiniMax Text-to-Video
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
        <h2 className="text-lg font-semibold text-text-primary">MiniMax Hailuo 02 Text FAQ</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="font-semibold text-text-primary">Why choose MiniMax over premium engines?</dt>
            <dd className="mt-1">
              Hailuo 02 offers a great price-to-quality ratio for volume campaigns. It is ideal for social ads, product
              explainers, and iterative concepting where you need dozens of clips without draining credits.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">What prompt style works best?</dt>
            <dd className="mt-1">
              Keep prompts structured but concise—two to three sentences covering setting, motion, and tone. Hailuo
              rewards clear direction and can introduce artifacts when overloaded with adjectives.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">How do I handle upscales?</dt>
            <dd className="mt-1">
              Run the resulting clip through our built-in upscaler or send the same prompt to Veo 3 Fast for a sharper
              version. Pricing transparency helps you compare before committing additional credits.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
