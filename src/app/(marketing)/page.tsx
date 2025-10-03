import type { Metadata } from "next";
import { WallExperience } from "@/components/wall/wall-experience";
import { clipItems } from "@/data/wall";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { getClipEffectivePrice } from "@/lib/wall";

const homeTitle = "MaxVideoAI Wall - All the AI video engines. One control room.";
const homeDescription =
  "Discovery-first Wall showcasing Veo 3, Kling 2.5, Pika 2.2, Luma, WAN, Hunyuan and more. Filter by tier, aspect, duration, and price with costs visible on every tile.";

const offerPrice = (clip: (typeof clipItems)[number]) => getClipEffectivePrice(clip);

const wallJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "MaxVideoAI Wall",
  description: homeDescription,
  numberOfItems: clipItems.length,
  itemListElement: clipItems.map((clip, index) => ({
    "@type": "VideoObject",
    position: index + 1,
    name: clip.title,
    description: clip.summary,
    thumbnailUrl: clip.media.poster,
    contentUrl: clip.media.video,
    embedUrl: `${siteConfig.url}/clip/${clip.slug}`,
    genre: clip.category,
    duration: `PT${clip.durationSeconds}S`,
    isAccessibleForFree: clip.tier === "Open" || clip.tier === "Budget",
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: offerPrice(clip),
      availability: "https://schema.org/InStock",
    },
  })),
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
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(80,115,255,0.12),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(0,180,216,0.08),_transparent_60%)] pb-20 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,22,0.9)_0%,rgba(7,11,21,0.92)_45%,rgba(6,9,18,0.95)_100%)]" />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(wallJsonLd) }}
      />

      <div className="relative flex w-full flex-col gap-12 px-4 pb-16 pt-10 sm:px-6 lg:px-10 xl:px-14">
        <WallExperience clips={clipItems} />

        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-[rgba(10,13,20,0.85)] p-8 text-sm text-muted-foreground shadow-[0_40px_80px_-40px_rgba(12,18,30,0.65)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              <Badge variant="outline" className="border-primary/40 text-primary">
                Pricing teaser
              </Badge>
              Pricing that tracks your render, not your time.
            </div>
            <a href="/pricing" className="text-xs font-medium text-primary underline underline-offset-4">
              Explore pricing tiers
            </a>
          </div>
          <div className="grid gap-4 text-muted-foreground sm:grid-cols-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Premium</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Veo & Kling with 4K upscale and audio. Show full cost before you hit Remix.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Pro</div>
              <p className="mt-1 text-xs text-muted-foreground">
            Pika, Luma, Ray-2, SeedVR2 - balance speed and clarity with predictable spend.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Starter & Open</div>
              <p className="mt-1 text-xs text-muted-foreground">
                WAN, Hunyuan, open engines for volume drafts. Upsell into Enhance when ready.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
