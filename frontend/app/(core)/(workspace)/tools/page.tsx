'use client';

import Link from 'next/link';
import { Camera, Sparkles, Wrench } from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { FEATURES } from '@/content/feature-flags';
import { useI18n } from '@/lib/i18n/I18nProvider';

const DEFAULT_TOOLS_COPY = {
  "disabledTitle": "Tools are disabled",
  "disabledBody": "Enable `FEATURES.workflows.toolsSection` to access this area.",
  "eyebrow": "Workspace",
  "title": "Tools",
  "subtitle": "Build reusable first-frame assets before launching image-to-video runs.",
  "characterEyebrow": "Reference tool",
  "characterTitle": "Consistent Character Builder",
  "characterBody": "Build a reusable character reference or character sheet before manually reusing it in later image or video workflows.",
  "angleEyebrow": "First frame tool",
  "angleTitle": "Angle / Perspective",
  "angleBody": "Upload an image, adjust camera angle controls, and generate a first frame ready for image-to-video workflows.",
  "open": "Open Tool"
} as const;

const CHARACTER_CARD_BACKGROUND_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/cf2ad043-a5e4-44e9-826a-494321707d86.webp';
const ANGLE_CARD_BACKGROUND_URLS = [
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/d49ec543-8b71-42bb-aa7e-ce5289e28187.webp',
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp',
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/79fe6fd7-60cf-4419-a143-a2cb52e9b762.webp',
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/cf9ff473-5f6f-4877-b5fd-aafc36bddeb8.webp',
] as const;


export default function ToolsPage() {
  const { loading: authLoading, user } = useRequireAuth();
  const { t } = useI18n();
  const copy = t('workspace.tools', DEFAULT_TOOLS_COPY) as typeof DEFAULT_TOOLS_COPY;

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <div className="w-full animate-pulse rounded-card border border-border bg-surface p-8">
              <div className="h-4 w-24 rounded bg-surface-2" />
              <div className="mt-4 h-10 w-64 rounded bg-surface-2" />
              <div className="mt-3 h-4 w-96 rounded bg-surface-2" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!FEATURES.workflows.toolsSection) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <HeaderBar />
        <div className="flex flex-1 min-w-0 flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
            <div className="w-full rounded-card border border-border bg-surface p-6">
              <h1 className="text-2xl font-semibold text-text-primary">{copy.disabledTitle}</h1>
              <p className="mt-2 text-sm text-text-secondary">{copy.disabledBody}</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0 flex-col md:flex-row">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
          <div className="w-full space-y-6">
            <section className="rounded-card border border-border bg-surface p-6">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.eyebrow}</p>
              <h1 className="mt-2 text-3xl font-semibold text-text-primary">{copy.title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">{copy.subtitle}</p>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <Card className="relative overflow-hidden border border-border bg-surface p-5">
                <div
                  aria-hidden
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${CHARACTER_CARD_BACKGROUND_URL})` }}
                />
                <div aria-hidden className="absolute inset-0 bg-[linear-gradient(145deg,rgba(2,6,23,0.82),rgba(2,6,23,0.52),rgba(2,6,23,0.88))]" />
                <div className="relative">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-input bg-white/12 text-white shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-micro text-white/70">{copy.characterEyebrow}</p>
                      <h2 className="text-lg font-semibold text-white">{copy.characterTitle}</h2>
                    </div>
                  </div>
                  <p className="text-sm text-white/82">{copy.characterBody}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/86 backdrop-blur-sm">
                      <Sparkles className="h-3.5 w-3.5" />
                      V1
                    </span>
                    <ButtonLink href="/tools/character-builder" variant="primary" linkComponent={Link}>
                      {copy.open}
                    </ButtonLink>
                  </div>
                </div>
              </Card>

              <Card className="relative overflow-hidden border border-border bg-surface p-5">
                <div aria-hidden className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                  {ANGLE_CARD_BACKGROUND_URLS.map((url) => (
                    <div
                      key={url}
                      className="bg-cover bg-center"
                      style={{ backgroundImage: `url(${url})` }}
                    />
                  ))}
                </div>
                <div aria-hidden className="absolute inset-0 bg-[linear-gradient(145deg,rgba(2,6,23,0.78),rgba(2,6,23,0.46),rgba(2,6,23,0.88))]" />
                <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_35%)]" />
                <div className="relative">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-input bg-white/12 text-white shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-sm">
                      <Wrench className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-micro text-white/70">{copy.angleEyebrow}</p>
                      <h2 className="text-lg font-semibold text-white">{copy.angleTitle}</h2>
                    </div>
                  </div>
                  <p className="text-sm text-white/82">{copy.angleBody}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/86 backdrop-blur-sm">
                      <Camera className="h-3.5 w-3.5" />
                      MVP
                    </span>
                    <ButtonLink href="/tools/angle" variant="primary" linkComponent={Link}>
                      {copy.open}
                    </ButtonLink>
                  </div>
                </div>
              </Card>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
