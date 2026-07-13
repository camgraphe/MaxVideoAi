import { listFalEngines } from '@/config/falEngines';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import { computeCanonicalPublicSnapshot } from '@/server/pricing/quote-public';

export type McpProof = {
  posterSrc: string;
  videoSrc: string;
  alt: string;
  badge: string;
  caption: string;
  engineId: string;
  mode: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
  amountCents: number;
  currency: string;
  verifiedAt: string;
};

const proofCopy: Record<AppLocale, { alt: string; caption: (price: string) => string }> = {
  en: {
    alt: 'Close portrait from an eight-second Google Veo 3.1 public marketing render verified as a real MaxVideoAI output.',
    caption: (price) =>
      `Real MaxVideoAI output from Google Veo 3.1: 8 seconds, 16:9, 720p. The source mode and historical charge were not recorded. Current canonical 8-second, 720p price snapshot: ${price}.`,
  },
  fr: {
    alt: 'Portrait rapproché tiré d’une vidéo marketing publique Google Veo 3.1 de huit secondes, vérifiée comme une sortie MaxVideoAI réelle.',
    caption: (price) =>
      `Sortie MaxVideoAI réelle avec Google Veo 3.1 : 8 secondes, 16:9, 720p. Le mode source et le montant historique n’ont pas été enregistrés. Tarif canonique actuel pour 8 secondes en 720p : ${price}.`,
  },
  es: {
    alt: 'Primer plano de un video público de marketing de Google Veo 3.1 de ocho segundos, verificado como una salida real de MaxVideoAI.',
    caption: (price) =>
      `Salida real de MaxVideoAI con Google Veo 3.1: 8 segundos, 16:9, 720p. No se registraron el modo de origen ni el importe histórico. Precio canónico actual para 8 segundos en 720p: ${price}.`,
  },
};

export async function getMcpProof(locale: AppLocale): Promise<McpProof> {
  const engine = listFalEngines().find((candidate) => candidate.id === 'veo-3-1');
  if (!engine) {
    throw new Error('The veo-3-1 engine is required for the verified MCP proof fallback.');
  }

  // This is a current, reproducible pricing scenario. It is not evidence of the
  // unknown source mode or historical charge for the registered marketing render.
  const price = await computeCanonicalPublicSnapshot({
    engine: engine.engine,
    durationSec: 8,
    resolution: '720p',
    aspectRatio: '16:9',
    mode: 't2v',
    membershipTier: 'member',
  });
  const priceLabel = new Intl.NumberFormat(localeRegions[locale], {
    style: 'currency',
    currency: price.currency,
  }).format(price.totalCents / 100);

  return {
    posterSrc: '/mcp/mcp-result-poster.webp',
    videoSrc: '/mcp/mcp-result.mp4',
    alt: proofCopy[locale].alt,
    badge: 'Real MaxVideoAI output',
    caption: proofCopy[locale].caption(priceLabel),
    engineId: 'veo-3-1',
    mode: 'source-mode-unverified',
    durationSeconds: 8,
    aspectRatio: '16:9',
    resolution: '720p',
    amountCents: price.totalCents,
    currency: price.currency,
    verifiedAt: '2026-07-14',
  };
}
