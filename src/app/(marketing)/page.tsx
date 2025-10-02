import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, GitCompare, Globe2, Layers, MonitorPlay, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeroVideoCard } from "@/components/marketing/hero-video";
import { siteConfig } from "@/config/site";

const howItWorks = [
  {
    title: "Draft smart",
    description: "Run quick drafts on budget engines like Kling, Pika, or WAN before you commit.",
    icon: Zap,
  },
  {
    title: "Compare side-by-side",
    description: "Launch the same prompt across engines and review synced thumbnails instantly.",
    icon: GitCompare,
  },
  {
    title: "Promote to quality",
    description: "One click to Veo 3 (or Veo 3 Fast) while preserving seed, ratio, and key settings.",
    icon: Layers,
  },
];

const modelSwitchboard = [
  {
    name: "Veo 3",
    blurb:
      "Cinematic flagship with optional audio, 4/6/8s durations, and 720p/1080p exports. Supports 16:9, 9:16, and 1:1.",
  },
  {
    name: "Kling 2.5 Turbo Pro",
    blurb: "High-speed image-to-video with fluid motion—perfect for testing hooks and social loops.",
  },
  {
    name: "Pika 2.2",
    blurb: "Flexible text-to-video and image-to-video with wide aspect support at 720p or 1080p.",
  },
  {
    name: "Luma Dream Machine",
    blurb: "Stylised renders in 5s or 9s with multipliers for 720p/1080p delivery.",
  },
  {
    name: "WAN / Hunyuan / Minimax",
    blurb: "Open and budget tracks for volume drafts, still available inside the same control room.",
  },
];

const formatBundles = [
  {
    title: "Quick Draft",
    details: "5s • 720p • 16:9 / 9:16",
    description: "Ideate fast, compare tone and pacing, then promote winners to Veo.",
  },
  {
    title: "Social Vertical",
    details: "6s • 720p • 9:16",
    description: "Optimised for vertical hooks and ads. Keep durations tight and budgets predictable.",
  },
  {
    title: "Standard",
    details: "8s • 720p • 16:9",
    description: "Your dependable mid-weight format for product explainers and promos.",
  },
  {
    title: "Hero",
    details: "8s • 1080p • 16:9",
    description: "Flagship delivery. 9:16 falls back to 720p when the engine requires it.",
  },
];

const utilities = [
  {
    name: "Reframe (Ray-2)",
    description: "Preserve the subject while switching between 16:9 and 9:16 without manual keyframes.",
  },
  {
    name: "Upscale (SeedVR2 / Topaz)",
    description: "Temporal-consistent upscale to 4K for final delivery.",
  },
];

const homeTitle = "AI Video Generator Switchboard — Compare Veo 3, Kling 2.5, Pika 2.2";
const homeDescription =
  "Generate AI videos across Veo 3, Kling 2.5, Pika 2.2, Luma and more. Live pricing, side-by-side compares, and pay-per-render checkout on fal.ai.";

const landingJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  description: homeDescription,
  url: siteConfig.url,
  applicationCategory: "VideoEditingSoftware",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Usage-based billing, pay per render.",
  },
};

const landingFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do you charge failed renders?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No—billing triggers only on successful generations. Prices are fetched from fal.ai in real time.",
      },
    },
    {
      "@type": "Question",
      name: "Can I disable audio to save credits?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. On supported engines like Veo 3, turning audio off reduces usage.",
      },
    },
    {
      "@type": "Question",
      name: "Do you support 1080p vertical?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Some engines support 9:16 at 1080p. When not available, we default to 720p for portrait.",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: homeTitle,
  description: homeDescription,
  alternates: {
    canonical: siteConfig.url,
  },
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [siteConfig.ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: homeDescription,
    images: [siteConfig.ogImage],
  },
};

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingFaqJsonLd) }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(134,91,255,0.16),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(104,211,255,0.14),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,249,255,0.98)_0%,rgba(230,236,255,0.94)_45%,rgba(230,236,255,0.9)_70%,rgba(250,250,255,1)_100%)] dark:bg-[linear-gradient(180deg,rgba(12,16,30,0.9)_0%,rgba(9,13,26,0.94)_45%,rgba(7,11,22,0.98)_80%,rgba(6,9,20,1)_100%)]" />
      </div>

      <section className="relative flex w-full flex-col justify-center px-0 py-10 sm:py-14 md:py-20">
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="flex flex-col gap-6">
            <Badge variant="secondary" className="w-fit gap-2 text-xs uppercase tracking-[0.35em]">
              <Sparkles className="h-3 w-3" /> One control room for AI video
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Generate stellar AI videos. Compare engines. Pay only for what you render.
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              One control room for Veo 3, Kling 2.5, Pika 2.2, Luma and more—powered by fal.ai. Lock quality, cap budget, ship faster.
            </p>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <Button asChild size="lg" className="shadow-[0_24px_48px_-22px_rgba(134,91,255,0.65)]">
                <Link href="/login">
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="text-muted-foreground hover:text-foreground">
                <Link href="/pricing" className="flex items-center gap-2">
                  See live pricing
                  <Globe2 className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/40 p-4 text-sm text-muted-foreground backdrop-blur dark:border-white/10 dark:bg-white/5">
              “Users don’t need another engine catalogue. They need a switchboard: rapid drafts, side-by-side comparisons, and precise costs before they render.”
            </div>
          </div>

          <HeroVideoCard />
        </div>
      </section>

      <section className="border-y border-black/10 bg-white/70 py-16 backdrop-blur-sm dark:border-border/40 dark:bg-[#0e1427] sm:py-20">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Draft fast, promote to quality.</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {howItWorks.map((step) => (
              <Card key={step.title} className="border-black/10 bg-white/90 shadow-sm dark:border-white/10 dark:bg-black/40">
                <CardHeader className="flex items-center gap-3">
                  <span className="rounded-full bg-primary/10 p-2 text-primary">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{step.description}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-transparent py-16 sm:py-20 dark:bg-[#090f1f]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6">
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <Badge variant="outline" className="mx-auto w-fit border-primary/40 text-primary sm:mx-0">
              Curated engines
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">One control room for every video model.</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Pick the engine that fits the task—from cinematic Veo to high-volume WAN—without leaving the dashboard.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modelSwitchboard.map((model) => (
              <Card key={model.name} className="border border-black/10 bg-white/85 shadow-sm transition hover:-translate-y-1 dark:border-white/10 dark:bg-black/30">
                <CardHeader>
                  <CardTitle className="text-lg">{model.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{model.blurb}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white/75 py-16 backdrop-blur-sm dark:border-border/40 dark:bg-[#10172d] sm:py-20">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 sm:px-6">
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <Badge variant="secondary" className="mx-auto w-fit gap-2 text-xs uppercase tracking-[0.3em] sm:mx-0">
              <MonitorPlay className="h-4 w-4" /> Cost Pin
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Budget you can see.</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Inline cost estimation updates as you change duration, resolution, aspect ratio, or audio. Producers know the bill before they click Generate.
            </p>
          </div>
          <Card className="mx-auto w-full max-w-3xl border-black/10 bg-white/95 p-6 text-center shadow-lg dark:border-white/10 dark:bg-black/40">
            <CardTitle className="text-lg font-semibold text-foreground">Live Cost Pin</CardTitle>
            <CardDescription className="mt-2 text-sm text-muted-foreground">
              Example: Pika 2.2 · 6s · 9:16 · 720p → <span className="font-semibold text-primary">$0.72 estimated</span>. Toggle audio or switch to Veo 3 and the total refreshes instantly.
            </CardDescription>
          </Card>
        </div>
      </section>

      <section className="bg-transparent py-16 sm:py-20 dark:bg-[#090f1f]">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6">
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Built on fal.ai.</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Every format runs through fal.ai queues with live pricing, so producers see engine costs before launch and finance keeps cadence with usage.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {formatBundles.map((bundle) => (
              <Card key={bundle.title} className="border border-black/10 bg-white/85 shadow-sm dark:border-white/10 dark:bg-black/30">
                <CardHeader>
                  <CardTitle className="text-lg">{bundle.title}</CardTitle>
                  <CardDescription className="text-sm font-medium text-primary">{bundle.details}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{bundle.description}</CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/85 p-6 backdrop-blur dark:border-white/10 dark:bg-black/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Utilities that close the loop</h3>
                <p className="text-sm text-muted-foreground">
                  After you pick the winning clip, upscale or reframe in the same pipeline—no round-trips to other tools.
                </p>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground sm:w-1/2">
                {utilities.map((utility) => (
                  <div key={utility.name} className="rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="font-medium text-foreground">{utility.name}</div>
                    <div>{utility.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-black/10 bg-white/85 py-14 text-sm text-muted-foreground backdrop-blur dark:border-white/10 dark:bg-black/30">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 sm:px-6">
          <p>
            MaxVideoAI is the engine-agnostic AI video switchboard for creators and teams. Generate text-to-video and image-to-video clips with Veo 3, Kling 2.5, Pika 2.2, Luma, WAN, Hunyuan and more—all in one place. Compare models, optimise costs live, and promote your best drafts to publish-ready quality.
          </p>
          <p>
            Built on fal.ai APIs with a metered Stripe checkout, MaxVideoAI lets you pay per render, not per month. Upscale and reframe in one click. Ship vertical (9:16) and horizontal (16:9) simultaneously with budget guardrails.
          </p>
        </div>
      </section>
    </div>
  );
}
