import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowRight, Camera, ImagePlus, Sparkles } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/types';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const IMAGE_CARD_BACKGROUND_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/1212fdd0-0299-4e07-8546-c8fc0925432d.webp';
const CHARACTER_CARD_BACKGROUND_URL = '/assets/tools/character-builder-workspace.png';
const ANGLE_CARD_BACKGROUND_URL = '/assets/tools/angle-workspace.png';

type ToolsMarketingHubContent = Dictionary['toolMarketing']['hub'];

function ToolCard({
  icon,
  eyebrow,
  title,
  body,
  href,
  cta,
  visual,
  toolName,
  targetFamily,
  ctaLocation,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  visual: ReactNode;
  toolName: string;
  targetFamily: string;
  ctaLocation: string;
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
        <ButtonLink
          href={href}
          linkComponent={Link}
          size="lg"
          className="w-fit"
          data-analytics-event="tool_cta_click"
          data-analytics-cta-name={`${toolName}_hub_card`}
          data-analytics-cta-location={ctaLocation}
          data-analytics-tool-name={toolName}
          data-analytics-tool-surface="public"
          data-analytics-target-family={targetFamily}
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>
    </Card>
  );
}

export function ToolsMarketingHubPage({ content }: { content: ToolsMarketingHubContent }) {
  return (
    <div className="bg-bg">
      <section className="section halo-hero">
        <div className="container-page max-w-6xl stack-gap-lg text-center">
          <div className="inline-flex w-fit self-center rounded-full border border-hairline bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-text-muted shadow-card">
            {content.hero.badge}
          </div>
          <div className="stack-gap-sm">
            <h1 className="text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">{content.hero.title}</h1>
            <p className="mx-auto max-w-3xl text-base leading-8 text-text-secondary sm:text-lg">{content.hero.body}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink
              href="/tools/character-builder"
              linkComponent={Link}
              size="lg"
              data-analytics-event="tool_cta_click"
              data-analytics-cta-name="character_builder_hub_hero_primary"
              data-analytics-cta-location="tools_hub_hero"
              data-analytics-tool-name="character_builder"
              data-analytics-tool-surface="public"
              data-analytics-target-family="public_tools"
            >
              {content.hero.primaryCta}
            </ButtonLink>
            <ButtonLink
              href="/tools/angle"
              linkComponent={Link}
              variant="outline"
              size="lg"
              data-analytics-event="tool_cta_click"
              data-analytics-cta-name="angle_hub_hero_secondary"
              data-analytics-cta-location="tools_hub_hero"
              data-analytics-tool-name="angle"
              data-analytics-tool-surface="public"
              data-analytics-target-family="public_tools"
            >
              {content.hero.secondaryCta}
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl grid gap-5 lg:grid-cols-3">
          <ToolCard
            icon={<ImagePlus className="h-5 w-5" />}
            eyebrow={content.cards.image.eyebrow}
            title={content.cards.image.title}
            body={content.cards.image.body}
            href="/app/image"
            cta={content.cards.image.cta}
            toolName="image"
            targetFamily="workspace"
            ctaLocation="tools_hub_card_image"
            visual={
              <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-[#eef3fa]">
                <Image
                  src={IMAGE_CARD_BACKGROUND_URL}
                  alt={content.cards.image.imageAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className="object-cover object-center"
                />
              </div>
            }
          />
          <ToolCard
            icon={<Sparkles className="h-5 w-5" />}
            eyebrow={content.cards.character.eyebrow}
            title={content.cards.character.title}
            body={content.cards.character.body}
            href="/tools/character-builder"
            cta={content.cards.character.cta}
            toolName="character_builder"
            targetFamily="public_tools"
            ctaLocation="tools_hub_card_character_builder"
            visual={
              <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-[#eef3fa]">
                <Image
                  src={CHARACTER_CARD_BACKGROUND_URL}
                  alt={content.cards.character.imageAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 520px"
                  className="object-cover object-top"
                />
              </div>
            }
          />
          <ToolCard
            icon={<Camera className="h-5 w-5" />}
            eyebrow={content.cards.angle.eyebrow}
            title={content.cards.angle.title}
            body={content.cards.angle.body}
            href="/tools/angle"
            cta={content.cards.angle.cta}
            toolName="angle"
            targetFamily="public_tools"
            ctaLocation="tools_hub_card_angle"
            visual={
              <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-[#eef3fa]">
                <Image
                  src={ANGLE_CARD_BACKGROUND_URL}
                  alt={content.cards.angle.imageAlt}
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
