import type { AppLocale } from "@/i18n/locales";
/** A navigation hint only. Never carries a prompt, triggers a send or skips authentication. */
export const miloEntryHref = (locale: AppLocale) =>
  `/app?assistant=milo&lang=${locale}`;
export const isMiloEntry = (search: string) =>
  new URLSearchParams(search).get("assistant") === "milo";
