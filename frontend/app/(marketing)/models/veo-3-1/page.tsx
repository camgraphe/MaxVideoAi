import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { resolveDictionary } from '@/lib/i18n/server';

const PAGE_TITLE = 'Veo 3.1 – Advanced Text-to-Video & Native Audio Engine';
const PAGE_DESCRIPTION =
  'Generate cinematic 8-second videos with native audio using Veo 3.1 by Google DeepMind on MaxVideoAI. Reference-to-video guidance, multi-image fidelity, pay-as-you-go pricing.';
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
    'Veo 3.1 by Google DeepMind – generate cinematic 8-second videos with native audio and reference-to-video control, available via MaxVideoAI.',
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
        {'←'} {dictionary.models.hero.title}
      </Link>

      <div className="mt-6 rounded-card border border-hairline bg-white p-8 shadow-card">
        <header className="text-center">
          <h1 className="text-4xl font-semibold text-text-primary">Veo 3.1 – Advanced Text-to-Video & Native Audio Engine</h1>
          <p className="mt-5 text-lg text-text-secondary">
            Veo 3.1 is the latest video-generation engine from Google DeepMind, routed through MaxVideoAI for premium
            reference-to-video runs. We focus on high-fidelity 8-second sequences with native sound design—voice-over, ambient
            layers, synced motion. Use up to four reference stills to lock identity and deliver polished concept shots, hero visuals,
            and product moments without leaving your workspace.
          </p>
        </header>

        <section className="mt-12 space-y-6 text-left">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Best Use Cases</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Brand hero shots & product reveals that need cinematic polish</li>
              <li>Social content: vertical (9:16), horizontal (16:9) or square (1:1) short loops</li>
              <li>Concept visuals, mood-boards & film prototypes with coherent subject identity</li>
              <li>Shot extensions: stitch multiple 8-second clips to build longer narratives</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Technical Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 text-base text-text-secondary md:grid-cols-2">
              <div>
                <strong>Duration:</strong> 8-second renders (stack clips or loop for longer edits)
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
                <strong>Audio:</strong> Native voice-over, ambient sound, synced FX & lip-sync{' '}
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
                <strong>Inputs:</strong> Reference images (1–4) + prompt to animate subjects{' '}
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
                <strong>Pricing:</strong> Pay-as-you-go via MaxVideoAI — audio-on renders from $0.52/s (~$4.16 per 8-second clip)
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Prompt Structure</h2>
            <blockquote className="mt-4 rounded-card bg-accentSoft/10 p-4 text-sm text-text-secondary shadow-inner">
              “A sleek electric car glides through neon city streets at dusk; drone crane shot, slow zoom out as city lights reflect
              in puddles; ambient synthwave soundtrack + voice-over: ‘The future is silent power.’ Reference stills: front
              three-quarter, interior cockpit, rear lights. Vertical 9:16 format.”
            </blockquote>
            <p className="mt-4 text-base text-text-secondary">
              Structure each run for clarity and fidelity:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>Define the scene & mood (subject, environment, emotion)</li>
              <li>Add camera / lens / movement cues (e.g. “drone crane”, “24mm handheld”, “slow dolly”)</li>
              <li>Specify audio elements (voice-over, ambient texture, Foley moments)</li>
              <li>Call out reference usage: “Animate from stills”, “keep wardrobe & lighting consistent”</li>
              <li>State duration & output: “8-second loop”, “1080p vertical”, “seamless loop”</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Tips & Tricks</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-text-secondary">
              <li>🎬 Think like a director: pre-visualise the 8-second arc before writing.</li>
              <li>🔊 Sound sells realism: call out music, Foley, or VO to maximise audio synthesis.</li>
              <li>📱 For social-first shots, lean on 9:16 prompts and mention “audio loudness: high” for mobile.</li>
              <li>🖼️ Use 3–4 complementary stills to keep characters, lighting and wardrobe locked.</li>
              <li>🔄 Chain renders: iterate quickly, then stitch multiple clips for longer edits.</li>
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
            🚀 Generate with Veo 3.1
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
