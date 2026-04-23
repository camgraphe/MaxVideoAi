'use client';

import { useEffect, useState } from 'react';

type DeferredSourcePromptProps = {
  locale: string;
  prompt: string;
  mode?: 'inline' | 'details';
  className?: string;
  summaryClassName?: string;
  promptClassName?: string;
  fallbackClassName?: string;
  summaryLabel?: string;
  fallbackText?: string;
};

function getSummaryLabel(locale: string): string {
  if (locale === 'fr') return 'Prompt source (anglais)';
  if (locale === 'es') return 'Prompt original (inglés)';
  return 'Source prompt';
}

function getFallbackText(locale: string, mode: 'inline' | 'details'): string {
  if (locale === 'fr') {
    return mode === 'details'
      ? 'Le prompt source en anglais s’affiche après le chargement de la page.'
      : 'Prompt source en anglais disponible après chargement.';
  }
  if (locale === 'es') {
    return mode === 'details'
      ? 'El prompt original en inglés aparece después de cargar la página.'
      : 'Prompt original en inglés disponible tras la carga.';
  }
  return mode === 'details'
    ? 'The source prompt appears after the page finishes loading.'
    : 'Source prompt available after load.';
}

export function DeferredSourcePrompt({
  locale,
  prompt,
  mode = 'details',
  className,
  summaryClassName,
  promptClassName,
  fallbackClassName,
  summaryLabel,
  fallbackText,
}: DeferredSourcePromptProps) {
  const [isReady, setIsReady] = useState(locale === 'en');

  useEffect(() => {
    if (locale === 'en') return;
    setIsReady(true);
  }, [locale]);

  if (!isReady) {
    return <p className={fallbackClassName}>{fallbackText ?? getFallbackText(locale, mode)}</p>;
  }

  if (mode === 'inline') {
    return (
      <p lang="en" className={promptClassName}>
        {prompt}
      </p>
    );
  }

  return (
    <details className={className}>
      <summary className={summaryClassName}>{summaryLabel ?? getSummaryLabel(locale)}</summary>
      <p lang="en" className={promptClassName}>
        {prompt}
      </p>
    </details>
  );
}
