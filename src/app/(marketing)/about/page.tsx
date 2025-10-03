import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About MaxVideoAI",
  description: "MaxVideoAI helps teams navigate AI video engines with discovery, cost transparency, and conversion-ready workflows.",
  alternates: {
    canonical: `${siteConfig.url}/about`,
  },
};

const pillars = [
  {
    title: "Discovery first",
    description:
      "We believe people should see proof before they commit credits. The Wall surfaces breadth, quality, and price in one screen.",
  },
  {
    title: "Cost transparency",
    description:
      "Every tile, recipe, and enhance step shows what it costs. Finance gets the same numbers through Stripe meters.",
  },
  {
    title: "Conversion obsessed",
    description:
      "The flow from Wall to Clip to Remix to Enhance is tuned for speed. We measure success by remixes that ship, not signups.",
  },
];

const values = [
  {
    title: "Proof over hype",
    detail: "Show the result, show the cost, then let the user decide. No mystery boxes, no hidden fees.",
  },
  {
    title: "Shared guardrails",
    detail: "Durations, ratios, audio, and budget caps are visible to producers and finance so nobody gets surprised at handoff.",
  },
  {
    title: "Inclusive by design",
    detail: "Keyboard navigation, reduced motion modes, captions, and clear copy help any teammate run the pipeline confidently.",
  },
];

export default function AboutPage() {
  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(80,115,255,0.12),_transparent_60%)] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,22,0.92)_0%,rgba(7,11,20,0.94)_45%,rgba(6,9,18,0.96)_100%)]" />
      <div className="flex w-full flex-col gap-12 px-4 pb-12 pt-10 sm:px-6 lg:px-10 xl:px-14">
        <header className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit border-primary/40 text-primary">
            About
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">The control room for AI video teams</h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            MaxVideoAI removes guesswork from AI video production. We orchestrate the best engines, show the cost upfront, and give teams a faster route from idea to render to delivery.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {pillars.map((pillar) => (
            <Card key={pillar.title} className="border-white/10 bg-white/5 p-6 text-sm text-muted-foreground backdrop-blur">
              <CardTitle className="text-lg text-foreground">{pillar.title}</CardTitle>
              <CardContent className="p-0">
                <p className="mt-3 leading-relaxed">{pillar.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-white/10 bg-white/5 p-6 text-sm text-muted-foreground backdrop-blur">
            <CardHeader className="space-y-3 p-0">
              <CardTitle className="text-xl text-foreground">What we are building</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                A discovery-first workflow where producers stay in flow and finance trusts the meter.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 space-y-4 p-0">
              <p>
                The Wall is where every session begins. Users filter by tier, aspect, duration, and price to shortlist proof. Recipes show parameters, cost, and licensing so remixes stay compliant. Enhance utilities keep margin high without forcing anyone to leave the platform.
              </p>
              <p>
                Under the hood we connect Supabase auth, fal.ai queues, and Stripe metered billing. Every click ladders up to our north star metric: successful remixes.
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 p-6 text-sm text-muted-foreground backdrop-blur">
            <CardHeader className="space-y-3 p-0">
              <CardTitle className="text-xl text-foreground">Operating principles</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                How we make decisions across product, engineering, and growth.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 space-y-3 p-0">
              {values.map((value) => (
                <div key={value.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-foreground">{value.title}</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{value.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-muted-foreground backdrop-blur">
          <h2 className="text-xl font-semibold text-foreground">Governance and moderation</h2>
          <p className="mt-3 max-w-3xl">
            Publishing to the Wall is opt in. Clips pass automatic flagging for faces, logos, and sensitive content before landing in the discovery feed. Every clip links to licensing guidance and exposes a report button so moderators can act fast.
          </p>
          <p className="mt-3 max-w-3xl">
            We maintain a DMCA process, document usage rights per engine, and resolve takedowns within two business days.
          </p>
        </section>
      </div>
    </div>
  );
}
