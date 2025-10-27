import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { resolveDictionary } from '@/lib/i18n/server';
import { getExampleDemoForEngine } from '@/server/engine-demos';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

const PAGE_TITLE = 'Pika Text-to-Video – Stylized AI Video from Prompts';
const PAGE_DESCRIPTION =
  'Generate creative, animated AI videos from text prompts using Pika. Perfect for short-form, stylized visuals without audio via MaxVideoAI.';
const CANONICAL_URL = 'https://maxvideoai.com/models/pika-text-to-video';
const OG_IMAGE = '/og/pika-text-to-video-og.jpg';

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
        alt: 'Pika text-to-video engine generating stylized AI animation via MaxVideoAI.',
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

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Pika Text-to-Video',
  operatingSystem: 'Web',
  applicationCategory: 'CreativeTool',
  description:
    'Pika text-to-video lets you craft stylized 3–5 second animations from text prompts—perfect for punchy, silent clips via MaxVideoAI.',
  url: CANONICAL_URL,
  softwareVersion: '2.2',
  provider: {
    '@type': 'Organization',
    name: 'MaxVideoAI',
    url: 'https://maxvideoai.com',
  },
  offers: {
    '@type': 'Offer',
    price: 'pay-as-you-go',
    priceCurrency: 'USD',
  },
};

export default async function PikaTextToVideoPage() {
  const { dictionary } = resolveDictionary();
  const example = await getExampleDemoForEngine('pika-text-to-video');
  const demoVideoUrl = example?.videoUrl ?? 'https://v3.fal.media/files/b/kangaroo/pika_text2video_sample.mp4';
  const demoPoster = example?.posterUrl ?? '/hero/pika-22.jpg';
  const brand = PARTNER_BRAND_MAP.get('pika');

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
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
          <h1 className="text-4xl font-semibold text-text-primary">Pika Text-to-Video – Creative AI Video Engine (No Audio)</h1>
          <p className="mt-5 text-lg text-text-secondary">
            Pika’s text-to-video engine focuses on speed and style. Generate fun, snappy clips with a wide range of animation looks and
            camera motion—ideal for creators exploring punchy visuals in minutes.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Short TikTok/Reel-style videos with stylized animation</li>
              <li>Fast previews of motion ideas or visual hooks</li>
              <li>Looping animations or cutaway effects for editors</li>
              <li>Playful visuals for gaming, fashion, or pop culture beats</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Duration:</strong> 5 or 8-second clips tuned for social loops{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://www.pika.art/faq"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pika Labs FAQ
                </a>
              </div>
              <div>
                <strong>Resolution:</strong> 720p or 1080p in 1:1, 16:9, or 9:16{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://discord.gg/pika"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pika Discord
                </a>
              </div>
              <div>
                <strong>Audio:</strong> Silent output—drop into edits or add music later
              </div>
              <div>
                <strong>Inputs:</strong> Text prompts only—focus on clear style direction
              </div>
              <div>
                <strong>Modes:</strong> Text-to-video only; no reference image upload
              </div>
              <div>
                <strong>Pricing:</strong> Pay-as-you-go via MaxVideoAI — $0.06/s (no audio)
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              “A pixel-art cat jumping through portals, retro arcade background, camera pans quickly, rainbow glitch effects, stylized 2D animation.”
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">Keep prompts lively and concise:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Lead with bold subjects and vibrant motion descriptors</li>
              <li>Call out animation styles like “anime”, “pixel-art”, “comic book”</li>
              <li>Add effect-driven terms: “glitch”, “motion blur”, “zoom-in”</li>
              <li>Set the backdrop or vibe—arcade, skyline, studio, outer space</li>
              <li>Keep it short and punchy for the strongest visuals</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>⚡ Perfect for quick loops and visual punchlines</li>
              <li>🎨 Layer in stylistic cues—anime, comic, vintage, pixel, CG</li>
              <li>🔁 Use simple prompts to craft seamless 3–5 second loops</li>
              <li>📱 9:16 exports pop in reels, stories, and Shorts</li>
              <li>❌ No audio—ideal for overlaying custom sound in the edit</li>
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
            href="/generate?engine=pika-text-to-video"
            className="inline-flex items-center justify-center rounded-pill bg-accent px-6 py-3 text-base font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-analytics-event="cta_click"
            data-analytics-engine="pika-text-to-video"
            data-analytics-position="bottom"
          >
            🚀 Try Pika Text-to-Video
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
