import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Licenses and usage",
  description: "Understand usage rights, watermark policy, DMCA, and moderation guidelines for MaxVideoAI clips and collections.",
  alternates: {
    canonical: `${siteConfig.url}/legal`,
  },
};

const sections = [
  {
    title: "Usage rights by tier",
    body: [
      "Premium clips ship watermark free with commercial usage. Enhance toggles include 4K upscale, dual export, and audio licensing where provided.",
      "Pro clips ship watermark free. Reframe and Upscale are treated as derivative works and inherit the base rights.",
      "Starter and Open clips include a subtle watermark until you run Enhance. Attribution is required for Open clips unless you remove it via Enhance.",
    ],
  },
  {
    title: "Watermark policy",
    body: [
      "Watermarks appear on Starter and Open tiers. Running Enhance removes them and logs the cost pin update.",
      "We do not watermark Premium or Pro clips to preserve broadcast quality.",
    ],
  },
  {
    title: "DMCA and takedowns",
    body: [
      "Submit removal requests to legal@maxvideoai.com. Include clip URL, rights evidence, and contact details.",
      "We respond within two business days and remove public visibility while the claim is reviewed.",
    ],
  },
  {
    title: "Moderation",
    body: [
      "Publishing to the Wall is opt in. Clips are scanned for faces, logos, and sensitive content before review.",
      "Report clips directly from the recipe page. Moderators can unlist clips immediately and reach out to the publisher for context.",
    ],
  },
  {
    title: "Attribution",
    body: [
      "Open tier clips require attribution to MaxVideoAI and the model provider unless Enhance removes the watermark.",
      "When sharing on social platforms, include #MaxVideoAI and list the engine used.",
    ],
  },
];

export default function LegalPage() {
  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(80,115,255,0.12),_transparent_60%)] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,22,0.92)_0%,rgba(7,11,20,0.94)_45%,rgba(6,9,18,0.96)_100%)]" />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pb-12 pt-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit border-primary/40 text-primary">
            Legal
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Licenses and usage</h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            Clear guardrails for publishing clips on the Wall, remixing in the toolkit, and distributing finished assets.
          </p>
        </header>

        <div className="space-y-6">
          {sections.map((section) => (
            <Card key={section.title} className="border-white/10 bg-white/5 p-6 text-sm text-muted-foreground backdrop-blur">
              <CardHeader className="p-0">
                <CardTitle className="text-lg font-semibold text-foreground">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="mt-3 space-y-3 p-0">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
