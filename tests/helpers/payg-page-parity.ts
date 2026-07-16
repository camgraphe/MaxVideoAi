import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppLocale } from '../../frontend/i18n/locales.ts';
import { I18nProvider } from '../../frontend/lib/i18n/I18nProvider.tsx';
import { buildMetadataUrls } from '../../frontend/lib/metadataUrls.ts';
import { PayAsYouGoPageView } from '../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPageView.tsx';
import { buildPayAsYouGoPageData, PAYG_PAGE_PATH } from '../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts';
import { buildPayAsYouGoBreadcrumbJsonLd, buildPayAsYouGoServiceJsonLd, buildPayAsYouGoWebApplicationJsonLd } from '../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-jsonld.ts';
import type { PayAsYouGoShowcaseVideo } from '../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-video-showcase.ts';
import { generateMetadata } from '../../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/page.tsx';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

export const PAYG_PARITY_LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];

export const PAYG_SHOWCASE_FIXTURE: PayAsYouGoShowcaseVideo[] = [{
  id: 'parity-video',
  engineId: 'kling-3-pro',
  engineLabel: 'Kling 3 Pro',
  priceLabel: '$1.23',
  durationLabel: '8s',
  title: 'Deterministic showcase title',
  useCase: 'Deterministic showcase use case.',
  posterUrl: 'https://assets.example/payg-parity.jpg',
  href: '/video/parity-video?from=%2Fpay-as-you-go-ai-video-generator',
}];

export type PaygSemanticManifest = {
  metadata: unknown;
  jsonLd: { breadcrumb: unknown; service: unknown; webApplication: unknown };
  sectionOpenings: string[];
  headings: string[];
  textNodes: string[];
  tableCells: string[];
  links: Array<{ href: string; text: string }>;
  mediaLabels: string[];
  showcasePresent: boolean;
};

function values(pattern: RegExp, html: string, group = 1): string[] {
  return [...html.matchAll(pattern)].map((match) => match[group] ?? '');
}

function text(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function semanticHtml(html: string) {
  return {
    sectionOpenings: values(/<(header|section)([^>]*)>/g, html, 0),
    headings: values(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g, html).map(text),
    textNodes: values(/>([^<>]+)</g, html).map(text).filter(Boolean),
    tableCells: values(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g, html).map(text),
    links: [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({ href: match[1], text: text(match[2]) })),
    mediaLabels: values(/(?:aria-label|alt)="([^"]*)"/g, html),
    showcasePresent: html.includes('parity-video'),
  };
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function captureCurrentPaygManifest(
  locale: AppLocale,
  videos: PayAsYouGoShowcaseVideo[],
): Promise<PaygSemanticManifest> {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const data = buildPayAsYouGoPageData(locale);
    const markup = renderToStaticMarkup(React.createElement(
      I18nProvider,
      { locale, dictionary: {}, fallback: {} },
      React.createElement(PayAsYouGoPageView, { locale, data, showcaseVideos: videos }),
    ));
    const canonical = buildMetadataUrls(locale, undefined, { englishPath: PAYG_PAGE_PATH }).canonical;
    return {
      metadata: plain(await generateMetadata({ params: Promise.resolve({ locale }) })),
      jsonLd: plain({
        breadcrumb: buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale }),
        service: buildPayAsYouGoServiceJsonLd({ canonical, locale }),
        webApplication: buildPayAsYouGoWebApplicationJsonLd({ canonical, locale }),
      }),
      ...semanticHtml(markup),
    };
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
}
