import type { ReactNode } from 'react';
import Image from 'next/image';
import { ArrowRight, Camera, ImagePlus, Maximize2, Sparkles } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/types';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';

const IMAGE_CARD_BACKGROUND_URL =
  'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/1212fdd0-0299-4e07-8546-c8fc0925432d.webp';
const CHARACTER_CARD_BACKGROUND_URL = '/assets/tools/character-builder-workspace.png';
const ANGLE_CARD_BACKGROUND_URL = '/assets/tools/angle-workspace.png';
const TOOLS_HERO_IMAGE_URL = '/assets/tools/tools-hero-reference.webp';

type ToolsMarketingHubContent = Dictionary['toolMarketing']['hub'];

const iconTone = 'text-[#356BE8]';

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
    <article className="flex h-full min-h-[540px] flex-col rounded-[10px] border border-hairline bg-white p-4 shadow-[0_18px_54px_rgba(33,49,78,0.06)] transition hover:-translate-y-1 hover:border-text-muted/30 hover:shadow-float dark:bg-white/[0.055]">
      <div className="relative overflow-hidden rounded-[8px] bg-[#f5f7fc]">
        {visual}
      </div>
      <div className="flex flex-1 flex-col pt-6">
        <span className={`inline-flex h-8 w-8 items-center justify-center ${iconTone}`}>{icon}</span>
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{eyebrow}</p>
        <h2 className="mt-3 text-xl font-semibold leading-7 text-text-primary">{title}</h2>
        <p className="mt-4 text-sm leading-7 text-text-secondary">{body}</p>
        <ButtonLink
          href={href}
          linkComponent={Link}
          size="md"
          className="mt-auto w-fit rounded-[7px] px-4 py-2 text-sm"
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
    </article>
  );
}

