import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clipItems } from "@/data/wall";
import { siteConfig } from "@/config/site";
import { getClipEffectivePrice } from "@/lib/wall";

interface ClipPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: ClipPageProps): Promise<Metadata> {
  const clip = clipItems.find((item) => item.slug === params.slug);
  if (!clip) {
    return {
      title: "Clip not found",
    };
  }

  const effectivePrice = getClipEffectivePrice(clip).toFixed(2);
  const title = `${clip.engineVersion} ${clip.title} - $${effectivePrice} (${clip.durationSeconds}s, ${clip.resolution})`;
  const description = `${clip.summary} - ${clip.aspect} - ${clip.cost.display}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteConfig.url}/clip/${clip.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/clip/${clip.slug}`,
      siteName: siteConfig.name,
      images: [clip.media.poster],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [clip.media.poster],
    },
  };
}

export default function ClipPage({ params }: ClipPageProps) {
  const clip = clipItems.find((item) => item.slug === params.slug);

  if (!clip) {
    notFound();
  }

  const similarClips = clipItems
    .filter((item) => item.engine === clip.engine && item.id !== clip.id)
    .slice(0, 3);

  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: clip.title,
    description: clip.summary,
    thumbnailUrl: clip.media.poster,
    contentUrl: clip.media.video,
    embedUrl: `${siteConfig.url}/clip/${clip.slug}`,
    duration: `PT${clip.durationSeconds}S`,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: getClipEffectivePrice(clip).toFixed(2),
    },
  };

  const canDownload = !clip.usage.watermark;

  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(80,115,255,0.12),_transparent_60%)] pb-16">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,22,0.92)_0%,rgba(7,11,20,0.94)_45%,rgba(6,9,18,0.96)_100%)]" />
      <div className="flex w-full flex-col gap-10 px-4 pb-12 pt-10 sm:px-6 lg:px-10 xl:px-16">
        <header className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit border-primary/40 text-primary">
            Clip recipe
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{clip.title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{clip.summary}</p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_40px_80px_-40px_rgba(12,18,30,0.65)]">
              <video
                controls
                poster={clip.media.poster}
                className="aspect-video w-full object-cover"
                preload="metadata"
                muted={!clip.hasAudio}
              >
                <source src={clip.media.video} type="video/webm" />
                {clip.media.fallback ? <source src={clip.media.fallback} type="video/mp4" /> : null}
              </video>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/60 px-4 py-3 text-xs text-muted-foreground">
                <span>
                  {clip.engineVersion} - {clip.durationSeconds}s - {clip.aspect} - {clip.resolution} - {clip.hasAudio ? "Audio on" : "Audio off"}
                </span>
                {canDownload ? (
                  <Button asChild size="sm" className="rounded-full bg-primary px-4 py-1 text-xs font-semibold">
                    <a href={clip.media.video} download>
                      Download
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            <Card className="border-white/10 bg-white/5 backdrop-blur">
              <CardHeader className="gap-2">
                <CardTitle className="text-lg">Parameters</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Prompt and toggles used during the original generation.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <details className="rounded-2xl border border-white/10 bg-black/30 p-4 text-muted-foreground">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">Prompt</summary>
                  <p className="mt-3 leading-relaxed text-foreground/90">{clip.parameters.prompt}</p>
                  {clip.parameters.negativePrompt ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Negative prompt: {clip.parameters.negativePrompt}
                    </p>
                  ) : null}
                </details>
                <div className="grid gap-3 sm:grid-cols-2">
                  {clip.parameters.extras.map((entry) => (
                    <div
                      key={`${clip.id}-${entry.label}-${entry.value}`}
                      className="rounded-2xl border border-white/10 bg-black/30 p-3"
                    >
                      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{entry.label}</div>
                      <div className="text-sm font-medium text-foreground">{entry.value}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Enhance options</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {clip.enhanceOptions.map((option) => (
                  <div key={option.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{option.label}</span>
                      <span className="text-xs text-primary">{option.priceDisplay}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{option.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <Card className="border-white/10 bg-white/5 backdrop-blur">
              <CardHeader className="gap-2">
                <CardTitle className="text-lg">Engine and licensing</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Generated on {clip.engineVersion}. Usage rights: {clip.usage.rights}.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                    Tier: {clip.tier}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-white/10 text-xs">
                    {clip.hasAudio ? "Audio ready" : "Silent"}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Cost at generation</div>
                  <div className="text-lg font-semibold text-foreground">{clip.cost.display}</div>
                  <p className="text-xs text-muted-foreground">
                    Effective cost: ${getClipEffectivePrice(clip).toFixed(2)} (duration {clip.durationSeconds}s)
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button asChild className="w-full rounded-full">
                    <Link href={`/generate?clip=${clip.slug}`}>Remix this clip</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full rounded-full border-primary/40 text-primary">
                    <Link href={`/chains?focus=${clip.slug}`}>Enhance</Link>
                  </Button>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Usage rights: {clip.usage.rights}</p>
                  <Link href={clip.usage.licenseUrl} className="text-primary underline underline-offset-4">
                    View licenses and usage policy
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5 backdrop-blur">
              <CardHeader className="gap-2">
                <CardTitle className="text-lg">Share</CardTitle>
                <p className="text-sm text-muted-foreground">Copy the link or showcase the clip on socials.</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs"
                >
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this clip: ${siteConfig.url}/clip/${clip.slug}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Share to X / Twitter
                  </a>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start rounded-full border border-white/10 bg-black/10 px-4 py-2 text-xs"
                >
                  <a
                    href={`mailto:?subject=${encodeURIComponent(`Clip: ${clip.title}`)}&body=${encodeURIComponent(
                      `Take a look at ${siteConfig.url}/clip/${clip.slug}`,
                    )}`}
                  >
                    Email to teammate
                  </a>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Similar clips</h2>
            <Link href="/" className="text-sm text-primary underline underline-offset-4">
              Back to Wall
            </Link>
          </div>
          {similarClips.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {similarClips.map((item) => (
                <Card key={item.id} className="overflow-hidden border-white/10 bg-white/5 text-sm">
                  <Link href={`/clip/${item.slug}`} className="block">
                    <video
                      poster={item.media.poster}
                      className="aspect-video w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    >
                      <source src={item.media.video} type="video/webm" />
                      {item.media.fallback ? <source src={item.media.fallback} type="video/mp4" /> : null}
                    </video>
                    <CardContent className="space-y-2 p-4">
                      <div className="text-sm font-semibold text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.engineVersion} - {item.durationSeconds}s - {item.cost.display}
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sibling clips yet. Remix to create the next one.</p>
          )}
        </section>
      </div>
    </div>
  );
}
