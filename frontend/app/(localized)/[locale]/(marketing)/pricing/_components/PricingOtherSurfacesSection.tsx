import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import styles from './pricing-catalog.module.css';
import type { AppLocale } from '@/i18n/locales';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { ImagePricingRow, OtherSurfacePricingData } from '../_lib/pricingHubData';
import { pricingOpeningCopy } from '../_lib/pricing-opening-copy';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';
import { PricingTableScrollRegion } from './PricingTableScrollRegion';

function InlineLinks({ links }: { links: { label: string; href: LocalizedLinkHref }[] }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold">
      {links.map((link, index) => (
        <span key={`${link.label}-${link.href}`} className="inline-flex items-center gap-2">
          {index > 0 ? <span className="text-text-muted">·</span> : null}
          <Link href={link.href} prefetch={false} className="text-[#356BE8] hover:underline">
            {link.label}
          </Link>
        </span>
      ))}
    </div>
  );
}

function ImageEngineName({ row }: { row: Pick<ImagePricingRow, 'engine' | 'modelHref'> }) {
  return row.modelHref ? (
    <Link href={row.modelHref} prefetch={false} className="text-text-primary transition hover:text-[#356BE8] hover:underline">
      {row.engine}
    </Link>
  ) : (
    <span>{row.engine}</span>
  );
}

const readingNotes = {
  en: {
    imageQuote: (row: ImagePricingRow) => `One ${row.engine} image costs ${row.standardImage} with the standard preset or ${row.highQualityImage} with the high-quality preset shown below (USD).`,
    audioQuote: (mode: string, half: string, full: string) => `For ${mode}, MaxVideoAI quotes ${half} for 30 seconds and ${full} for 60 seconds (USD).`,
    image: 'Compare the cost of one image. Use the size and reference columns to check whether the model supports your source image and output dimensions.',
    audio: 'Compare 30, 60 and 120 seconds of audio. Read across one row to budget for the same voice-over or music mode at different lengths.',
    tools: 'Start with the output you need. For Character Recast, compare prices at the same source length, output length and resolution.',
  },
  fr: {
    imageQuote: (row: ImagePricingRow) => `Générer une image avec ${row.engine} coûte ${row.standardImage} avec le réglage standard ou ${row.highQualityImage} avec le réglage haute qualité du tableau.`,
    audioQuote: (mode: string, half: string, full: string) => `Pour « ${mode} », le devis MaxVideoAI est de ${half} pour 30 secondes et de ${full} pour 60 secondes.`,
    image: 'Comparez le prix d’une image. Les colonnes Taille et Références indiquent si le modèle accepte votre image source et le format de sortie souhaité.',
    audio: 'Comparez 30, 60 et 120 secondes d’audio. Sur une même ligne, vous voyez comment le budget évolue avec la durée d’une voix off ou d’une musique.',
    tools: 'Partez du résultat souhaité. Pour Character Recast, comparez les prix à durée de source, durée de sortie et résolution identiques.',
  },
  es: {
    imageQuote: (row: ImagePricingRow) => `Generar una imagen con ${row.engine} cuesta ${row.standardImage} con el ajuste estándar o ${row.highQualityImage} con el ajuste de alta calidad de la tabla.`,
    audioQuote: (mode: string, half: string, full: string) => `Para «${mode}», MaxVideoAI cotiza ${half} por 30 segundos y ${full} por 60 segundos.`,
    image: 'Compara el precio de una imagen. Las columnas de tamaño y referencias indican si el modelo admite tu imagen de origen y las dimensiones de salida.',
    audio: 'Compara 30, 60 y 120 segundos de audio. Sigue una misma fila para ver cómo cambia el coste de la locución o de la música con la duración.',
    tools: 'Empieza por el resultado que necesitas. Para Character Recast, compara precios con la misma duración de origen, duración de salida y resolución.',
  },
};

