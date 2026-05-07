'use client';

import { useEffect, useRef } from 'react';

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
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    let cancelled = false;
    let widgetId: string | null = null;
    const container = containerRef.current;

    const renderWidget = () => {
      if (cancelled || widgetId || !window.turnstile || !container.isConnected) return;
      widgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': onError,
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById('cf-turnstile-api') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = 'cf-turnstile-api';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderWidget);
      script.addEventListener('error', onError);
      return () => {
        cancelled = true;
        script?.removeEventListener('load', renderWidget);
        script?.removeEventListener('error', onError);
        if (widgetId && window.turnstile?.remove) {
          window.turnstile.remove(widgetId);
        }
      };
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [onError, onToken, siteKey]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}
