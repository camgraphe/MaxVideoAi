'use client';

/* eslint-disable @next/next/no-img-element */
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
  "characterBadge": "V1",
  "angleEyebrow": "First frame tool",
  "angleTitle": "Angle / Perspective",
  "angleBody": "Upload an image, adjust camera angle controls, and generate a first frame ready for image-to-video workflows.",
  "angleBadge": "MVP",
  "open": "Open Tool"
} as const;

const CHARACTER_CARD_BACKGROUND_URL =
  '/assets/tools/character-builder-workspace.png';
const ANGLE_CARD_BACKGROUND_URLS = [
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/d49ec543-8b71-42bb-aa7e-ce5289e28187.webp',
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp',
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/79fe6fd7-60cf-4419-a143-a2cb52e9b762.webp',
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/cf9ff473-5f6f-4877-b5fd-aafc36bddeb8.webp',
] as const;

function ToolPreviewPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden border-b border-border bg-surface-2/80 ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_34%)]" />
      {children}
    </div>
  );
}


export default function ToolsPage() {
  const { loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
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
              <Card className="overflow-hidden border border-border bg-surface p-0">
                <ToolPreviewPanel className="aspect-[16/9] p-4">
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(15,23,42,0.06))]" />
                  <div className="relative flex h-full items-center justify-center rounded-[18px] border border-border/80 bg-bg/70 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-sm">
                    <img
                      src={CHARACTER_CARD_BACKGROUND_URL}
                      alt="Character Builder workspace preview"
                      className="h-full w-full rounded-[14px] object-cover object-top"
                    />
                  </div>
                </ToolPreviewPanel>
                <div className="p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-input bg-brand/10 text-brand">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.characterEyebrow}</p>
                      <h2 className="text-lg font-semibold text-text-primary">{copy.characterTitle}</h2>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary">{copy.characterBody}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {copy.characterBadge}
                    </span>
                    <ButtonLink href="/app/tools/character-builder" variant="primary" linkComponent={Link}>
                      {copy.open}
                    </ButtonLink>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden border border-border bg-surface p-0">
                <ToolPreviewPanel className="aspect-[16/9] p-4">
                  <div className="grid h-full grid-cols-2 gap-3">
                    {ANGLE_CARD_BACKGROUND_URLS.map((url) => (
                      <div
                        key={url}
                        className="overflow-hidden rounded-[16px] border border-border/80 bg-bg/70 p-2 shadow-[0_14px_30px_rgba(15,23,42,0.14)] backdrop-blur-sm"
                      >
                        <img src={url} alt="" className="h-full w-full rounded-[12px] object-contain" />
                      </div>
                    ))}
                  </div>
                </ToolPreviewPanel>
                <div className="p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-input bg-brand/10 text-brand">
                      <Wrench className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.angleEyebrow}</p>
                      <h2 className="text-lg font-semibold text-text-primary">{copy.angleTitle}</h2>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary">{copy.angleBody}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-secondary">
                      <Camera className="h-3.5 w-3.5" />
                      {copy.angleBadge}
                    </span>
                    <ButtonLink href="/app/tools/angle" variant="primary" linkComponent={Link}>
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
