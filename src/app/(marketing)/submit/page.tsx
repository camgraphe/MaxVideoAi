import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Submit your clip to the Wall",
  description: "Opt in to feature your clip on the Wall. Share engine details, usage rights, and contact info so the team can review quickly.",
  alternates: {
    canonical: `${siteConfig.url}/submit`,
  },
};

export default function SubmitPage() {
  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(80,115,255,0.12),_transparent_60%)] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,22,0.92)_0%,rgba(7,11,20,0.94)_45%,rgba(6,9,18,0.96)_100%)]" />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 pb-12 pt-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit border-primary/40 text-primary">
            Submit
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Publish your clip to the Wall</h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            Submissions are reviewed within one business day. Provide accurate engine settings and usage notes so we can approve faster.
          </p>
        </header>

        <Card className="border-white/10 bg-white/5 p-6 text-sm text-muted-foreground backdrop-blur">
          <CardHeader className="space-y-2 p-0">
            <CardTitle className="text-lg text-foreground">Submission details</CardTitle>
            <p>We will email you if we need clarification or licensing confirmation.</p>
          </CardHeader>
          <CardContent className="mt-4 space-y-6 p-0">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" placeholder="Ada Lovelace" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="crew@studio.com" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="engine">Engine and version</Label>
                <Input id="engine" placeholder="Veo 3" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier">Tier</Label>
                <Input id="tier" placeholder="Premium / Pro / Starter / Open" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clip-url">Clip URL</Label>
              <Input id="clip-url" placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usage">Usage rights</Label>
              <Textarea id="usage" rows={3} placeholder="Commercial use allowed. Watermark removed via Enhance." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes for reviewer</Label>
              <Textarea id="notes" rows={4} placeholder="Anything else we should watch for?" />
            </div>
            <Button className="w-full rounded-full" type="submit">
              Submit for review
            </Button>
          </CardContent>
        </Card>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-muted-foreground backdrop-blur">
          <h2 className="text-lg font-semibold text-foreground">What happens next?</h2>
          <ul className="mt-3 space-y-2">
            <li>1. Moderators review for quality, rights, and safe content.</li>
            <li>2. We confirm engine metadata and cost pin.</li>
            <li>3. Approved clips appear in Editor picks or the filtered Wall.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
