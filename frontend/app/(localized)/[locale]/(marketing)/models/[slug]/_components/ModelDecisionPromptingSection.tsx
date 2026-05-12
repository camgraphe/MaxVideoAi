import Image from 'next/image';
import { BadgeCheck, Clock3, ExternalLink, Lightbulb, Play, Sparkles, Volume2 } from 'lucide-react';

import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import { getImageAlt } from '@/lib/image-alt';

import type { FeaturedMedia } from '../_lib/model-page-media';
import { SECTION_SCROLL_MARGIN, type SoraCopy } from '../_lib/model-page-specs';
import { ModelDecisionPromptTabs } from './ModelDecisionPromptTabs.client';

type ModelDecisionPromptingSectionProps = {
  imageAnchorId: string;
  copy: SoraCopy;
  demoMedia: FeaturedMedia | null;
  locale: AppLocale;
};

function getPromptLabels(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      tipPrefix: 'Tip',
      guide: 'Guide officiel Seedance 2.0',
      global: 'Principes globaux',
      quirks: 'Points moteur a surveiller',
      demoSubject: 'Sujet',
      demoAction: 'Action',
      demoCamera: 'Camera',
      demoStyle: 'Style',
      demoAudio: 'Audio',
      viewFull: 'Voir le rendu complet',
      textToVideo: 'Text-to-video',
      audioOn: 'Audio on',
    };
  }
  if (locale === 'es') {
    return {
      tipPrefix: 'Tip',
      guide: 'Guia oficial Seedance 2.0',
      global: 'Principios globales',
      quirks: 'Puntos del motor a vigilar',
      demoSubject: 'Sujeto',
      demoAction: 'Accion',
      demoCamera: 'Camara',
      demoStyle: 'Estilo',
      demoAudio: 'Audio',
      viewFull: 'Ver render completo',
      textToVideo: 'Text-to-video',
      audioOn: 'Audio on',
    };
  }
  return {
    tipPrefix: 'Tip',
    guide: 'Official Seedance 2.0 guide',
    global: 'Global principles',
    quirks: 'Engine quirks / what to watch for',
    demoSubject: 'Subject',
    demoAction: 'Action',
    demoCamera: 'Camera',
    demoStyle: 'Style',
    demoAudio: 'Audio',
    viewFull: 'View full render',
    textToVideo: 'Text-to-video',
    audioOn: 'Audio on',
  };
}

function getDemoSummary(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      subject: 'Biker crane blinde',
      action: 'La moto approche et marque l arret',
      camera: 'Tracking bas frontal, leger push-in',
      style: 'Cinematique, reflets de rue mouillee',
      audio: 'Moteur, cliquetis metal, tonnerre lointain',
    };
  }
  if (locale === 'es') {
    return {
      subject: 'Biker calavera blindado',
      action: 'La moto se acerca y se detiene',
      camera: 'Tracking bajo frontal, leve push-in',
      style: 'Cinematico, reflejos de calle mojada',
      audio: 'Motor, metal, trueno distante',
    };
  }
  return {
    subject: 'Armored skull biker',
    action: 'Motorcycle approaches and stops',
    camera: 'Low front tracking, slight push-in',
    style: 'Cinematic, wet street reflections',
    audio: 'Engine revs, metal clinks, distant thunder',
  };
}

function getDuration(media: FeaturedMedia | null, locale: AppLocale) {
  const seconds = media?.durationSec ?? 12;
  return locale === 'fr' || locale === 'es' ? `${seconds} s` : `${seconds}s`;
}

function getAspect(media: FeaturedMedia | null) {
  return media?.aspectRatio && /^\d+:\d+$/.test(media.aspectRatio) ? media.aspectRatio : '16:9';
}

