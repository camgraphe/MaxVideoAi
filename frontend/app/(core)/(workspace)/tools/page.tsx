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
              <Card className="border border-border bg-surface p-5">
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
                    V1
                  </span>
                  <ButtonLink href="/tools/character-builder" variant="primary" linkComponent={Link}>
                    {copy.open}
                  </ButtonLink>
                </div>
              </Card>

              <Card className="border border-border bg-surface p-5">
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
                    MVP
                  </span>
                  <ButtonLink href="/tools/angle" variant="primary" linkComponent={Link}>
                    {copy.open}
                  </ButtonLink>
                </div>
              </Card>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
