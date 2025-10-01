import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: "$49 / month",
    badge: "Solo & UGC",
    highlights: ["10 FAL clips included", "Per-second billing for Veo", "Personal budget guard"],
    tone: "from-primary/30",
  },
  {
    name: "Pro",
    price: "$159 / month",
    badge: "Studios",
    highlights: ["Priority renders", "MaxVideoAI watermark toggle", "Dual export 9:16 + 16:9"],
    tone: "from-accent/40",
    featured: true,
  },
  {
    name: "Agency",
    price: "Custom pricing",
    badge: "Agencies",
    highlights: ["Multi-seat workspaces & API", "SLA + real-time monitoring", "Unlimited brand kits"],
    tone: "from-white/20",
  },
];

export default function PricingPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(134,91,255,0.3),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,18,0.92)_0%,rgba(6,8,18,0.98)_60%,rgba(6,8,18,1)_100%)]" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge variant="outline" className="border-primary/50 text-primary">
            Stripe + usage-based billing
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pick the pace for your production</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Bundle subscription perks with precise metering. Every render logs Veo seconds and FAL clips into Stripe so your invoice mirrors reality.
          </p>
        </div>
        <div className="hidden gap-8 md:grid md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>
        <div className="md:hidden">
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {plans.map((plan) => (
                <PlanCard key={plan.name} plan={plan} className="min-w-[280px]" />
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="mx-4" />
          </ScrollArea>
        </div>
        <div className="rounded-3xl border border-black/10 bg-white/85 p-8 text-center backdrop-blur-xl dark:border-white/10 dark:bg-black/30">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <Badge variant="secondary" className="mx-auto w-fit border border-white/10 bg-white/5 text-xs uppercase tracking-[0.35em]">
              <Sparkles className="mr-2 h-3 w-3" /> Usage meters
            </Badge>
            <h2 className="text-2xl font-semibold">Two metrics, zero surprises</h2>
            <p className="text-sm text-muted-foreground">
              We log `veo_seconds_generated` and `fal_clips_generated` at job completion. Credits update instantly so producers can approve the next render without guessing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  className,
}: {
  plan: (typeof plans)[number];
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border border-black/10 bg-white/85 shadow-[0_40px_60px_-45px_rgba(0,0,0,0.25)] backdrop-blur-xl transition hover:-translate-y-2 dark:border-white/10 dark:bg-black/30",
        plan.featured ? "ring-1 ring-primary/50" : "",
        className,
      )}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${plan.tone} to-transparent opacity-60 dark:opacity-70`}
      />
      <CardHeader className="relative flex flex-col gap-2">
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <CardDescription className="text-base text-muted-foreground/90">{plan.price}</CardDescription>
        <Badge variant="secondary" className="w-fit border border-white/20 bg-black/50 text-foreground">
          {plan.badge}
        </Badge>
      </CardHeader>
      <CardContent className="relative flex flex-col gap-3 text-sm text-muted-foreground">
        {plan.highlights.map((highlight) => (
          <div key={highlight} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 text-primary" />
            <span>{highlight}</span>
          </div>
        ))}
      </CardContent>
      <CardFooter className="relative">
        <Button
          className="w-full"
          variant={plan.featured ? "default" : "outline"}
          size="lg"
          {...(plan.featured
            ? {
                className: "w-full shadow-[0_24px_48px_-20px_rgba(134,91,255,0.8)]",
              }
            : {})}
        >
          {plan.name === "Agency" ? "Talk to us" : "Choose this plan"}
        </Button>
      </CardFooter>
    </Card>
  );
}
