import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowRight, Camera, Sparkles } from 'lucide-react';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const CHARACTER_CARD_BACKGROUND_URL =
  '/assets/tools/character-builder-workspace.png';
const ANGLE_CARD_BACKGROUND_URL = '/assets/tools/angle-workspace.png';

export const metadata: Metadata = buildSeoMetadata({
  locale: 'en',
  title: 'AI Pre-Production Tools for Image & Video Workflows',
  description:
    'Build reusable character references and stronger first frames before you generate. Explore MaxVideoAI tools for consistent character creation and AI camera angle control.',
  englishPath: '/tools',
  availableLocales: ['en'],
  keywords: [
    'ai pre production tools',
    'image to video workflow tools',
    'consistent character ai',
    'change camera angle ai',
    'first frame for ai video',
  ],
});

function ToolCard({
  icon,
  eyebrow,
  title,
  body,
  href,
  visual,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  visual: ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-hairline bg-surface p-0">
      <div className="border-b border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(245,248,251,0.94))] p-4">
        {visual}
      </div>
      <div className="stack-gap-sm p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">{icon}</span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">{eyebrow}</p>
            <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          </div>
        </div>
        <p className="text-sm leading-7 text-text-secondary">{body}</p>
        <ButtonLink href={href} size="lg" className="w-fit">
          Explore Tool
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>
    </Card>
  );
}

export default function ToolsMarketingHubPage() {
  return (
    <div className="bg-bg">
      <section className="section halo-hero">
        <div className="container-page max-w-6xl stack-gap-lg text-center">
          <div className="inline-flex w-fit self-center rounded-full border border-hairline bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-text-muted shadow-card">
            MaxVideoAI Tools
          </div>
          <div className="stack-gap-sm">
            <h1 className="text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">
              Build Reusable Assets Before Image-to-Video
            </h1>
            <p className="mx-auto max-w-3xl text-base leading-8 text-text-secondary sm:text-lg">
              These tools are built for the step before generation: lock the character, fix the angle, then carry stronger visual
              inputs into image creation, image-to-video, and the MaxVideoAI model hub.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/tools/character-builder" size="lg">
              Consistent Character AI
            </ButtonLink>
            <ButtonLink href="/tools/angle" variant="outline" size="lg">
              Change Camera Angle with AI
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl grid gap-5 lg:grid-cols-2">
          <ToolCard
            icon={<Sparkles className="h-5 w-5" />}
            eyebrow="Character consistency"
            title="Create reusable character references"
            body="Turn one image into an 8-panel character sheet with 4 full-body angles and 4 close-ups, or create a portrait anchor before you branch into scenes, prompts, and motion."
            href="/tools/character-builder"
            visual={
              <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-[#eef3fa]">
                <Image
                  src={CHARACTER_CARD_BACKGROUND_URL}
                  alt="Character Builder workspace screenshot from MaxVideoAI."
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className="object-cover object-top"
                />
              </div>
            }
          />
          <ToolCard
            icon={<Camera className="h-5 w-5" />}
            eyebrow="Perspective control"
            title="Generate stronger first frames from one image"
            body="Change viewpoint, explore alternative compositions, and generate motion-ready frames without rebuilding the whole image from scratch."
            href="/tools/angle"
            visual={
              <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-[#eef3fa]">
                <Image
                  src={ANGLE_CARD_BACKGROUND_URL}
                  alt="Angle workspace screenshot from MaxVideoAI."
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className="object-cover object-top"
                />
              </div>
            }
          />
        </div>
      </section>
    </div>
  );
}
