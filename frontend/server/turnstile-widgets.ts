type TurnstileWidget = {
  generation: 'legacy' | 'secondary';
  siteKey: string;
  secret: string;
};

export type TurnstileConfiguration =
  | { kind: 'ready'; activeSiteKey: string; widgets: TurnstileWidget[] }
  | { kind: 'disabled' | 'unconfigured' | 'invalid' };

/** Keep the legacy binding independent of the key compiled into new browser bundles. */
export function getTurnstileConfiguration(env: NodeJS.ProcessEnv = process.env): TurnstileConfiguration {
  const activeSiteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
  const secret = env.TURNSTILE_SECRET_KEY?.trim() ?? '';
  const legacySiteKey = env.TURNSTILE_LEGACY_SITE_KEY?.trim() ?? '';
  const secondarySiteKey = env.TURNSTILE_SECONDARY_SITE_KEY?.trim() ?? '';
  const secondarySecret = env.TURNSTILE_SECONDARY_SECRET_KEY?.trim() ?? '';
  const transitioning = Boolean(legacySiteKey || secondarySiteKey || secondarySecret);
  const mode = (env.CHECKOUT_CAPTCHA_MODE ?? 'progressive').trim().toLowerCase();
  if (['off', 'disabled', 'false'].includes(mode)) {
    return { kind: transitioning ? 'invalid' : 'disabled' };
  }
  if (!activeSiteKey && !secret && !transitioning) return { kind: 'unconfigured' };
  if (!activeSiteKey || !secret) return { kind: 'invalid' };
  if (!transitioning) return { kind: 'ready', activeSiteKey, widgets: [{ generation: 'legacy', siteKey: activeSiteKey, secret }] };
  if (!legacySiteKey || !secondarySiteKey || !secondarySecret || legacySiteKey === secondarySiteKey ||
      secret === secondarySecret || ![legacySiteKey, secondarySiteKey].includes(activeSiteKey)) {
    return { kind: 'invalid' };
  }
  return { kind: 'ready', activeSiteKey, widgets: [
    { generation: 'legacy', siteKey: legacySiteKey, secret },
    { generation: 'secondary', siteKey: secondarySiteKey, secret: secondarySecret },
  ] };
}

/** Absence alone identifies pre-migration clients. A supplied invalid hint never falls back. */
export function selectTurnstileWidget(config: TurnstileConfiguration, siteKey: unknown): TurnstileWidget | null {
  if (config.kind !== 'ready') return null;
  if (siteKey === undefined) return config.widgets[0];
  if (typeof siteKey !== 'string' || !siteKey.trim() || siteKey.length > 256) return null;
  return config.widgets.find(widget => widget.siteKey === siteKey.trim()) ?? null;
}

export function getPublicTurnstileConfiguration() {
  const config = getTurnstileConfiguration();
  return config.kind === 'ready'
    ? { configured: true, activeSiteKey: config.activeSiteKey, widgets: config.widgets.map(({ generation, siteKey }) => ({ generation, siteKey })) }
    : { configured: false, activeSiteKey: '', widgets: [] };
}
