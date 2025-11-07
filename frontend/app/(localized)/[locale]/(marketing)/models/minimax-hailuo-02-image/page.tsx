import type { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { resolveDictionary } from '@/lib/i18n/server';
import { getExampleDemoForEngine } from '@/server/engine-demos';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';

const PAGE_TITLE = 'MiniMax Hailuo 02 (Image-to-Video) – Animate Any Visual in Seconds';
const PAGE_DESCRIPTION =
  'Transform static images into animated motion with MiniMax Hailuo 02. Add subtle movement, zooms, or stylization—silent, fast, and perfect for creative loops.';
const CANONICAL_URL = 'https://maxvideoai.com/models/minimax-hailuo-02-image';
const OG_IMAGE = '/og/minimax-hailuo-02-image-og.jpg';

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
        alt: 'MiniMax Hailuo 02 animating a sci-fi image with camera motion via MaxVideoAI.',
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

export default async function MiniMaxImageToVideoPage() {
  const { dictionary } = await resolveDictionary();
  const example = await getExampleDemoForEngine('minimax-hailuo-02-image');
  const demoVideoUrl = example?.videoUrl ?? 'https://v3.fal.media/files/b/kangaroo/minimax_i2v.mp4';
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
          <h1 className="text-4xl font-semibold text-text-primary">MiniMax Hailuo 02 – Image-to-Video Motion Engine</h1>
          <p className="mt-5 text-lg text-text-secondary">
            MiniMax Hailuo 02 lets you animate still images with text prompts. Perfect for motion design, quick loops, or visual effects, it brings static
            scenes to life—silently, efficiently, and in seconds.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Turn concept art into animated moodboards</li>
              <li>Add zoom or pan motion to still renders or scenes</li>
              <li>Create short loopable clips from product images</li>
              <li>Stylize and animate editorial visuals or storyboards</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Duration:</strong> 6 or 10-second animations for rapid workflows{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://fal.ai/models/fal-ai/minimax-hailuo-02-image"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  fal.ai
                </a>
              </div>
              <div>
                <strong>Resolution:</strong> 720p or 1080p, supports portrait and landscape{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://www.minimax.chat/developer/docs/video"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  MiniMax Docs
                </a>
              </div>
              <div>
                <strong>Audio:</strong> No audio—designed for silent visual effects
              </div>
              <div>
                <strong>Inputs:</strong> Upload an image + optional short prompt to guide motion
              </div>
              <div>
                <strong>Modes:</strong> Image-to-video with reference frame required; no text-only mode
              </div>
              <div>
                <strong>Pricing:</strong> Pay-as-you-go via MaxVideoAI — $0.05/s (no audio)
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              “Zoom slowly across a sci-fi spaceship control room, blinking lights and flickering screens, low-poly animation style.”
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">Guide the motion with concise, visual cues:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Describe the desired camera move: zoom, pan, drift, shake</li>
              <li>Reference the visual style—cartoon, low-poly, cyberpunk, painterly</li>
              <li>Mention atmospheric details: lights, reflections, fog, particles</li>
              <li>Start from a high-quality image for the best fidelity</li>
              <li>Keep prompts short—this engine favors lightweight animation</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>🚀 Add motion to concept art and digital renders quickly</li>
              <li>🔁 Works best for short 2–4 second loops</li>
              <li>🖼️ Upload clean, high-resolution images with clear subjects</li>
              <li>📸 Ask for zooms, pans, or subtle environmental motion</li>
              <li>🎨 Apply visual styles like “sketch”, “film grain”, or “anime”</li>
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
            href="/generate?engine=minimax-hailuo-02-image"
            className="inline-flex items-center justify-center rounded-pill bg-accent px-6 py-3 text-base font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-analytics-event="cta_click"
            data-analytics-engine="minimax-hailuo-02-image"
            data-analytics-position="bottom"
          >
            🚀 Animate with MiniMax Image-to-Video
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
        <h2 className="text-lg font-semibold text-text-primary">MiniMax Image-to-Video FAQ</h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="font-semibold text-text-primary">What image prep yields the best results?</dt>
            <dd className="mt-1">
              Start with 1080 × 1080 or 1080 × 1920 PNGs and keep the subject isolated on a clean background. Avoid
              heavy gradients—MiniMax interprets them as movement trails.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">Can I match motion to a product storyboard?</dt>
            <dd className="mt-1">
              Yes—describe the beats (“rotate product 180°, add glint, end on CTA”) and specify timing in seconds. The
              engine follows those cues while keeping costs low.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-primary">How do I keep branding consistent?</dt>
            <dd className="mt-1">
              Upload brand fonts or logos via the workspace overlays tab, then reuse the same preset across MiniMax,
              Pika, and Veo runs to maintain a uniform frame.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
