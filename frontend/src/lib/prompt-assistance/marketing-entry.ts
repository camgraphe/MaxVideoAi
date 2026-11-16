import type { AppLocale } from "@/i18n/locales";
/** A navigation hint only. Never carries a prompt, triggers a send or skips authentication. */
export const miloEntryHref = (locale: AppLocale) =>
  `/app?assistant=milo&lang=${locale}`;
export const isMiloEntry = (search: string) =>
  new URLSearchParams(search).get("assistant") === "milo";

/** A local welcome only: no assistant request or generation is sent on entry. */
export const isMiloRefineEntry = (search: string) =>
  isMiloEntry(search) && new URLSearchParams(search).get('refine') === 'example';

export function miloRefineWelcome(locale: string) {
  if (locale.startsWith('fr')) return { question: 'Que souhaites-tu modifier ?', placeholder: 'L’ambiance, la lumière, la composition…' };
  if (locale.startsWith('es')) return { question: '¿Qué quieres cambiar?', placeholder: 'El ambiente, la luz, la composición…' };
  return { question: 'What would you like to change?', placeholder: 'The mood, lighting, composition…' };
}
