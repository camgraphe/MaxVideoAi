'use client';

import { useEffect, useRef, useState } from 'react';
import { clearTurnstileDeploymentPin, readTurnstileClientStatus } from '@/lib/turnstile-client';

const recoveryCopy = {
  en: { checking: 'Checking security verification…', reload: 'Security verification has changed. Save any unfinished work, then reload this page to continue.', reloadButton: 'Reload page', reloadFailed: 'The page could not be updated. Please retry.', unavailable: 'Security verification is unavailable. Please retry.', retryButton: 'Retry verification' },
  fr: { checking: 'Vérification de sécurité…', reload: 'La vérification de sécurité a été mise à jour. Enregistrez votre travail en cours, puis rechargez cette page pour continuer.', reloadButton: 'Recharger la page', reloadFailed: 'La page n’a pas pu être mise à jour. Veuillez réessayer.', unavailable: 'La vérification de sécurité est indisponible. Veuillez réessayer.', retryButton: 'Réessayer la vérification' },
  es: { checking: 'Comprobando la verificación de seguridad…', reload: 'La verificación de seguridad ha cambiado. Guarda tu trabajo pendiente y recarga esta página para continuar.', reloadButton: 'Recargar la página', reloadFailed: 'No se pudo actualizar la página. Inténtalo de nuevo.', unavailable: 'La verificación de seguridad no está disponible. Inténtalo de nuevo.', retryButton: 'Reintentar la verificación' },
};

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: 'auto' | 'light' | 'dark';
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove?: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileChallenge({
  siteKey,
  onToken,
  onError,
  resetGeneration,
  locale = 'en',
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  onError: () => void;
  resetGeneration: number;
  locale?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const refreshConfigurationRef = useRef<(() => void) | null>(null);
  const reloadControllerRef = useRef<AbortController | null>(null);
  const [reloading, setReloading] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const [status, setStatus] = useState<'checking' | 'ready' | 'reload' | 'unavailable'>('checking');
  const [configurationGeneration, setConfigurationGeneration] = useState(0);
  const copy = recoveryCopy[locale === 'fr' || locale === 'es' ? locale : 'en'];

  useEffect(() => () => {
    reloadControllerRef.current?.abort();
    reloadControllerRef.current = null;
  }, []);

  async function reloadCurrentRelease() {
    if (reloadControllerRef.current) return;
    const controller = new AbortController();
    reloadControllerRef.current = controller;
    setReloading(true);
    setReloadFailed(false);
    const timeout = setTimeout(() => controller.abort(), 5000);
    const cleared = await clearTurnstileDeploymentPin(controller.signal);
    clearTimeout(timeout);
    if (reloadControllerRef.current !== controller) return;
    reloadControllerRef.current = null;
    if (cleared) {
      const target = new URL(window.location.href);
      if (target.searchParams.has('dpl')) {
        target.searchParams.delete('dpl');
        window.history.replaceState(window.history.state, '', target.href);
      }
      window.location.reload();
    } else {
      setReloading(false);
      setReloadFailed(true);
    }
  }

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') refreshConfigurationRef.current?.(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;
    let cancelled = false;
    let configurationAccepted = false;
    let configurationCheck = 0;
    let validInstance = false;
    let widgetId: string | null = null;
    let script: HTMLScriptElement | null = null;
    let scriptTimeout: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let configTimeout: ReturnType<typeof setTimeout> | undefined;
    const container = containerRef.current;
    setStatus('checking');
    onToken(null);
    const fail = () => {
      if (cancelled || !configurationAccepted) return;
      validInstance = false;
      if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId);
      widgetId = null;
      setStatus('unavailable');
      onError();
    };
    const renderWidget = () => {
      if (cancelled || !configurationAccepted || widgetId || !window.turnstile || !container.isConnected) return;
      clearTimeout(scriptTimeout);
      validInstance = true;
      try {
        widgetId = window.turnstile.render(container, {
          sitekey: siteKey,
          theme: 'auto',
          callback: (token) => { if (!cancelled && configurationAccepted && validInstance) onToken(token); },
          'expired-callback': () => { if (!cancelled && validInstance) onToken(null); },
          'error-callback': fail,
        });
        if (validInstance) setStatus('ready');
        else if (widgetId) { window.turnstile.remove?.(widgetId); widgetId = null; }
      } catch { fail(); }
    };
    const scriptError = () => { script?.remove(); fail(); };

    async function checkConfiguration() {
      const check = ++configurationCheck;
      controller?.abort();
      clearTimeout(configTimeout);
      const requestController = new AbortController();
      controller = requestController;
      configTimeout = setTimeout(() => requestController.abort(), 5000);
      const result = await readTurnstileClientStatus(siteKey, requestController.signal);
      if (cancelled || check !== configurationCheck) return;
      clearTimeout(configTimeout);
      controller = null;
      if (result !== 'accepted') {
        configurationAccepted = false;
        validInstance = false;
        clearTimeout(scriptTimeout);
        if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId);
        widgetId = null;
        onToken(null);
        setStatus(result);
        if (result === 'unavailable') onError();
        return;
      }
      configurationAccepted = true;
      // Leaving Cloudflare's iframe also focuses the parent window. Recheck
      // eligibility without replacing an accepted widget or its fresh token.
      if (widgetId) return;
      setStatus('checking');
      if (window.turnstile) { renderWidget(); return; }
      if (script) {
        clearTimeout(scriptTimeout);
        scriptTimeout = setTimeout(scriptError, 10000);
        return;
      }
      script = document.getElementById('cf-turnstile-api') as HTMLScriptElement | null;
      const newScript = !script;
      script ??= document.createElement('script');
      script.id = 'cf-turnstile-api';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.addEventListener('load', renderWidget);
      script.addEventListener('error', scriptError);
      scriptTimeout = setTimeout(scriptError, 10000);
      if (newScript) document.head.appendChild(script);
    }
    const refreshConfiguration = () => { void checkConfiguration(); };
    refreshConfigurationRef.current = refreshConfiguration;
    refreshConfiguration();

    return () => {
      cancelled = true;
      configurationAccepted = false;
      validInstance = false;
      controller?.abort();
      if (refreshConfigurationRef.current === refreshConfiguration) refreshConfigurationRef.current = null;
      clearTimeout(configTimeout);
      clearTimeout(scriptTimeout);
      script?.removeEventListener('load', renderWidget);
      script?.removeEventListener('error', scriptError);
      if (widgetId && window.turnstile?.remove) window.turnstile.remove(widgetId);
    };
  }, [configurationGeneration, onError, onToken, resetGeneration, siteKey]);

  return <div>
    <div ref={containerRef} className="min-h-[65px]" hidden={status === 'reload' || status === 'unavailable'} />
    {status !== 'ready' ? <p role="status" className="text-sm text-text-secondary">{status === 'checking' ? copy.checking : status === 'reload' ? copy.reload : copy.unavailable}</p> : null}
    {reloadFailed ? <p role="alert" className="text-sm text-text-secondary">{copy.reloadFailed}</p> : null}
    {status === 'reload' || status === 'unavailable' ? <button type="button" disabled={reloading} className="mt-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold" onClick={() => {
      if (status === 'reload') void reloadCurrentRelease();
      else setConfigurationGeneration(value => value + 1);
    }}>{status === 'reload' ? copy.reloadButton : copy.retryButton}</button> : null}
  </div>;
}
