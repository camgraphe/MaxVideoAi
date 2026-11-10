import type { AppLocale } from '@/i18n/locales';
import { projectCostExample, projectAttemptBudget } from '@/lib/marketing/project-cost-example';

// Dated public-price observation, not a live quote or a competing-platform price.
// Verified against /pricing#ltx-2-5-pro-pricing and the PAYG 10s/720p example.
export const budgetExample = {
  checked: projectCostExample.checked,
  amountsCents: [projectCostExample.initialFundingCents, projectCostExample.unitCents, projectAttemptBudget(1).remainingCents],
  pricePath: projectCostExample.pricePath,
  priceFragment: projectCostExample.priceFragment,
} as const;

const copy = {
  en: {
    label: 'MaxVideoAI · one-clip budget',
    settings: 'LTX 2.5 Pro · text to video · 10 s · 720p · audio off · no references',
    note: 'Simulation for one completed LTX clip, starting with an empty wallet. Price checked on 10 November 2026, in USD, before checkout taxes or conversion. Change the settings to get a new quote.',
    link: 'Check the price for these settings',
  },
  fr: {
    label: 'MaxVideoAI · le budget d’un clip',
    settings: 'LTX 2.5 Pro · texte vers vidéo · 10 s · 720p · sans son · sans référence',
    note: 'Simulation pour un clip LTX terminé, avec un portefeuille initialement vide. Tarif relevé le 10 novembre 2026 en USD, hors taxes et conversion au paiement. Modifiez les réglages pour obtenir un nouveau devis.',
    link: 'Vérifier le prix de ces réglages',
  },
  es: {
    label: 'MaxVideoAI · presupuesto de un clip',
    settings: 'LTX 2.5 Pro · texto a vídeo · 10 s · 720p · sin sonido · sin referencias',
    note: 'Simulación de un clip LTX completado con saldo inicial vacío. Precio consultado el 10 de noviembre de 2026 en USD, antes de impuestos y conversión. Cambia los ajustes para obtener un nuevo precio.',
    link: 'Consultar el precio de estos ajustes',
  },
} satisfies Record<AppLocale, { label: string; settings: string; note: string; link: string }>;

export function getBudgetExampleCopy(locale: AppLocale) { return copy[locale]; }
