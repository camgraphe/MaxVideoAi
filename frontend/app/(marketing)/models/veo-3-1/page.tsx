import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { resolveDictionary } from '@/lib/i18n/server';

const PAGE_TITLE = 'Veo\u202f3.1 \u2013 Advanced Text\u2011to\u2011Video & Native Audio Engine';
const PAGE_DESCRIPTION =
  'Generate cinematic 8-second videos with native audio using Veo\u202f3.1 by Google\u202fDeepMind on MaxVideoAI. Reference-to-video guidance, multi-image fidelity, pay-as-you-go.';
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
    'Veo\u202f3.1 by Google\u202fDeepMind \u2013 generate cinematic 8-second videos with native audio and reference-to-video control, available via MaxVideoAI.',
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
            Veo\u202f3.1 \u2013 Advanced Text\u2011to\u2011Video & Native Audio Engine
          </h1>
          <p className="mt-5 text-lg text-text-secondary">
            Veo\u202f3.1 is the latest video\u2011generation engine from Google\u202fDeepMind, routed through MaxVideoAI for premium reference\u2011to\u2011video runs. We focus on **high\u2011fidelity 8\u2011second sequences with native sound design**\u2014voice\u2011over, ambient layers, synced motion. Use up to four reference stills to lock identity and deliver polished concept shots, hero visuals, and product moments without leaving your workspace.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Brand hero shots & product reveals that need cinematic polish</li>
              <li>Social content: vertical (9:16), horizontal (16:9) or square (1:1) short loops</li>
              <li>Concept visuals, mood\u2011boards & film prototypes with coherent subject identity</li>
              <li>Shot extensions: stitch multiple 8\u2011second clips to build longer narratives</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Max duration:</strong> 8 seconds per render (current MaxVideoAI plan limit)
              </div>
              <div>
                <strong>Resolution:</strong> Full HD 1080p in 16:9, 9:16, or 1:1 aspect ratios{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://fliki.ai/blog/google-veo-3-and-imagen-4?utm_source=chatgpt.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fliki
                </a>
              </div>
              <div>
                <strong>Audio:</strong> Native voice\u2011over, ambient sound, synced FX & lip\u2011sync{' '}
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
                <strong>Inputs:</strong> Reference images (1\u20134) + prompt to animate subjects{' '}
                <a
                  className="text-sm font-semibold text-accent hover:text-accentSoft"
                  href="https://deepmind.google/models/veo/?utm_source=chatgpt.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google DeepMind
                </a>
              </div>
              <div>
                <strong>Identity lock:</strong> Multi-image guidance keeps wardrobe, lighting & likeness consistent
              </div>
              <div>
                <strong>Access model:</strong> Pay-as-you-go via MaxVideoAI; audio-on pricing from $0.40/s
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              \u201cA sleek electric car glides through neon city streets at dusk; drone crane shot, slow zoom out as city lights reflect in puddles; ambient synthwave soundtrack + voice-over: \u2018The future is silent power.\u2019 Reference stills: front three-quarter, interior cockpit, rear lights. Vertical 9:16 format.\u201d
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">
              Structure each run for clarity and fidelity:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Define the scene & mood (subject, environment, emotion)</li>
              <li>Add camera / lens / movement cues (e.g. \u201cdrone crane\u201d, \u201c24mm handheld\u201d, \u201cslow dolly\u201d)</li>
              <li>Specify audio elements (voice-over, ambient texture, Foley moments)</li>
              <li>Call out reference usage: \u201cAnimate from stills\u201d, \u201ckeep wardrobe & lighting consistent\u201d</li>
              <li>State duration & output: \u201c8-second loop\u201d, \u201c1080p vertical\u201d, \u201cseamless loop\u201d</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>\ud83c\udf9c\ufe0f Think like a director: pre-visualise the 8-second arc before writing.</li>
              <li>\ud83d\udd0a Sound sells realism: call out music, Foley, or VO to maximise audio synthesis.</li>
              <li>\ud83d\udcf1 For social-first shots, lean on 9:16 prompts and mention \u201caudio loudness: high\u201d for mobile.</li>
              <li>\ud83d\uddbc\ufe0f Use 3\u20134 complementary stills to keep characters, lighting and wardrobe locked.</li>
              <li>\ud83d\udd04 Chain renders: iterate quickly, then stitch multiple clips for longer edits.</li>
            </ul>
          </div>
        </section>

        <div className="my-12">
          <Image
            src="/hero/veo3.jpg"
            alt="Veo 3.1 cinematic AI video example of an electric car in a neon city"
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
