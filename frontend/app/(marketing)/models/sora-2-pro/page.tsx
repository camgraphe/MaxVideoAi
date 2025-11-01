import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { resolveDictionary } from '@/lib/i18n/server';
import { getExampleDemoForEngine } from '@/server/engine-demos';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

const PAGE_TITLE = 'Sora 2 Pro – Longer AI Videos with Audio & Enhanced Prompt Control';
const PAGE_DESCRIPTION =
  'Create longer, more immersive AI videos from text or images using Sora 2 Pro. Native voice, ambient sound, prompt chaining, and advanced control via MaxVideoAI.';
const CANONICAL_URL = 'https://maxvideoai.com/models/sora-2-pro';
const OG_IMAGE = '/og/sora-2-pro-og.jpg';

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
        alt: 'Sora 2 Pro multi-scene AI video with native audio via MaxVideoAI.',
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

export default async function Sora2ProModelPage() {
  const { dictionary } = resolveDictionary();
  const example = await getExampleDemoForEngine('sora-2-pro');
  const demoVideoUrl = example?.videoUrl ?? 'https://storage.googleapis.com/falserverless/example_outputs/sora_2_i2v_output.mp4';
  const demoPoster = example?.posterUrl ?? '/hero/sora2.jpg';
  const brand = PARTNER_BRAND_MAP.get('openai');

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
          <h1 className="text-4xl font-semibold text-text-primary">
            Sora 2 Pro – Extended Video Generation with Full Audio & Scene Control
          </h1>
          <p className="mt-5 text-lg text-text-secondary">
            Sora 2 Pro builds on the core engine of Sora 2, unlocking longer durations, multi-scene prompts, and tighter control over
            camera, motion, and sound. Ideal for creators who need more than a single clip—and who want their AI videos to speak,
            move, and tell.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Multi-scene storytelling with sound and motion</li>
              <li>Longer vertical videos with transitions for reels and shorts</li>
              <li>Voice-driven explainers and onboarding sequences</li>
              <li>Animated clips from stills + script (image-to-video + voice-over)</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Duration:</strong> Choose 4, 8, or 12-second runs; chain prompts for longer cuts{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://m.economictimes.com/tech/artificial-intelligence/openai-allows-15-second-videos-for-all-sora-2-users-25-seconds-for-pro-users/articleshow/124594772.cms"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Economic Times
                </a>
              </div>
              <div>
                <strong>Resolution:</strong> 1080p 16:9 and vertical 9:16 output; Pro doubles duration{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://openai.com/blog/sora-2-pro-release"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenAI blog
                </a>
              </div>
              <div>
                <strong>Audio:</strong> Full native audio with timing control for voice, ambience, and FX{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://venturebeat.com/ai/openai-sora-2-pro-video-ai-with-sound-and-advanced-controls"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  VentureBeat
                </a>
              </div>
              <div>
                <strong>Inputs:</strong> Text prompts or image + text; supports chaining prompts into scenes{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://openai.com/blog/sora-2-pro-release"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenAI blog
                </a>
              </div>
              <div>
                <strong>Modes:</strong> Text-to-video, image-to-video, native audio, reference stills, and multi-prompt chaining
              </div>
              <div>
                <strong>Pricing:</strong> Pay-as-you-go via MaxVideoAI — audio-on renders from $0.60/s (~$4.80 per 8-second clip)
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              “Scene 1 → A medieval city under the stars, camera slowly pans above rooftops, lute music plays, voice-over: ‘Peace
              reigned for a century.’ → Scene 2 → A rider gallops across the plains at sunrise, orchestral swell, zoom-in to sword
              hilt glowing.”
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">Structure each Pro run for cinematic flow:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Use “→” to separate distinct scenes in one video</li>
              <li>Describe each scene with setting, motion, and tone</li>
              <li>Layer in sound cues: voice-over, ambience, music swells</li>
              <li>Include cinematic instructions: shot type, movement, zoom</li>
              <li>Combine image references with prompts for precise visuals</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>📽️ Build multi-shot stories by chaining prompts with “→” between scenes</li>
              <li>🎙️ Add voice-over to craft compelling branded narratives or explainers</li>
              <li>📸 Image-to-video prompts animate storyboards or product stills effortlessly</li>
              <li>🔊 Sora 2 Pro responds well to musical and ambient cues—“epic drums”, “echoing footsteps”</li>
              <li>📱 Specify vertical 9:16 for mobile-first videos and hook viewers with a strong opening scene</li>
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
            href="/generate?engine=sora-2-pro"
            className="inline-flex items-center justify-center rounded-pill bg-accent px-6 py-3 text-base font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-analytics-event="cta_click"
            data-analytics-engine="sora-2-pro"
            data-analytics-position="bottom"
          >
            🚀 Try Sora 2 Pro
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
    </div>
  );
}
