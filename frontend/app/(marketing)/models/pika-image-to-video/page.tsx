import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { resolveDictionary } from '@/lib/i18n/server';
import { getExampleDemoForEngine } from '@/server/engine-demos';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

const PAGE_TITLE = 'Pika Image-to-Video – Animate Any Still Frame with AI';
const PAGE_DESCRIPTION =
  'Turn any static image into a dynamic clip using Pika’s image-to-video engine. Add motion, zooms, and stylized transitions—silent, fast, and perfect for loops.';
const CANONICAL_URL = 'https://maxvideoai.com/models/pika-image-to-video';
const OG_IMAGE = '/og/pika-image-to-video-og.jpg';

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
        alt: 'Pika image-to-video engine animating a fantasy castle scene via MaxVideoAI.',
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
  name: 'Pika Image-to-Video',
  operatingSystem: 'Web',
  applicationCategory: 'CreativeTool',
  description:
    'Pika image-to-video transforms still images into animated clips with zooms, pans, and stylized motion—delivered fast and without audio on MaxVideoAI.',
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

export default async function PikaImageToVideoPage() {
  const { dictionary } = resolveDictionary();
  const example = await getExampleDemoForEngine('pika-image-to-video');
  const demoVideoUrl = example?.videoUrl ?? 'https://v3.fal.media/files/b/kangaroo/pika_img2video_sample.mp4';
  const demoPoster = example?.posterUrl ?? '/hero/pika-15.jpg';
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
          <h1 className="text-4xl font-semibold text-text-primary">Pika Image-to-Video – Animate Any Image with Stylized Motion</h1>
          <p className="mt-5 text-lg text-text-secondary">
            With Pika’s image-to-video engine, you can bring still visuals to life. Upload an image, add a short prompt, and let Pika add
            cinematic zooms, motion, or animation styles—fast, silent, and ideal for looping content.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Animate photos or illustrations for looping reels</li>
              <li>Stylized motion from concept art or storyboards</li>
              <li>Create b-roll clips from static product renders</li>
              <li>Add subtle camera movement to thumbnails or hero images</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Duration:</strong> 5 or 8-second animations tuned for looping{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://www.pika.art/docs/image-to-video"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Pika Docs
                </a>
              </div>
              <div>
                <strong>Resolution:</strong> 720p or 1080p output in 1:1, 16:9, or 9:16{' '}
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
                <strong>Audio:</strong> Silent clips—perfect for overlays or post-production sound
              </div>
              <div>
                <strong>Inputs:</strong> Upload an image + optional short text prompt to steer motion
              </div>
              <div>
                <strong>Modes:</strong> Image-to-video with reference image required; no text-only mode
              </div>
              <div>
                <strong>Pricing:</strong> Pay-as-you-go via MaxVideoAI — $0.06/s (no audio)
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              “Zoom slowly into a fantasy castle on a cliff at sunset, birds fly by, clouds drifting, anime art style.”
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">Guide the animation with concise cues:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Describe the motion you want: zoom, pan, drift, rotate</li>
              <li>Add style or tone cues—cartoon, anime, painterly, cinematic</li>
              <li>Reference natural elements for subtle motion: clouds, water, fabric</li>
              <li>Keep prompts short—this engine enhances what’s already in the image</li>
              <li>Supply detailed, high-quality images for the best results</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>🖼️ Use high-res images with clear subjects (16:9 or 2:1 works great)</li>
              <li>🌀 Ask for zooms, pans, or animation on specific elements</li>
              <li>🎨 Pair with style prompts like “cyberpunk”, “oil painting”, or “low poly”</li>
              <li>🔁 Keep clips short (3–5 seconds) for looping or layering</li>
              <li>❌ No sound—ideal for silent b-roll or creative transitions</li>
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
            href="/generate?engine=pika-image-to-video"
            className="inline-flex items-center justify-center rounded-pill bg-accent px-6 py-3 text-base font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-analytics-event="cta_click"
            data-analytics-engine="pika-image-to-video"
            data-analytics-position="bottom"
          >
            🚀 Animate with Pika Image-to-Video
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
            <Link href="/pricing" className="font-semibold text-accent hover-text-accentSoft">
              View pricing
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
