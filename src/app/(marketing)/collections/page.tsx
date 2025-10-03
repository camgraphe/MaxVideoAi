import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collections } from "@/data/wall";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Collections - Curated clip sets by intent",
  description:
    "Intent-based Collections reduce choice overload. Browse Cinematic Quality, Best Value HD, Vertical Ads, Logo Morphs, and more.",
  alternates: {
    canonical: `${siteConfig.url}/collections`,
  },
};

export default function CollectionsPage() {
  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(80,115,255,0.12),_transparent_60%)] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,22,0.92)_0%,rgba(7,11,20,0.94)_45%,rgba(6,9,18,0.96)_100%)]" />
      <div className="flex w-full flex-col gap-10 px-4 pb-12 pt-10 sm:px-6 lg:px-10 xl:px-14">
        <header className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit border-primary/40 text-primary">
            Collections
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Curated sets by intent</h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            Collections keep the Wall focused when you are on a deadline. Start with a hero set, remix the starters, then keep scrolling to the filtered Wall below.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {collections.map((collection) => (
            <Card
              key={collection.slug}
              className="group flex flex-col overflow-hidden border-white/10 bg-white/5 p-6 transition hover:border-primary/40 hover:bg-primary/10"
            >
              <CardHeader className="space-y-2 p-0">
                <CardTitle className="text-2xl font-semibold text-foreground">{collection.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{collection.description}</p>
              </CardHeader>
              <CardContent className="mt-4 flex flex-1 flex-col justify-between gap-4 p-0 text-sm text-muted-foreground">
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">When to use</div>
                  <p>{collection.whenToUse}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{collection.heroClipIds.length} featured starters</span>
                  <Link
                    href={`/collections/${collection.slug}`}
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    View collection
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
