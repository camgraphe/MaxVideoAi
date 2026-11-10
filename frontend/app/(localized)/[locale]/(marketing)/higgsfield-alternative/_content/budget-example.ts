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
    label: 'A MaxVideoAI example',
    settings: 'LTX 2.5 Pro · text to video · 10 s · 720p · audio off · no references',
    note: 'Starting with an empty media wallet and one completed render at the price checked on 10 November 2026. USD amounts; local checkout adjustments excluded. Other settings or another attempt require a new quote. This is a budget example, not the cost of the product image.',
    link: 'Check the price for these settings',
  },
  fr: {
    label: 'Un exemple chez MaxVideoAI',
    settings: 'LTX 2.5 Pro · texte vers vidéo · 10 s · 720p · sans son · sans référence',
    note: 'Portefeuille média initialement vide, avec un rendu terminé au prix relevé le 10 novembre 2026. Montants en USD, hors ajustements du paiement local. D’autres réglages ou un nouvel essai nécessitent un nouveau devis. Cet exemple de budget ne représente pas le coût de l’image produit.',
    link: 'Vérifier le prix de ces réglages',
  },
  es: {
    label: 'Un ejemplo en MaxVideoAI',
    settings: 'LTX 2.5 Pro · texto a vídeo · 10 s · 720p · sin sonido · sin referencias',
    note: 'Saldo de generación inicialmente vacío y un render completado al precio consultado el 10 de noviembre de 2026. Importes en USD, sin ajustes del pago local. Otros ajustes u otro intento requieren un nuevo presupuesto. Este ejemplo de presupuesto no representa el coste de la imagen del producto.',
    link: 'Consultar el precio de estos ajustes',
  },
} satisfies Record<AppLocale, { label: string; settings: string; note: string; link: string }>;

export function getBudgetExampleCopy(locale: AppLocale) { return copy[locale]; }