export function ToolsMarketingHubPage({ content }: { content: ToolsMarketingHubContent }) {
  return (
    <div className="bg-bg">
      <section className="relative min-h-[520px] overflow-hidden border-b border-hairline bg-bg">
        <Image
          src={TOOLS_HERO_IMAGE_URL}
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          className="pointer-events-none object-cover object-center dark:brightness-[0.72] dark:contrast-110 dark:invert"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.76)_32%,rgba(247,249,253,0.34)_64%,rgba(247,249,253,0.08)_100%)] dark:bg-[radial-gradient(circle_at_50%_38%,rgba(3,7,18,0.64)_0%,rgba(3,7,18,0.46)_36%,rgba(3,7,18,0.18)_68%,rgba(3,7,18,0.04)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent" />
        <div className="container-page relative flex min-h-[520px] max-w-[1400px] items-center justify-center py-12">
          <div className="mx-auto max-w-[760px] text-center">
            <div className="inline-flex w-fit items-center rounded-pill border border-hairline bg-white/68 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-text-primary shadow-sm backdrop-blur">
              {content.hero.badge}
            </div>
            <h1 className="mx-auto mt-7 max-w-[20ch] text-4xl font-semibold leading-[1.04] text-text-primary sm:text-5xl lg:text-[3.55rem]">
              {content.hero.title}
            </h1>
            <p className="mx-auto mt-6 max-w-[620px] text-base leading-7 text-text-secondary">
              {content.hero.body}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink
                href="/tools/character-builder"
                linkComponent={Link}
                size="lg"
                className="rounded-[7px]"
                data-analytics-event="tool_cta_click"
                data-analytics-cta-name="character_builder_hub_hero_primary"
                data-analytics-cta-location="tools_hub_hero"
                data-analytics-tool-name="character_builder"
                data-analytics-tool-surface="public"
                data-analytics-target-family="public_tools"
              >
                {content.hero.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink
                href="/tools/angle"
                linkComponent={Link}
                variant="outline"
                size="lg"
                className="rounded-[7px] bg-white/74"
                data-analytics-event="tool_cta_click"
                data-analytics-cta-name="angle_hub_hero_secondary"
                data-analytics-cta-location="tools_hub_hero"
                data-analytics-tool-name="angle"
                data-analytics-tool-surface="public"
                data-analytics-target-family="public_tools"
              >
                {content.hero.secondaryCta}
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-b border-hairline bg-bg py-12 sm:py-14">
        <div className="container-page relative max-w-[1220px]">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
                <div className="relative aspect-[16/9] overflow-hidden rounded-[8px] bg-[#eef3fa]">
                  <Image
                    src={IMAGE_CARD_BACKGROUND_URL}
                    alt={content.cards.image.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 520px"
                    className="pointer-events-none object-cover object-center"
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
                <div className="relative aspect-[16/9] overflow-hidden rounded-[8px] bg-[#eef3fa]">
                  <Image
                    src={CHARACTER_CARD_BACKGROUND_URL}
                    alt={content.cards.character.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 520px"
                    className="pointer-events-none object-cover object-top"
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
                <div className="relative aspect-[16/9] overflow-hidden rounded-[8px] bg-[#eef3fa]">
                  <Image
                    src={ANGLE_CARD_BACKGROUND_URL}
                    alt={content.cards.angle.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 520px"
                    className="pointer-events-none object-cover object-top"
                  />
                </div>
              }
            />
            <ToolCard
              icon={<Maximize2 className="h-5 w-5" />}
              eyebrow={content.cards.upscale.eyebrow}
              title={content.cards.upscale.title}
              body={content.cards.upscale.body}
              href="/tools/upscale"
              cta={content.cards.upscale.cta}
              toolName="upscale"
              targetFamily="public_tools"
              ctaLocation="tools_hub_card_upscale"
              visual={
                <div className="grid aspect-[16/9] grid-cols-2 gap-3 rounded-[8px] bg-[#eef3fa] p-3">
                  <div className="relative overflow-hidden rounded-[7px]">
                    <Image
                      src={ANGLE_CARD_BACKGROUND_URL}
                      alt={content.cards.upscale.imageAlt}
                      fill
                      sizes="(max-width: 1024px) 50vw, 260px"
                      className="pointer-events-none scale-110 object-cover object-top blur-[1px]"
                    />
                  </div>
                  <div className="relative overflow-hidden rounded-[7px]">
                    <Image
                      src={ANGLE_CARD_BACKGROUND_URL}
                      alt={content.cards.upscale.imageAlt}
                      fill
                      sizes="(max-width: 1024px) 50vw, 260px"
                      className="pointer-events-none object-cover object-top"
                    />
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </section>

      <section className="bg-surface-2 py-12 sm:py-14">
        <div className="container-page grid max-w-[1220px] gap-8 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start">
          <div className="max-w-[320px] stack-gap-xs">
            <p className="text-xs font-semibold uppercase tracking-[0.20em] text-text-muted">
              {content.bestStartingPoints.eyebrow}
            </p>
            <h2 className="text-3xl font-semibold leading-tight text-text-primary">{content.bestStartingPoints.title}</h2>
            <p className="text-sm leading-7 text-text-secondary">{content.bestStartingPoints.body}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(content.bestStartingPoints.cards).map(([key, card]) => (
              <div key={key} className="rounded-[8px] border border-hairline bg-white p-5 shadow-card">
                <span className={`inline-flex h-8 w-8 items-center justify-center ${iconTone}`}>
                  {key === 'image' ? (
                    <ImagePlus className="h-5 w-5" />
                  ) : key === 'character' ? (
                    <Sparkles className="h-5 w-5" />
                  ) : key === 'upscale' ? (
                    <Maximize2 className="h-5 w-5" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{card.eyebrow}</p>
                <h3 className="mt-3 text-lg font-semibold text-text-primary">{card.title}</h3>
                <p className="mt-2 text-sm leading-7 text-text-secondary">{card.body}</p>
                <Link
                  href={
                    key === 'image'
                      ? '/app/image'
                      : key === 'character'
                        ? '/tools/character-builder'
                        : key === 'upscale'
                          ? '/tools/upscale'
                          : '/tools/angle'
                  }
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#356BE8] hover:text-[#214fb8]"
                >
                  {card.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
