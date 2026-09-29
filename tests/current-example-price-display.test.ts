import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCurrentExamplePrice } from '../frontend/lib/current-example-price-display.ts';
import { toGalleryCard } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts';
import { toExampleCard } from '../frontend/app/api/examples/route.ts';
import type { GalleryVideo } from '../frontend/server/videos.ts';
import React from 'react';
import enMessages from '../frontend/messages/en.json' with { type: 'json' };
import { HomeHero } from '../frontend/components/marketing/home/HomeHeroSection.tsx';
import { HeroVideoShowcase, type HeroVideoShowcaseItem } from '../frontend/components/marketing/home/HeroVideoShowcase.tsx';
import { buildHeroContent } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/hero.ts';
import type { RedesignContent } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/types.ts';

const video = {
  id: 'old-kling', engineId: 'kling-3-pro', engineLabel: 'Kling 3 Pro',
  durationSec: 5, finalPriceCents: 288, currency: 'USD', prompt: 'A short film',
} as GalleryVideo;

test('localized current example labels distinguish exact, reference and unavailable prices', () => {
  const exact = { kind: 'exact', amountCents: 141, currency: 'USD', modelId: 'kling-3-pro', scenarioLabel: 'Text to video · 5s · 1080p' } as const;
  const reference = { ...exact, kind: 'reference' } as const;
  assert.equal(formatCurrentExamplePrice(exact, 'en'), 'Current price $1.41');
  assert.equal(formatCurrentExamplePrice(reference, 'en'), 'From $1.41 · Text to video · 5s · 1080p');
  assert.match(formatCurrentExamplePrice(reference, 'fr') ?? '', /^Dès 1,41.* · Texte vers vidéo · 5 s · 1080p$/);
  assert.match(formatCurrentExamplePrice(reference, 'es') ?? '', /^Desde USD\s*1\.41 · Texto a vídeo · 5 s · 1080p$/);
  assert.equal(formatCurrentExamplePrice({ kind: 'unavailable', modelId: null }, 'en'), null);
});

test('model example card uses the current quote and never the paid historical amount', () => {
  const current = { kind: 'reference', amountCents: 141, currency: 'USD', modelId: 'kling-3-pro', scenarioLabel: 'Text to video · 5s · 1080p' } as const;
  const card = toGalleryCard(video, undefined, undefined, undefined, undefined, undefined, undefined, current, 'en');
  assert.equal(card.priceLabel, 'From $1.41 · Text to video · 5s · 1080p');
  assert.doesNotMatch(card.priceLabel ?? '', /2\.88/);
  assert.equal(toGalleryCard(video).priceLabel, null);
});

test('examples API card uses current quote without falling back to paid historical amount', () => {
  const current = { kind: 'exact', amountCents: 141, currency: 'USD', modelId: 'kling-3-pro', scenarioLabel: 'Text to video · 5s · 1080p' } as const;
  assert.equal(toExampleCard(video, 'en', current).priceLabel, 'Current price $1.41');
  assert.equal(toExampleCard(video, 'en').priceLabel, null);
});

test('homepage hero replaces authored prices with current reference quotes', () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const current = { kind: 'reference', amountCents: 141, currency: 'USD', modelId: 'minimax-h3-max', scenarioLabel: 'Text to video · 5s · 1080p' } as const;
  const home = HomeHero({
    copy: buildHeroContent('en', enMessages.home.redesign as RedesignContent),
    previews: [],
    currentHeroPrices: new Map([['minimax-h3-max', current]]),
  });
  const pending: React.ReactNode[] = [home];
  let items: HeroVideoShowcaseItem[] = [];
  while (pending.length) {
    const node = pending.shift();
    if (!React.isValidElement(node)) continue;
    if (node.type === HeroVideoShowcase) {
      items = (node.props as { items: HeroVideoShowcaseItem[] }).items;
      break;
    }
    pending.push(...React.Children.toArray((node.props as { children?: React.ReactNode }).children));
  }
  assert.equal(items[0]?.estimateValue, '$1.41');
  assert.equal(items[0]?.priceKind, 'reference');
  assert.equal(items[0]?.quoteScenario, 'Text to video · 5s · 1080p');
  assert.equal(items[1]?.priceKind, 'unavailable');
  assert.equal(items[1]?.estimateValue, 'Unavailable');
});
