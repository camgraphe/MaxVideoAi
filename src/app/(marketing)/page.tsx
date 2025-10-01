import Link from "next/link";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { HeroVideoCard } from "@/components/marketing/hero-video";

const highlightCards = [
  {
    title: "Preset vault",
    description:
      "Scene packs engineered with directors for hooks, cinematic reveals, and product hero shots. Swap engines without rewriting prompts.",
    image:
      "https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1200",
  },
  {
    title: "Realtime budget",
    description:
      "Pinned cost badge with granular breakdown so producers can greenlight renders with confidence.",
    image:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200",
  },
  {
    title: "Studio workflows",
    description:
      "History, duplication, promote-to-quality, and brand kits. Built to mirror the control room you already trust.",
    image:
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=1200",
  },
];

const microStats = [
  { label: "Average render", value: "32 s" },
  { label: "Jobs completed", value: "98%" },
  { label: "Teams onboard", value: "120+" },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(134,91,255,0.16),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(104,211,255,0.14),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,249,255,0.98)_0%,rgba(230,236,255,0.94)_45%,rgba(230,236,255,0.9)_70%,rgba(250,250,255,1)_100%)] dark:bg-[linear-gradient(180deg,rgba(12,16,30,0.9)_0%,rgba(9,13,26,0.94)_45%,rgba(7,11,22,0.98)_80%,rgba(6,9,20,1)_100%)]" />
      </div>

      <section className="relative flex w-full flex-col justify-center px-0 py-6 sm:py-10 md:py-12">
        {/* Content container */}
        <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="flex flex-col gap-6">
            <Badge variant="secondary" className="w-fit gap-2 text-xs uppercase tracking-[0.35em]">
              <Sparkles className="h-3 w-3" /> Private beta access
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              The <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">cinematic workspace</span> for short-form storytelling.
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Orchestrate Google Veo 3 and FAL.ai inside a single cinematic hub. Spin up draft cuts, lock quality masters, and share brand-ready clips in minutes.
            </p>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <Button asChild size="lg" className="shadow-[0_24px_48px_-22px_rgba(134,91,255,0.65)]">
                <Link href="/generate">
                  Launch a render
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="text-muted-foreground hover:text-foreground">
                <Link href="/pricing" className="flex items-center gap-2">
                  See pricing
                  <Zap className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid w-full grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/5/10 p-4 backdrop-blur sm:grid-cols-2 md:grid-cols-3">
              {microStats.map((stat) => (
                <div key={stat.label} className="min-w-[120px]">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <HeroVideoCard />
        </div>
      </section>

      <section className="border-y border-black/10 bg-white/70 py-16 backdrop-blur-sm dark:border-border/40 dark:bg-[#0e1427] sm:py-20">
        <div className="mx-auto hidden max-w-6xl gap-8 px-4 sm:px-6 md:grid md:grid-cols-3">
          {highlightCards.map((card) => (
            <MarketingHighlight key={card.title} card={card} />
          ))}
        </div>
        <div className="md:hidden">
          <ScrollArea className="w-full">
            <div className="flex gap-4 px-4 pb-4">
              {highlightCards.map((card) => (
                <MarketingHighlight key={card.title} card={card} className="min-w-[260px]" />
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="mx-4" />
          </ScrollArea>
        </div>
      </section>

      <section className="bg-transparent py-16 sm:py-20 dark:bg-[#090f1f]">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">From draft to delivery without leaving MaxVideoAI</h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            Generate vertical hooks, horizontal product films, and stylised loops with presets tailored to social teams, agencies, and indie creators.
          </p>
          <Button asChild size="lg" variant="outline" className="mx-auto border-primary/50 text-primary hover:bg-primary/10">
            <Link href="/pricing">Compare the tiers</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function MarketingHighlight({
  card,
  className,
}: {
  card: (typeof highlightCards)[number];
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border border-black/10 bg-white/85 shadow-[0_35px_60px_-45px_rgba(0,0,0,0.3)] backdrop-blur-xl transition hover:-translate-y-2 dark:border-border/40 dark:bg-black/30",
        className,
      )}
    >
      <div
        className="absolute inset-0 opacity-70 transition group-hover:opacity-90 dark:hidden"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.95) 60%), url(${card.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        className="absolute inset-0 hidden opacity-60 transition dark:block dark:group-hover:opacity-80"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(6,9,20,0.4) 0%, rgba(6,9,20,0.85) 60%), url(${card.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <CardHeader className="relative">
        <CardTitle className="text-xl text-foreground">{card.title}</CardTitle>
      </CardHeader>
      <CardContent className="relative text-sm text-muted-foreground">
        {card.description}
      </CardContent>
    </Card>
  );
}
