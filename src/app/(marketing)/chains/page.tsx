import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { chains, clipItems } from "@/data/wall";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Chains - Super features for morph, upscale, reframe, audio",
  description:
    "Run Morph, Upscale 4K, Reframe, and Add Audio chains with clear pricing. Each chain has a mini demo, cost calculator, and pushes results to the Wall.",
  alternates: {
    canonical: `${siteConfig.url}/chains`,
  },
};

export default function ChainsPage() {
  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(80,115,255,0.12),_transparent_60%)] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,22,0.92)_0%,rgba(7,11,20,0.94)_45%,rgba(6,9,18,0.96)_100%)]" />
      <div className="flex w-full flex-col gap-10 px-4 pb-12 pt-10 sm:px-6 lg:px-10 xl:px-14">
        <header className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit border-primary/40 text-primary">
            Chains
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Super features built on the same queue</h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            Morph, Upscale 4K, Reframe, and Add Audio run as one-click pipelines. Trigger them from the Wall, Toolkit, or clip pages and push the output straight back to discovery.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {chains.map((chain) => {
            const heroClip = chain.heroClipId
              ? clipItems.find((clip) => clip.id === chain.heroClipId)
              : undefined;
            return (
              <Card key={chain.id} className="flex flex-col overflow-hidden border-white/10 bg-white/5">
                {heroClip ? (
                  <video
                    poster={heroClip.media.poster}
                    className="aspect-video w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    loop
                  >
                    <source src={heroClip.media.video} type="video/webm" />
                    {heroClip.media.fallback ? <source src={heroClip.media.fallback} type="video/mp4" /> : null}
                  </video>
                ) : null}
                <CardHeader className="space-y-2">
                  <CardTitle className="text-2xl font-semibold text-foreground">{chain.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{chain.summary}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4 text-sm text-muted-foreground">
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                      {chain.priceDisplay}
                    </div>
                    <ul className="space-y-2 text-sm">
                      {chain.steps.map((step, index) => (
                        <li key={`${chain.id}-step-${index}`} className="flex gap-2">
                          <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 text-center text-[11px] font-semibold text-primary">
                            {index + 1}
                          </span>
                          <span className="text-foreground/90">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button asChild size="sm" className="rounded-full">
                      <Link href={`/generate?chain=${chain.slug}`}>Run in toolkit</Link>
                    </Button>
                    {heroClip ? (
                      <Link
                        href={`/clip/${heroClip.slug}`}
                        className="text-xs text-primary underline underline-offset-4"
                      >
                        View demo clip
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Demo clip coming soon</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