export function ModelDecisionPromptingSection({
  imageAnchorId,
  copy,
  demoMedia,
  locale,
}: ModelDecisionPromptingSectionProps) {
  const labels = getPromptLabels(locale);
  const demo = getDemoSummary(locale);
  const title = copy.promptingTitle ?? 'Prompt Lab — Seedance 2.0';
  const intro = copy.promptingIntro ?? '';
  const guideLabel = labels.guide;
  const guideHref = copy.promptingGuideUrl ?? null;
  const posterSrc = demoMedia?.posterUrl ?? null;
  const demoAlt = getImageAlt({
    kind: 'renderThumb',
    engine: demoMedia?.label ?? 'Seedance 2.0',
    label: demoMedia?.prompt ?? copy.demoTitle ?? title,
    prompt: demoMedia?.prompt ?? copy.demoTitle ?? title,
    locale,
  });

  return (
    <section id={imageAnchorId} className={`${SECTION_SCROLL_MARGIN} space-y-4`}>
      <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] sm:p-7">
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <h2 className="text-[2rem] font-semibold leading-tight tracking-normal text-slate-950 dark:text-white sm:text-[2.45rem]">
              {title}
            </h2>
            {guideHref ? (
              <a
                href={guideHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-blue-50 px-4 text-xs font-semibold uppercase tracking-[0.06em] text-blue-600 dark:bg-blue-500/12 dark:text-blue-200"
              >
                <span>{guideLabel}</span>
                <UIIcon icon={ExternalLink} size={12} />
              </a>
            ) : null}
          </div>
          {intro ? <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{intro}</p> : null}
          {copy.promptingTip ? (
            <div className="mx-auto mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-5 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
              <UIIcon icon={Lightbulb} size={15} className="text-slate-500 dark:text-slate-300" />
              <span>{copy.promptingTip.replace(/^Tip:\s*/i, `${labels.tipPrefix}: `)}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
          <ModelDecisionPromptTabs tabs={copy.promptingTabs} locale={locale} exampleHref={demoMedia?.href ?? null} />

          <div className="space-y-4">
            <article className="rounded-[20px] border border-hairline bg-surface p-4 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.42)] dark:bg-white/[0.045]">
              <div className="mb-3 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-300">
                  <UIIcon icon={BadgeCheck} size={19} />
                </span>
                <h3 className="!text-left text-base font-semibold text-text-primary">{labels.global}</h3>
              </div>
              <ul className="space-y-2.5 text-[0.84rem] leading-5 text-text-secondary">
                {copy.promptingGlobalPrinciples.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <UIIcon icon={BadgeCheck} size={15} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-[20px] border border-hairline bg-surface p-4 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.42)] dark:bg-white/[0.045]">
              <div className="mb-3 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-300">
                  <UIIcon icon={Sparkles} size={19} />
                </span>
                <h3 className="!text-left text-base font-semibold text-text-primary">{labels.quirks}</h3>
              </div>
              <ul className="space-y-2.5 text-[0.84rem] leading-5 text-text-secondary">
                {copy.promptingEngineWhy.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <UIIcon icon={BadgeCheck} size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </div>

      <article className="grid gap-5 rounded-[22px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_58px_-36px_rgba(15,23,42,0.36)] backdrop-blur dark:border-white/10 dark:bg-slate-950/72 lg:grid-cols-[minmax(0,0.86fr)_minmax(440px,1.14fr)]">
        <div>
          <h2 className="!text-left text-2xl font-semibold text-text-primary">{copy.demoTitle ?? 'Demo prompt — Seedance 2.0'}</h2>
          <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-500/12 dark:text-blue-200">
            {labels.textToVideo}
          </span>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            <strong>{labels.demoSubject}:</strong> {demo.subject} &nbsp;•&nbsp; <strong>{labels.demoAction}:</strong> {demo.action}
            <br />
            <strong>{labels.demoCamera}:</strong> {demo.camera} &nbsp;•&nbsp; <strong>{labels.demoStyle}:</strong> {demo.style}
            <br />
            <strong>{labels.demoAudio}:</strong> {demo.audio}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-secondary">
              <UIIcon icon={Clock3} size={15} />
              {getDuration(demoMedia, locale)}
            </span>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-secondary">
              <UIIcon icon={Sparkles} size={15} />
              {getAspect(demoMedia)}
            </span>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-secondary">
              <UIIcon icon={Volume2} size={15} className="text-emerald-600 dark:text-emerald-300" />
              {labels.audioOn}
            </span>
          </div>
        </div>

        <figure className="relative min-h-[230px] overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-[0_18px_48px_-30px_rgba(15,23,42,0.55)] dark:border-white/10">
          {posterSrc ? (
            <Image src={posterSrc} alt={demoAlt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 620px" quality={80} />
          ) : (
            <div className="flex h-full min-h-[260px] items-center justify-center text-sm font-semibold text-white/70">Demo preview</div>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.08),rgba(3,7,18,0.62))]" />
          <div className="absolute right-4 top-4 flex gap-2">
            <span className="rounded-lg bg-slate-950/78 px-3 py-1.5 text-xs font-semibold text-white">{getDuration(demoMedia, locale)}</span>
            <span className="rounded-lg bg-slate-950/78 px-3 py-1.5 text-xs font-semibold text-white">{getAspect(demoMedia)}</span>
          </div>
          <span className="absolute left-1/2 top-1/2 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/68 text-white backdrop-blur">
            <UIIcon icon={Play} size={24} fill="currentColor" />
          </span>
          {demoMedia?.href ? (
            <Link
              href={demoMedia.href}
              className="absolute bottom-4 right-4 inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-slate-950/62 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-slate-950/78"
            >
              <span>{labels.viewFull}</span>
              <UIIcon icon={ExternalLink} size={14} />
            </Link>
          ) : null}
        </figure>
      </article>
    </section>
  );
}
