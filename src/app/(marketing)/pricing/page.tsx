import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CostPin } from "@/components/pricing/cost-pin";
import { siteConfig } from "@/config/site";

const tiers = [
  {
    name: "Premium",
    price: "From $3.20 per clip",
    anchor: "Veo 3 and Kling 2.5 Turbo with 4K Enhance included",
    bullets: [
      "Priority access to Veo 3 cinematic and image to video modes",
      "Kling 2.5 Turbo with audio control and seed locking",
      "4K upscale and dual export 16:9 + 9:16 included",
      "Remove watermark on publish-ready clips",
    ],
    highlight: true,
  },
  {
    name: "Pro",
    price: "$0.90 to $1.60 per clip",
    anchor: "Pika 2.2, Luma Dream Machine, Ray-2 Reframe, SeedVR2",
    bullets: [
      "Pika 2.2 text to video and image to video",
      "Luma Dream Machine stylised 6 second runs",
      "Ray-2 subject aware reframe",
      "SeedVR2 upscale up to 4K as an Enhance toggle",
    ],
  },
  {
    name: "Starter",
    price: "$0.35 to $0.70 per clip",
    anchor: "WAN 2.1 / 2.2, Hunyuan Video, Minimax",
    bullets: [
      "Budget engines for volume drafts and logo morphs",
      "Watermark on by default with option to remove via Enhance",
      "Perfect for validating hooks before promoting to Premium",
      "Audio add-on available per clip",
    ],
  },
  {
    name: "Pay as you go",
    price: "Usage metered via Stripe",
    anchor: "No minimums. Share credits across the workspace.",
    bullets: [
      "Budget caps per workspace with confirmation step",
      "Auto top-up or manual checkout in a single click",
      "Audit log of clips, enhance runs, and usage events",
      "Export invoices with video and enhance line items",
    ],
  },
];

const bundles = [
  {
    title: "1080p + 4K Upscale",
    description: "Ship broadcast-ready masters by pairing 1080p base renders with SeedVR2 upscale in one pipeline.",
  },
  {
    title: "Dual export 16:9 + 9:16",
    description: "Run Ray-2 reframe to deliver landscape and vertical outputs simultaneously for omnichannel launches.",
  },
  {
    title: "Morph + Audio",
    description: "Blend Hailuo morph passes with the Add Audio chain to deliver logo reveals that land with impact.",
  },
];

const engineNotes = [
  {
    engine: "Veo 3",
    note: "Per second billing with audio toggle. 4 second minimum, 12 second maximum.",
  },
  {
    engine: "Kling 2.5 Turbo",
    note: "$0.35 for the first 5 seconds, then $0.07 per additional second.",
  },
  {
    engine: "Pika 2.2",
    note: "Linear per second estimate derived from 5 second 720p benchmarks. 1080p applies x1.6 multiplier.",
  },
  {
    engine: "Luma Dream Machine",
    note: "Stylised renders with multipliers for 21:9 and 9 second runs.",
  },
  {
    engine: "WAN and Hunyuan",
    note: "Per clip billing at 720p. Watermark removal requires Enhance toggle.",
  },
];