export function PricingOtherSurfacesSection({ data, locale }: { data: OtherSurfacePricingData; locale: AppLocale }) {
  const copy = getPricingHubCopy(locale);
  const notes = readingNotes[locale];
  const editorial = pricingOpeningCopy[locale];
  const imageExample = data.imageRows.find(row => row.id === 'gpt-image-2' && row.standardImage !== copy.liveQuote && row.highQualityImage !== copy.liveQuote);
  const voice = data.audioRows.find(row => row.id === 'audio-voice-only' && row.thirtySeconds !== copy.liveQuote && row.sixtySeconds !== copy.liveQuote);
  return (
    <section className={styles.surfaces} aria-labelledby="other-pricing-title">
      <div className={styles.sectionIntro}>
        <h2 id="other-pricing-title" className="text-2xl font-semibold tracking-normal text-text-primary">
          {editorial.surfaceTitle}
        </h2>
        <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-secondary">
          {copy.otherSurfaces.intro}
        </p>
      </div>

      <details id="image-pricing" className={`scroll-mt-24 sm:scroll-mt-28 ${styles.surface}`}>
        <summary className={styles.surfaceHead}>
          <span className={styles.thumb}><Image src="/assets/model-examples/seedream-5-0-pro/campaign.webp" width={280} height={120} sizes="(max-width: 760px) 78px, 360px" alt="" loading="lazy" /></span>
          <h3 id="image-pricing-title">{editorial.imageHead}</h3>
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className={styles.surfaceBody}><p className={styles.surfaceNote}>{imageExample ? notes.imageQuote(imageExample) : notes.image}</p>
        <PricingTableScrollRegion labelledBy="image-pricing-title" className="mt-4">
          <table className="min-w-[940px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                <th className="py-3 pr-4">{copy.otherSurfaces.imageColumns.engine}</th>
                <th className="px-4 py-3 text-right">{copy.otherSurfaces.imageColumns.standard}</th>
                <th className="px-4 py-3 text-right">{copy.otherSurfaces.imageColumns.highQuality}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.imageColumns.reference}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.imageColumns.sizes}</th>
                <th className="py-3 pl-4">{copy.otherSurfaces.imageColumns.links}</th>
              </tr>
            </thead>
            <tbody>
              {data.imageRows.map((row) => (
                <tr key={row.id} id={row.anchorId} className="scroll-mt-24 border-b border-hairline last:border-0">
                  <td className="py-3 pr-4 font-semibold text-text-primary">
                    <ImageEngineName row={row} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{row.standardImage}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{row.highQualityImage}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.reference}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.sizes}</td>
                  <td className="py-3 pl-4">
                    <InlineLinks links={row.links} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PricingTableScrollRegion>
        </div>
      </details>

      <details id="audio-pricing" className={`scroll-mt-24 sm:scroll-mt-28 ${styles.surface}`}>
        <summary className={styles.surfaceHead}>
          <span className={styles.thumb}><Image src="/assets/pricing/opal-waveform.webp" width={280} height={120} sizes="(max-width: 760px) 78px, 360px" alt="" loading="lazy" /></span>
          <h3 id="audio-pricing-title">{editorial.audioHead}</h3>
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className={styles.surfaceBody}><p className={styles.surfaceNote}>{voice ? notes.audioQuote(voice.mode, voice.thirtySeconds, voice.sixtySeconds) : notes.audio}</p>
        <PricingTableScrollRegion labelledBy="audio-pricing-title" className="mt-4">
          <table className="min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                <th className="py-3 pr-4">{copy.otherSurfaces.audioColumns.mode}</th>
                <th className="px-4 py-3 text-right">{copy.otherSurfaces.audioColumns.thirtySeconds}</th>
                <th className="px-4 py-3 text-right">{copy.otherSurfaces.audioColumns.sixtySeconds}</th>
                <th className="px-4 py-3 text-right">{copy.otherSurfaces.audioColumns.oneTwentySeconds}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.audioColumns.voiceClone}</th>
                <th className="py-3 pl-4">{copy.otherSurfaces.audioColumns.links}</th>
              </tr>
            </thead>
            <tbody>
              {data.audioRows.map((row) => (
                <tr key={row.id} id={row.anchorId} className="scroll-mt-24 border-b border-hairline last:border-0">
                  <td className="py-3 pr-4 font-semibold text-text-primary">{row.mode}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{row.thirtySeconds}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{row.sixtySeconds}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{row.oneTwentySeconds}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.voiceClone}</td>
                  <td className="py-3 pl-4">
                    <InlineLinks links={row.links} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PricingTableScrollRegion>
        </div>
      </details>

      <details id="tool-pricing" className={`scroll-mt-24 sm:scroll-mt-28 ${styles.surface}`}>
        <summary className={styles.surfaceHead}>
          <span className={styles.thumb}><Image src="/assets/tools/angle-orbit-hero-dialogue-elevated.webp" width={280} height={120} sizes="(max-width: 760px) 78px, 360px" alt="" loading="lazy" /></span>
          <h3 id="tool-pricing-title">{editorial.toolHead}</h3>
          <ChevronDown size={20} aria-hidden="true" />
        </summary>
        <div className={styles.surfaceBody}><p className={styles.surfaceNote}>{notes.tools}</p>
        <p className="mt-2 max-w-[760px] text-sm leading-6 text-text-secondary">
          {copy.otherSurfaces.characterImageNote}
        </p>
        <PricingTableScrollRegion labelledBy="tool-pricing-title" className="mt-4">
          <table className="min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-semibold uppercase tracking-normal text-text-muted">
                <th className="py-3 pr-4">{copy.otherSurfaces.toolColumns.tool}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.toolColumns.standard}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.toolColumns.pro}</th>
                <th className="px-4 py-3">{copy.otherSurfaces.toolColumns.bestUsedBefore}</th>
                <th className="py-3 pl-4">{copy.otherSurfaces.toolColumns.links}</th>
              </tr>
            </thead>
            <tbody>
              {data.toolRows.map((row) => (
                <tr key={row.id} id={row.anchorId} className="scroll-mt-24 border-b border-hairline last:border-0">
                  <td className="py-3 pr-4 font-semibold text-text-primary">{row.tool}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.standardOutput}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.proOutput}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.bestUsedBefore}</td>
                  <td className="py-3 pl-4">
                    <InlineLinks links={row.links} />
                  </td>
                </tr>
              ))}
              <tr id="character-recast-pricing" className="scroll-mt-24 border-b border-hairline last:border-0">
                <th scope="row" className="py-3 pr-4 font-semibold text-text-primary">{copy.tools.characterRecast}
                  <p className="mt-1 max-w-[240px] text-xs font-normal leading-5 text-text-secondary">{copy.otherSurfaces.recastPricingNote}</p>
                </th>
                {(['price720', 'price1080'] as const).map((key) => <td key={key} className="px-4 py-3 text-text-secondary">
                  <span className="text-xs font-semibold text-text-primary">{key === 'price720' ? '720p' : '1080p'}</span>
                  {data.recastExamples?.length ? data.recastExamples.map(example => <p key={example.outputSeconds} className="mt-2">
                    <strong className="block text-base tabular-nums text-text-primary">{example[key]}</strong>
                    <span className="text-xs">{copy.otherSurfaces.recastExample(example.outputSeconds, example.sourceSeconds)}</span>
                  </p>) : <p>{copy.liveQuote}</p>}
                </td>)}
                <td className="px-4 py-3 text-text-secondary">{copy.tools.recastUse}</td>
                <td className="py-3 pl-4">
                  <InlineLinks links={[
                    { label: copy.links.tool, href: { pathname: '/tools/character-builder', hash: 'recast' } },
                    { label: copy.links.livePrice, href: '/app/tools/character-builder?mode=recast' },
                  ]} />
                </td>
              </tr>
            </tbody>
          </table>
        </PricingTableScrollRegion>
        </div>
      </details>
    </section>
  );
}
