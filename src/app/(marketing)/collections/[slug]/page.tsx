import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WallTile } from "@/components/wall/wall-tile";
import { clipItems, collections } from "@/data/wall";
import { siteConfig } from "@/config/site";
import { filterClipsForCollection } from "@/lib/wall";

interface CollectionPageProps {
  params: { slug: string };
}

export function generateMetadata({ params }: CollectionPageProps): Metadata {
  const collection = collections.find((entry) => entry.slug === params.slug);
  if (!collection) {
    return {
      title: "Collection not found",
    };
  }

  return {
    title: `${collection.title} - MaxVideoAI Collections`,
    description: collection.description,
    alternates: {
      canonical: `${siteConfig.url}/collections/${collection.slug}`,
    },
  };
}

export default function CollectionDetailPage({ params }: CollectionPageProps) {
  const collection = collections.find((entry) => entry.slug === params.slug);
  if (!collection) {
    notFound();
  }

  const starters = collection.heroClipIds
    .map((id) => clipItems.find((clip) => clip.id === id))
    .filter((clip): clip is NonNullable<typeof clip> => Boolean(clip));

  const filteredWall = filterClipsForCollection(collection, clipItems);

  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(80,115,255,0.12),_transparent_60%)] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,22,0.92)_0%,rgba(7,11,20,0.94)_45%,rgba(6,9,18,0.96)_100%)]" />
      <div className="flex w-full flex-col gap-10 px-4 pb-12 pt-10 sm:px-6 lg:px-10 xl:px-14">
        <header className="flex flex-col gap-4">
          <Badge variant="outline" className="w-fit border-primary/40 text-primary">
            Collection
          </Badge>
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{collection.title}</h1>
            <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{collection.description}</p>
            <p className="text-xs text-muted-foreground">{collection.whenToUse}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {collection.filter.tiers ? (
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs">Tiers: {collection.filter.tiers.join(", ")}</span>
            ) : null}
            {collection.filter.aspects ? (
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs">Aspects: {collection.filter.aspects.join(", ")}</span>
            ) : null}
            {collection.filter.tags ? (
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs">Tags: {collection.filter.tags.join(", ")}</span>
            ) : null}
            {typeof collection.filter.priceCeilingUsd === "number" ? (
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs">
                Price ceiling ${collection.filter.priceCeilingUsd.toFixed(2)}
              </span>
            ) : null}
          </div>
        </header>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Starters</h2>
            <Button asChild size="sm" variant="secondary" className="rounded-full border border-white/10">
              <Link href={`/generate?collection=${collection.slug}`}>Prefill in toolkit</Link>
            </Button>
          </div>
          {starters.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {starters.map((clip, index) => (
                <WallTile key={clip.id} clip={clip} index={index} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Starter clips will appear here once the curator pins them.</p>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Filtered Wall</h2>
            <Link href="/" className="text-sm text-primary underline underline-offset-4">
              View full wall
            </Link>
          </div>
          {filteredWall.length ? (
            <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
              {filteredWall.map((clip, index) => (
                <div key={clip.id} className="mb-4 break-inside-avoid">
                  <WallTile clip={clip} index={index} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No clips match this collection yet. Submit one to publish.</p>
          )}
        </section>
      </div>
    </div>
  );
}
