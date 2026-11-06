import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test, { after, before } from 'node:test';
import { JSDOM } from 'jsdom';
import React, { createElement, type ComponentProps } from 'react';
import { Link } from '../frontend/i18n/navigation';
import { locales } from '../frontend/i18n/locales';

const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
before(() => { Object.defineProperty(globalThis, 'React', { configurable: true, value: React }); });
after(() => {
  if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
  else Reflect.deleteProperty(globalThis, 'React');
});

const requireFrontend = createRequire(resolve('frontend/package.json'));
const { renderToStaticMarkup } = requireFrontend('react-dom/server');
const { NextIntlClientProvider } = requireFrontend('next-intl');
const NextLink = requireFrontend('next/link').default;
type Props = ComponentProps<typeof Link>;

const destinations: Props['href'][] = [
  '/', '/pricing', '/en/pricing', '/fr/galerie', '/app', '/video/preview',
  { pathname: '/examples/[model]', params: { model: 'kling' }, query: { source: 'home', page: 2 } },
  { pathname: '/models/[slug]', params: { slug: 'flux-3' } },
  { pathname: '/pricing', query: { plan: 'starter' }, hash: 'faq' },
  { pathname: '/examples', hash: 'character-studio' },
  { pathname: '/tools/character-builder', hash: 'recast' },
  '#compare', '/mcp#claude', 'https://example.com/pricing', '//example.com/pricing',
  { protocol: 'https:', host: 'example.com', pathname: '/pricing' },
];

for (const locale of locales) {
  test(`Character Studio proof links use the canonical localized path and preserve their section in ${locale}`, () => {
    const paths = { en: ['/examples', '/tools/character-builder'], fr: ['/fr/galerie', '/fr/outils/character-builder'], es: ['/es/galeria', '/es/herramientas/character-builder'] };
    for (const [index, href] of [{ pathname: '/examples', hash: 'character-studio' }, { pathname: '/tools/character-builder', hash: 'recast' }].entries()) {
      const html = renderToStaticMarkup(createElement(Link, { currentLocale: locale, href, children: 'Open' }));
      assert.equal(JSDOM.fragment(html).querySelector('a')?.getAttribute('href'), `${paths[locale][index]}#${href.hash}`);
    }
  });
  test(`published links preserve the router's rendered URLs and attributes in ${locale}`, () => {
    for (const href of destinations) {
      const props: Props = { href, rel: 'noreferrer', hrefLang: 'en', prefetch: false, children: 'Open' };
      const attributes = (linkProps: Props) => {
        const html = renderToStaticMarkup(createElement(
          NextIntlClientProvider, { locale, messages: {}, timeZone: 'UTC' }, createElement(Link, linkProps),
        ));
        const anchor = JSDOM.fragment(html).querySelector('a')!;
        return Object.fromEntries(Array.from(anchor.attributes, attr => [attr.name, attr.value]));
      };
      assert.deepEqual(attributes({ ...props, currentLocale: locale }), attributes(props), JSON.stringify(href));
      assert.equal(Link({ ...props, currentLocale: locale }).type, NextLink);
    }
    const changeLocale = { href: '/pricing', locale: locale === 'fr' ? 'es' : 'fr', children: 'Switch language' };
    assert.equal(Link({ ...changeLocale, currentLocale: locale }).type, Link(changeLocale).type);
  });
}