const faqs = [
  {
    question: "When do we bill the clip?",
    answer:
      "Only after fal.ai confirms success. Stripe usage is raised once per job so failed attempts never appear on your invoice.",
  },
  {
    question: "How accurate is the Cost Pin estimate?",
    answer:
      "It tracks engine, duration, ratio, audio, and resolution in real time. The value you see before Generate is what Stripe records.",
  },
  {
    question: "Can I cap spend per workspace?",
    answer:
      "Yes. Set a credit ceiling and require confirmation when a render would break the cap. Promote to quality respects the same rule.",
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
        text: "MaxVideoAI calculates cost per engine, duration, resolution, and audio toggle in real time. Per second engines bill by seconds, while WAN and utilities bill per clip.",
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
        text: "Yes. Workspace budget caps force a confirmation step whenever a render exceeds the allowance. Promote to quality follows the same guardrail.",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: "Pricing that tracks your render, not your time",
  description: "Premium, Pro, Starter, and Pay as you go tiers with live cost pin estimates. Pay only for successful renders.",
  alternates: {
    canonical: `${siteConfig.url}/pricing`,
  },
  openGraph: {
    title: "Pricing that tracks your render, not your time",
    description: "Premium, Pro, Starter, and Pay as you go tiers with live cost pin estimates. Pay only for successful renders.",
    url: `${siteConfig.url}/pricing`,
    siteName: siteConfig.name,
    images: [siteConfig.ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing that tracks your render, not your time",
    description: "Premium, Pro, Starter, and Pay as you go tiers with live cost pin estimates. Pay only for successful renders.",
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

      <div className="flex w-full flex-col gap-16 px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-10 xl:px-16">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingFaqJsonLd) }}
        />
        <header className="flex flex-col items-start gap-5 text-left">
          <Badge variant="secondary" className="border-white/30 bg-white/10 text-xs uppercase tracking-[0.35em] text-white">
            Usage-based billing
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pricing that tracks your render, not your time</h1>
          <p className="max-w-3xl text-sm text-white/80 sm:text-base">
            Start with Premium for Veo and Kling, or slide down to Pro and Starter when you need value drafts. Every tile shows cost before you click Remix, and Stripe only bills successful renders.
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
            <h2 className="text-2xl font-semibold sm:text-3xl">Tier lineup</h2>
            <p className="text-sm text-white/70 sm:text-base">
              Premium anchors perception. Pro and Starter deliver value. Pay as you go keeps procurement simple.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {tiers.map((tier) => (
              <Card
                key={tier.name}
                className={`flex h-full flex-col border-white/10 bg-white/5 backdrop-blur transition hover:border-primary/40 ${
                  tier.highlight ? "ring-1 ring-primary/50" : ""
                }`}
              >
                <CardHeader className="space-y-2">
                  <Badge variant="outline" className="w-fit border-primary/30 text-primary">
                    {tier.name}
                  </Badge>
                  <CardTitle className="text-xl text-white">{tier.price}</CardTitle>
                  <CardDescription className="text-sm text-white/70">{tier.anchor}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 text-sm text-white/80">
                  <ul className="space-y-2">
                    {tier.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold sm:text-3xl">Bundles and upsells</h2>
            <p className="text-sm text-white/70 sm:text-base">
              Package Enhance utilities to raise margin and keep delivery consistent.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {bundles.map((bundle) => (
              <Card key={bundle.title} className="border-white/10 bg-white/5 p-6 text-sm text-white/80 backdrop-blur">
                <CardTitle className="text-lg text-white">{bundle.title}</CardTitle>
                <p className="mt-2 leading-relaxed">{bundle.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-white">Engine explainers</CardTitle>
              <CardDescription className="text-sm text-white/70">
                Billing quirks surface before you render. Producers adjust prompts with confidence.
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
              <h3 className="text-xl font-semibold text-white">Slider-based estimate</h3>
              <p>
                Adjust engine, duration, ratio, resolution, and audio to preview the bill. The estimator mirrors Supabase job logs and Stripe usage events.
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
                Finance sees the same numbers as creative.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/80">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-base font-semibold text-white">video_seconds_rendered</div>
                <p className="mt-1 leading-relaxed">
                  Logged for per second engines like Veo, Kling, Pika, and WAN 2.2. We push the exact seconds fal.ai reports.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-base font-semibold text-white">video_clips_rendered</div>
                <p className="mt-1 leading-relaxed">
                  Logged for per clip engines (WAN 2.1, Hunyuan, utilities). Each successful job counts as one unit.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl text-white">Frequently asked</CardTitle>
              <CardDescription className="text-sm text-white/70">
                Answers for producers, editors, and finance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/80">
              {faqs.map((faq) => (
                <details key={faq.question} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <summary className="cursor-pointer text-base font-semibold text-white">{faq.question}</summary>
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
