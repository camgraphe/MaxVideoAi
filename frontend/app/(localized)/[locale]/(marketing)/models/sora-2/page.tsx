import type { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import { getExampleDemoForEngine } from '@/server/engine-demos';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

const PAGE_TITLE = 'Sora 2 – Generate AI Videos from Text or Image with Sound';
const PAGE_DESCRIPTION =
  'Create rich AI-generated videos from text or image prompts using Sora 2. Native voice-over, ambient effects, and motion sync available via MaxVideoAI.';
const CANONICAL_URL = 'https://maxvideoai.com/models/sora-2';
const OG_IMAGE = '/og/sora-2-og.jpg';

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
        alt: 'Sora 2 by OpenAI generating cinematic video with native audio via MaxVideoAI.',
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

export default async function Sora2ModelPage() {
  const { dictionary } = await resolveDictionary();
  const example = await getExampleDemoForEngine('sora-2');
  const demoVideoUrl = example?.videoUrl ?? 'https://storage.googleapis.com/falserverless/example_outputs/sora_t2v_output.mp4';
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
          <h1 className="text-4xl font-semibold text-text-primary">Sora 2 – AI Video from Text or Image with Native Sound</h1>
          <p className="mt-5 text-lg text-text-secondary">
            Sora 2 by OpenAI brings text-to-video and image-to-video generation into one engine, combining cinematic visuals with
            full native audio—voice-over, ambient sound, and synced motion. Animate concepts, scenes, or objects directly from words
            or reference images without leaving MaxVideoAI.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Text-to-video clips with voice-over narration</li>
              <li>Image-to-video animations with ambient sound and motion</li>
              <li>Social content for TikTok or Instagram in 9:16 with audio sync</li>
              <li>Rapid storytelling, concept videos, or onboarding sequences</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Duration:</strong> Choose 4, 8, or 12-second runs (current MaxVideoAI limit){' '}
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
                <strong>Resolution:</strong> 1080p delivery in 16:9 and 9:16 aspect ratios{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://higgsfield.ai/sora-2-ai-video-presets"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Higgsfield AI
                </a>
              </div>
              <div>
                <strong>Audio:</strong> Native voice-over, ambient layers, and effects sync{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://venturebeat.com/ai/openai-debuts-sora-2-ai-video-generator-app-with-sound-and-self-insertion"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  VentureBeat
                </a>
              </div>
              <div>
                <strong>Inputs:</strong> Text prompts or image + text for animated remixes{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://venturebeat.com/ai/openai-debuts-sora-2-ai-video-generator-app-with-sound-and-self-insertion"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  VentureBeat
                </a>
              </div>
              <div>
                <strong>Modes:</strong> Text-to-video & image-to-video workflows with native audio toggles
              </div>
              <div>
                <strong>Pricing:</strong> Pay-as-you-go via MaxVideoAI — audio-on renders from $0.52/s (~$4.16 per 8-second clip)
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              “A glowing library in the middle of a stormy ocean, books flying in the air, camera pans upward to reveal lightning in
              the sky, soft orchestral music, voice-over: ‘Knowledge survives everything.’”
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">Structure each Sora 2 run for clarity and fidelity:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Start with a vivid scene description (setting + atmosphere)</li>
              <li>Add motion: camera movement, timing, and pacing cues</li>
              <li>Specify audio elements like voice-over, ambient sound, or musical cues</li>
              <li>For image-to-video, note what should animate from the still</li>
              <li>Layer in tone or style: “film noir”, “anime lighting”, “documentary grade”</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>🎙️ Use voice-over to drive short-form narratives</li>
              <li>🖼️ Combine a reference image + text prompt for precise animations</li>
              <li>🎧 Audio boosts realism — always specify soundscape elements</li>
              <li>📱 For mobile-first cuts, go vertical 9:16 and call for punchy transitions</li>
              <li>🧪 Test scene-building with simple prompts before layering style instructions</li>
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
            href="/generate?engine=sora-2"
            className="inline-flex items-center justify-center rounded-pill bg-accent px-6 py-3 text-base font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-analytics-event="cta_click"
            data-analytics-engine="sora-2"
            data-analytics-position="bottom"
          >
            🚀 Generate with Sora 2
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
          <p className="mt-3 text-sm text-text-secondary">
            Compare Sora with Veo and Pika in our{' '}
            <Link href="/blog/compare-ai-video-engines" className="font-semibold text-accent hover:text-accentSoft">
              engine guide
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="mt-8 rounded-card border border-hairline bg-white p-6 text-sm text-text-secondary shadow-card sm:p-8">
        <h2 className="text-lg font-semibold text-text-primary">Sora 2 FAQ</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="font-semibold text-text-primary">How fast do Sora 2 renders complete?</dt>
            <dd className="mt-1">
              Eight-second clips typically return in three to five minutes. When demand spikes, MaxVideoAI automatically
              routes to the least busy Fal.ai region and surfaces an estimated start time in the queue.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Can I combine Sora runs with other engines?</dt>
            <dd className="mt-1">
              Yes—clone the job into Veo 3.1 or Pika 2.2 straight from the queue feed to compare motion styles without
              rewriting the prompt. Pricing for each engine appears before you confirm the rerun.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">What is required for access?</dt>
            <dd className="mt-1">
              A verified MaxVideoAI workspace with wallet credits. We handle provider provisioning, rate-limits, and
              compliance reviews; no OpenAI invite is needed.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
