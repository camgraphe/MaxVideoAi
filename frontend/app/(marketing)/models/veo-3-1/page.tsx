import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { resolveDictionary } from '@/lib/i18n/server';

const PAGE_TITLE = 'Veo\u202f3.1 \u2013 Advanced Text\u2011to\u2011Video Engine with Extended Duration & Native Audio';
const PAGE_DESCRIPTION =
  'Veo\u202f3.1 by Google DeepMind on MaxVideoAI: generate longer cinematic videos with native audio, multi\u2011scene prompts, advanced lighting & camera control. Ideal for creators and brands.';
const CANONICAL_URL = 'https://maxvideoai.com/models/veo-3-1';

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
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Veo 3.1',
  operatingSystem: 'Web',
  applicationCategory: 'CreativeTool',
  description:
    'Veo\u202f3.1 by Google DeepMind \u2013 generate extended cinematic videos with native audio, multi\u2011scene prompts and advanced visual controls, available via MaxVideoAI.',
  url: CANONICAL_URL,
  softwareVersion: '3.1',
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

export default function Veo31ModelPage() {
  const { dictionary } = resolveDictionary();

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <Link href="/models" className="text-sm font-semibold text-accent hover:text-accentSoft">
        {'\u2190'} {dictionary.models.hero.title}
      </Link>

      <div className="mt-6 rounded-card border border-hairline bg-white p-8 shadow-card">
        <header className="text-center">
          <h1 className="text-4xl font-semibold text-text-primary">
            Veo\u202f3.1 \u2013 Advanced Text\u2011to\u2011Video Engine with Native Audio & Extended Duration
          </h1>
          <p className="mt-5 text-lg text-text-secondary">
            Veo\u202f3.1 is the latest video\u2011generation engine from Google\u202fDeepMind, now available on MaxVideoAI. With extended duration, full native audio, multi\u2011scene prompt support and cinematic controls, you can turn your ideas into high\u2011fidelity video stories. Whether you\u2019re creating brand campaigns, short films, social loops or concept visuals \u2014 Veo\u202f3.1 unlocks new creative possibilities.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Brand trailers & product launches with narrative scenes</li>
              <li>Social content in vertical (9:16) and 16:9 formats, up to ~60s duration</li>
              <li>Concept visuals, mood\u2011boards & rapid prototyping for filmmakers</li>
              <li>Multi\u2011scene stories: build linked shots with consistent characters & settings</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Max Duration:</strong> Up to ~60 seconds (in preview){' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://www.techradar.com/ai-platforms-assistants/veo-3-1-is-coming-soon-and-googles-clearly-aiming-it-right-at-sora-2-with-longer-video-support?utm_source=chatgpt.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TechRadar
                </a>
              </div>
              <div>
                <strong>Resolution:</strong> 1080p full HD, vertical (9:16) and 16:9 supported
              </div>
              <div>
                <strong>Audio:</strong> Native dialogue, ambient sound and effects{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://techcrunch.com/2025/05/20/googles-veo-3-can-generate-videos-and-soundtracks-to-go-along-with-them/?utm_source=chatgpt.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TechCrunch
                </a>
              </div>
              <div>
                <strong>Multi\u2011prompt support:</strong> Combine multiple prompts or scenes into one video{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://www.techradar.com/ai-platforms-assistants/veo-3-1-is-coming-soon-and-googles-clearly-aiming-it-right-at-sora-2-with-longer-video-support?utm_source=chatgpt.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TechRadar
                </a>
              </div>
              <div>
                <strong>Camera & lighting controls:</strong> Built\u2011in presets for cinematic look{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://www.androidcentral.com/apps-software/ai/google-veo-steps-up-its-creativity-in-3-1-version-update-for-realism?utm_source=chatgpt.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Android Central
                </a>
              </div>
              <div>
                <strong>Access:</strong> Available via API (Gemini or Vertex) and via MaxVideoAI pay-as-you-go
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              \u201cIn a deserted futuristic train station at golden hour, one lone figure in a flowing red coat walks down the platform, camera tracks sideways, slow dolly zoom, cinematic 24mm lens, soft film grain \u2192 ambient synth soundtrack & whispered voice\u2011over: \u2018The journey begins.\u2019\u201d
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">
              Veo\u202f3.1 delivers best results when you give it a structured, layered prompt:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Scene description (location + mood + character)</li>
              <li>Camera/lens/movement (e.g. \u201cdolly zoom\u201d, \u201chandheld 50mm\u201d, \u201cslow crane up\u201d)</li>
              <li>Audio cues (e.g. \u201cvoice\u2011over\u201d, \u201cambient rain\u201d, \u201cheartbeat sound\u201d)</li>
              <li>Style or film aesthetic (e.g. \u201cneo\u2011noir\u201d, \u201c8mm grain\u201d, \u201cWes Anderson palette\u201d)</li>
            </ul>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Start with the story: what happens in the scene?</li>
              <li>Use camera/tone cues to shape the visual flow.</li>
              <li>Specify audio or voice elements explicitly.</li>
              <li>For multi\u2011scene output: list prompts separated by \u201c\u2192\u201d or \u201cthen\u201d.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>\ud83c\udf9c\ufe0f Frame like a filmmaker: visualise each shot before describing it.</li>
              <li>\ud83d\udd0a Always mention audio cues to unlock native sound generation.</li>
              <li>\u23f1\ufe0f Try vertical 9:16 format for social reels \u2014 great with longer duration support.</li>
              <li>\ud83e\uddea Use quick test versions, then refine prompt for high\u2011fidelity output.</li>
              <li>\ud83d\udd17 Link scenes together: \u201cScene\u202f1 \u2192 Scene\u202f2 \u2192 Scene\u202f3\u201d for narrative flow.</li>
            </ul>
          </div>
        </section>

        <div className="my-12">
          <Image
            src="/hero/veo3.jpg"
            alt="Veo 3.1 cinematic AI video example showing a futuristic station scene"
            width={960}
            height={540}
            className="mx-auto rounded-lg shadow-card"
          />
        </div>

        <div className="text-center">
          <Link
            href="/generate?engine=veo-3-1"
            className="inline-flex items-center justify-center rounded-pill bg-accent px-6 py-3 text-base font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-analytics-event="cta-generate-veo-3-1"
          >
            🚀 Generate with\u202fVeo\u202f3.1
          </Link>
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/models" className="font-semibold text-accent hover:text-accentSoft">
              See all engines
            </Link>{' '}
            •{' '}
            <Link href="/workflows" className="font-semibold text-accent hover:text-accentSoft">
              Explore workflows
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
