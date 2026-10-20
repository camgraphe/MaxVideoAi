import type { EngineCaps, Mode, PreflightResponse } from '@/types/engines';
import { getLocalizedModeLabel } from '@/lib/ltx-localization';

export function isEngineModeRuntimeAvailable(engine: EngineCaps, mode: Mode): boolean {
  return engine.modeAvailability?.[mode]?.available !== false;
}

export function isEngineModeQuoteReady(engine: EngineCaps, mode: Mode, preflight: Pick<PreflightResponse, 'ok'> | null | undefined): boolean {
  return engine.id !== 'seedance-2-5' || mode !== 'v2v' || preflight?.ok === true;
}

export function getEngineModeUnavailableMessage(engine: EngineCaps | null, mode: Mode, locale = 'en'): string | null {
  if (!engine || isEngineModeRuntimeAvailable(engine, mode)) return null;
  const label = getLocalizedModeLabel(mode, locale);
  if (locale === 'fr') return `${engine.label} : le mode ${label} est temporairement indisponible. Choisissez un autre mode ou réessayez plus tard.`;
  if (locale === 'es') return `${engine.label}: el modo ${label} no está disponible temporalmente. Elige otro modo o inténtalo más tarde.`;
  return `${engine.label}: ${label} is temporarily unavailable. Choose another mode or try again later.`;
}
