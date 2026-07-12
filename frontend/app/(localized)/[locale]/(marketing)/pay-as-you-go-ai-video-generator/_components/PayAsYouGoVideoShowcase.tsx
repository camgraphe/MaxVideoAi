import Image from 'next/image';
import { ArrowRight, Play } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { AppLocale } from '@/i18n/locales';
import type { PayAsYouGoShowcaseVideo } from '../_lib/payg-video-showcase';

type PayAsYouGoVideoShowcaseProps = {
  locale: AppLocale;
  videos: PayAsYouGoShowcaseVideo[];
};

function getShowcaseCopy(locale: AppLocale) {
  return {
    en: { eyebrow: 'Real pay-as-you-go outputs', title: 'Example videos with model and price context', intro: 'A short strip from public MaxVideoAI renders, showing the model, duration, and recorded render price when available.', preview: 'Preview', result: 'View prompt and result', cta: 'Test your prompt with a live quote', media: 'example video generated with' },
    es: { eyebrow: 'Resultados reales de pago por uso', title: 'Videos de ejemplo con modelo y precio', intro: 'Una selección breve de renders públicos de MaxVideoAI que muestra el modelo, la duración y el precio registrado cuando está disponible.', preview: 'Vista previa', result: 'Ver prompt y resultado', cta: 'Prueba tu prompt con una cotización en tiempo real', media: 'video de ejemplo generado con' },
    fr: { eyebrow: 'Rendus réels sans abonnement', title: 'Vidéos d’exemple avec modèle et prix', intro: 'Une courte sélection de rendus publics MaxVideoAI montrant le modèle, la durée et le prix enregistré lorsqu’il est disponible.', preview: 'Aperçu', result: 'Voir le prompt et le résultat', cta: 'Testez votre prompt avec un devis en temps réel', media: 'vidéo d’exemple générée avec' },
  }[locale];
}

function VideoMedia({ video, priority, locale }: { video: PayAsYouGoShowcaseVideo; priority: boolean; locale: AppLocale }) {
  const copy = getShowcaseCopy(locale);
  const mediaLabel = `${video.title}, ${copy.media} ${video.engineLabel}, ${video.priceLabel}, ${video.durationLabel}`;
  if (video.videoUrl) {
    return (
      <video
        aria-label={mediaLabel}
        autoPlay
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        loop
        muted
        playsInline
        poster={video.posterUrl}
        preload="metadata"
      >
        <source src={video.videoUrl} type="video/mp4" />
      </video>
    );
  }

  if (video.posterUrl) {
    return (
      <Image
        src={video.posterUrl}
        alt={mediaLabel}
        fill
        className="object-cover transition duration-500 group-hover:scale-[1.03]"
        sizes="(max-width: 639px) 72vw, (max-width: 1023px) 32vw, 220px"
        priority={priority}
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-3 text-xs font-semibold uppercase tracking-micro text-text-muted">
      {copy.preview}
    </div>
  );
}

export function PayAsYouGoVideoShowcase({ locale, videos }: PayAsYouGoVideoShowcaseProps) {
  if (!videos.length) return null;
  const copy = getShowcaseCopy(locale);

  return (
    <section className="border-b border-hairline bg-bg">
      <div className="container-page max-w-[1220px] py-8 sm:py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-micro text-brand">{copy.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal text-text-primary sm:text-3xl">
              {copy.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              {copy.intro}
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {videos.map((video, index) => (
            <Link
              key={video.id}
              href={video.href}
              prefetch={false}
              className="group relative block h-[280px] w-[210px] shrink-0 overflow-hidden rounded-[8px] border border-hairline bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted sm:h-[320px] sm:w-[230px]"
            >
              <div className="absolute inset-0">
                <VideoMedia video={video} priority={index < 2} locale={locale} />
              </div>
              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                  <EngineIcon
                    engine={{ id: video.engineId, label: video.engineLabel }}
                    imageAlt={`${video.engineLabel} AI video model`}
                    size={20}
                    rounded="full"
                    framed={false}
                  />
                  {video.engineLabel}
                </span>
                <span className="rounded-full bg-black/70 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-white backdrop-blur">
                  {video.priceLabel}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.82))] p-3 pt-16 text-white">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-text-primary">
                    <Play className="h-3.5 w-3.5 fill-current" strokeWidth={1.8} />
                  </span>
                  <span>
                    {video.engineLabel} | {video.durationLabel} | {video.priceLabel}
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-1 text-sm font-semibold leading-5">{video.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/82">{video.useCase}</p>
                <span className="mt-2 inline-flex text-xs font-semibold text-white/90">{copy.result}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-4 flex justify-start">
          <Link
            href="/app"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-text-primary px-4 text-sm font-semibold text-bg shadow-card transition hover:bg-text-primary/90"
          >
            {copy.cta}
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </section>
  );
}
