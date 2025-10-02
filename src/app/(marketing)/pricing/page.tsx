import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CostPin } from "@/components/pricing/cost-pin";
import { siteConfig } from "@/config/site";

const formats = [
  {
    name: "Quick Draft",
    spec: "5s • 720p • 16:9 / 9:16",
    priceRange: "$0.45–$0.99",
    description: "Budget-friendly passes to test tone, pacing, or hook variations before you promote the winner.",
  },
  {
    name: "Social Vertical",
    spec: "6s • 720p • 9:16",
    priceRange: "$0.55–$1.10",
    description: "Optimised for TikTok, Reels, and Shorts when you need vertical slots without guesswork.",
  },
  {
    name: "Standard",
    spec: "8s • 720p • 16:9",
    priceRange: "$0.56–$2.32",
    description: "The workhorse preset for product explainers and motion cutdowns that go wide.",
  },
  {
    name: "Hero",
    spec: "8s • 1080p • 16:9",
    priceRange: "$0.70–$3.99",
    description: "Flagship quality for ads and hero placements. 9:16 requests fall back to 720p when engines require it.",
  },
];

const engineNotes = [
  {
    engine: "Veo 3 / Veo 3 Fast",
    note: "Per-second billing. Audio on/off changes the rate so you can trim cost when you only need visuals.",
  },
  {
    engine: "Kling 2.5 Turbo",
    note: "$0.35 for the first 5 seconds, then $0.07 each additional second. Ideal for hook testing." ,
  },
  {
    engine: "Pika 2.2",
    note: "Linear per-second estimate derived from 5-second benchmarks—720p versus 1080p is priced separately.",
  },
  {
    engine: "Luma Dream Machine",
    note: "Multipliers apply: 720p ×2, 1080p ×4, and 9-second clips ×2 over the base rate.",
  },
  {
    engine: "WAN 2.1 / 2.2",
    note: "Per-clip billing at 480p/720p. Higher frame counts add a lightweight multiplier only when requested.",
  },
];

const faqs = [
  {
    question: "When do I get charged?",
    answer:
      "Only after the render succeeds. We raise Stripe metered usage once fal.ai confirms completion so failed jobs never hit your invoice.",
  },
  {
    question: "How accurate is the Cost Pin?",
    answer:
      "It watches duration, resolution, ratio, and audio flags in real time. What you see before clicking Generate is what Stripe logs, within standard rounding.",
  },
  {
    question: "Can I cap spend per project?",
    answer:
      "Yes. Set a workspace budget cap so producers must confirm if a render exceeds the allowance. Promote-to-quality respects the same guardrails.",
  },
];

const costPinDemo = {
  engine: "pika-v2-2",
  duration: 6,
  aspectRatio: "9:16",
  resolution: "720p",
  audio: false,
  estimateUsd: 0.72,
  assumptions: ["Based on cached fal.ai pricing", "Excludes optional utilities"],
};

const pricingFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How is pricing calculated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MaxVideoAI calculates cost per engine, duration, resolution and audio toggle in real time. Per-second engines (Veo, Kling, Pika) bill by seconds, while WAN and utilities bill per clip.",
      },
    },
    {
      "@type": "Question",
      name: "Do failed renders cost anything?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Stripe usage is only raised when fal.ai reports a successful completion, so failed renders never appear on your invoice.",
      },
    },
    {
      "@type": "Question",
      name: "Can I enforce a budget cap?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Workspace budget caps force a confirmation step whenever a render exceeds the allowance. Promote-to-quality honours the same guardrail.",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: "Pricing that tracks your render, not your time.",
  description: "Real-time cost by engine, duration, resolution, and audio. Pay only for renders that succeed.",
  alternates: {
    canonical: `${siteConfig.url}/pricing`,
  },
  openGraph: {
    title: "Pricing that tracks your render, not your time.",
    description: "Real-time cost by engine, duration, resolution, and audio. Pay only for renders that succeed.",
    url: `${siteConfig.url}/pricing`,
    siteName: siteConfig.name,
    images: [siteConfig.ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing that tracks your render, not your time.",
    description: "Real-time cost by engine, duration, resolution, and audio. Pay only for renders that succeed.",
    images: [siteConfig.ogImage],
  },
};

export default function PricingPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(134,91,255,0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,10,20,0.92)_0%,rgba(7,10,20,0.98)_60%,rgba(7,10,20,1)_100%)]" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 text-white sm:px-6 sm:py-20">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingFaqJsonLd) }}
        />
        <header className="flex flex-col items-start gap-5 text-left">
          <Badge variant="secondary" className="border-white/30 bg-white/10 text-xs uppercase tracking-[0.35em] text-white">
            Usage-based billing
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pricing that tracks your render, not your time.</h1>
          <p className="max-w-2xl text-sm text-white/80 sm:text-base">
            Real-time cost by engine, duration, resolution, and audio. No minimums or hidden commitments—pay only for what you render.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
              <Link href="/generate">Launch a render</Link>
            </Button>
          </div>
        </header>

        <section className="space-y-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold sm:text-3xl">Four preset formats</h2>
            <p className="text-sm text-white/70 sm:text-base">
              Choose a bundle that matches your deliverable. Each card displays the live cost range across supported engines.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {formats.map((format) => (
              <Card key={format.name} className="border-white/10 bg-white/5 backdrop-blur transition hover:border-primary/40">
                <CardHeader>
                  <CardTitle className="text-xl text-white">{format.name}</CardTitle>
                  <CardDescription className="text-sm font-medium text-primary">{format.spec}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-white/80">
                  <div className="text-base font-semibold text-white">From {format.priceRange}</div>
                  <p>{format.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-white">Engine explainers</CardTitle>
              <CardDescription className="text-sm text-white/70">
                Every engine has its own billing quirks. We surface them so you can price accurately before you hit Generate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/80">
              {engineNotes.map((entry) => (
                <div key={entry.engine} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-base font-semibold text-white">{entry.engine}</div>
                  <p className="mt-1 leading-relaxed">{entry.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between gap-4 border-white/10 bg-white/5 p-6 text-sm text-white/80 backdrop-blur">
            <div className="space-y-3">
              <Badge variant="outline" className="border-primary/40 text-primary">
                Live Cost Pin
              </Badge>
              <h3 className="text-xl font-semibold text-white">Slider-based estimates</h3>
              <p>
                Adjust engine, duration, ratio, resolution, and audio to preview the bill before launch. The estimator mirrors the values Supabase records and Stripe bills.
              </p>
            </div>
            <CostPin
              input={{
                engine: "pika-v2-2",
                durationSec: costPinDemo.duration,
                resolution: costPinDemo.resolution,
                aspectRatio: costPinDemo.aspectRatio,
                audioEnabled: costPinDemo.audio,
                quantity: 1,
              }}
              className="border-white/10 bg-black/40 text-white"
              title="Demo"
              subtitle="Ready to adjust in the dashboard"
            />
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-white">Usage meters</CardTitle>
              <CardDescription className="text-sm text-white/70">
                Two Stripe meters keep finance in sync with production.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/80">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-base font-semibold text-white">video_seconds_rendered</div>
                <p className="mt-1 leading-relaxed">
                  Logged for per-second engines (Veo, Kling, Pika, WAN 2.2, Minimax). We push the exact seconds fal.ai reports once the job is complete.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-base font-semibold text-white">video_clips_rendered</div>
                <p className="mt-1 leading-relaxed">
                  Logged for per-clip engines (WAN 2.1, Hunyuan, utilities). Each successful job adds 1 unit so invoices stay predictable.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-white">Frequently asked</CardTitle>
              <CardDescription className="text-sm text-white/70">
                Answers producers, editors, and finance ask before going live.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/80">
              {faqs.map((faq) => (
                <details key={faq.question} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <summary className="cursor-pointer text-base font-semibold text-white">
                    {faq.question}
                  </summary>
                  <p className="mt-2 leading-relaxed">{faq.answer}</p>
                </details>
              ))}
            </CardContent>
          </Card>
        </section>

        <footer className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-white/80 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <h3 className="text-xl font-semibold text-white">Ready to meter your renders?</h3>
              <p>
                Connect Supabase, fal.ai, and Stripe once. MaxVideoAI syncs cost pins, job logs, and usage events automatically so your invoice mirrors reality.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/login">Start free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                <Link href="/docs">Read the integration guide</Link>
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
