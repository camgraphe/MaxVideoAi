import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { resolveDictionary } from '@/lib/i18n/server';
import { getExampleDemoForEngine } from '@/server/engine-demos';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

const PAGE_TITLE = 'Veo 3 Fast – Quick Cinematic Video Generation (No Audio)';
const PAGE_DESCRIPTION =
  'Generate cinematic-style AI videos in seconds using Veo 3 Fast. Optimized for speed, silent playback, and low-cost prototyping via MaxVideoAI.';
const CANONICAL_URL = 'https://maxvideoai.com/models/veo-3-fast';
const OG_IMAGE = '/og/veo-3-fast-og.jpg';

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
        alt: 'Veo 3 Fast rapid cinematic AI video prototyping via MaxVideoAI.',
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

export default async function Veo3FastModelPage() {
  const { dictionary } = resolveDictionary();
  const example = await getExampleDemoForEngine('veo-3-fast');
  const demoVideoUrl = example?.videoUrl ?? 'https://v3b.fal.media/files/b/kangaroo/veo3fast_output.mp4';
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
              <Image
                src={brand.assets.light.svg}
                alt={brand.alt.light}
                width={140}
                height={40}
                className="h-10 w-auto dark:hidden"
              />
              <Image
                src={brand.assets.dark.svg}
                alt={brand.alt.dark}
                width={140}
                height={40}
                className="hidden h-10 w-auto dark:inline-flex"
              />
            </span>
          </div>
        ) : null}
        <header className="text-center">
          <h1 className="text-4xl font-semibold text-text-primary">Veo 3 Fast – Speed-First Cinematic AI Video Engine (No Audio)</h1>
          <p className="mt-5 text-lg text-text-secondary">
            Veo 3 Fast is your go-to engine for rapid cinematic video prototyping. It’s the same powerful visual model from Google
            DeepMind, stripped down for maximum speed—no audio, no queues. Test prompts, build references, and iterate on visuals in
            seconds.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Rapid prototyping of cinematic sequences</li>
              <li>Testing multiple prompts quickly without audio</li>
              <li>Looping visuals for social media or concept demos</li>
              <li>Low-cost storyboard animation</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Duration:</strong> Select 4, 6, or 8-second clips for rapid iteration{' '}
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
                <strong>Resolution:</strong> 1080p 16:9, with vertical 9:16 option{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://www.techradar.com/ai-platforms-assistants/veo-3-1-fast-mode-review"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TechRadar
                </a>
              </div>
              <div>
                <strong>Audio:</strong> No audio—silent renders for quick loops{' '}
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
                <strong>Inputs:</strong> Text prompts only—perfect for prompt exploration
              </div>
              <div>
                <strong>Modes:</strong> Text-to-video workflows tuned for speed; no reference image upload
              </div>
              <div>
                <strong>Pricing:</strong> Pay-as-you-go via MaxVideoAI — silent renders from $0.10/s (~$0.80 per clip)
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              “A lone astronaut walking across a frozen lake at sunset, cinematic wide shot, reflective ice, mist in the air, slow
              pan left, no audio.”
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">Keep prompts lean and visually focused:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Focus on composition—describe scene, subject, motion</li>
              <li>Add camera cues: “slow pan”, “tracking shot”, “zoom out”</li>
              <li>Anchor time of day and lighting: “sunset”, “golden hour”, “foggy”</li>
              <li>Avoid audio references—this engine renders silently</li>
              <li>Keep prompts under ~30 words to maximize turnaround</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>⚡ Ideal for fast prototyping: generate more variations for less</li>
              <li>🎬 Stick to visual language—describe shots, motion, and color palettes</li>
              <li>🧊 Perfect for cinematic moodboards and pre-viz decks</li>
              <li>🔁 Use 5–8 second loops for concept reels or intro stingers</li>
              <li>🪶 Lightweight workflow: no sound means faster, cheaper, simpler iteration</li>
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
            href="/generate?engine=veo-3-fast"
            className="inline-flex items-center justify-center rounded-pill bg-accent px-6 py-3 text-base font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-analytics-event="cta_click"
            data-analytics-engine="veo-3-fast"
            data-analytics-position="bottom"
          >
            🚀 Generate with Veo 3 Fast
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
        <h2 className="text-lg font-semibold text-text-primary">Veo 3 Fast FAQ</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="font-semibold text-text-primary">How fast is “Fast”?</dt>
            <dd className="mt-1">
              Most 6–8 second renders complete in under 90 seconds. If queues spike, MaxVideoAI displays an ETA and
              offers to re-route to Veo 3.1 for higher quality.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">What’s the best way to use Fast with other tiers?</dt>
            <dd className="mt-1">
              Draft storyboards in Veo 3 Fast, then promote approved cuts to Veo 3.1 or Sora 2 Pro for final polish.
              Because prompts stay identical, you spot differences in motion and price instantly.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Does Fast include audio?</dt>
            <dd className="mt-1">
              Yes, but quality is tuned for speed. For broadcast-ready mixes, rerun the prompt in Veo 3.1 or add audio
              in post. The queue lets you download silent or full mixes per job.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
