import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

test('public prompt cards preserve model and price at rest, hover and keyboard focus', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'example-prompt-layout-'));
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const styles = new Map<string, string>();
  const output = join(directory, 'card.cjs');
  let browser;
  try {
    await build({
      stdin: { contents: `export {ExampleGalleryCard} from './frontend/components/examples/ExampleGalleryCard';`, resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', jsx: 'automatic',
      plugins: [{ name: 'real-card-styles', setup(builder) {
        builder.onLoad({ filter: /\.module\.css$/ }, async args => {
          const css = await readFile(args.path, 'utf8');
          styles.set(args.path, css);
          const names = [...css.matchAll(/\.([_a-zA-Z][\w-]*)/g)].map(match => match[1]);
          return { contents: `export default ${JSON.stringify(Object.fromEntries(names.map(name => [name, name])))}`, loader: 'js' };
        });
        builder.onResolve({ filter: /.*/ }, args => !args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/') && !args.path.startsWith('node:')
          ? { path: requireFrontend.resolve(args.path), external: true } : undefined);
      } }],
    });
    const { ExampleGalleryCard } = requireFrontend(output);
    const cards = ['lead', 'portrait', 'side', 'side'].map((frame, index) => React.createElement(ExampleGalleryCard, {
      key: index, frame, locale: 'fr', requested: false, prioritizePoster: false,
      altText: 'Public video', detailsCtaLabel: 'Voir prompt, réglages et prix',
      noPreviewLabel: '', audioAvailableLabel: 'Audio', onVisibility() {}, onIntent() {},
      video: { id: `public-${index}`, href: `/video/public-${index}`, engineLabel: 'MiniMax H3 Max', engineIconId: 'minimax-h3-max',
        prompt: 'Légende localisée', sourcePromptExcerpt: 'The camera follows the runner through the city at sunset.',
        aspectRatio: frame === 'portrait' ? '9:16' : '16:9', durationSec: 5, hasAudio: false, priceLabel: null },
    }));
    browser = await chromium.launch({ headless: true });
    for (const width of [320, 360, 390, 768, 1024, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      for (const price of [null, 'Dès 0,58 $US · Texte vers vidéo · 5 s · 480p']) {
        const models = width === 320
          ? [{ engineLabel: 'MiniMax H3 Max', engineIconId: 'minimax-h3-max' }, { engineLabel: 'Kling 3.0 Turbo Standard', engineIconId: 'kling-3-turbo-standard' }, { engineLabel: 'Seedance 2.0', engineIconId: 'seedance-2-0' }]
          : [{ engineLabel: 'MiniMax H3 Max', engineIconId: 'minimax-h3-max' }];
        for (const model of models) {
          const priced = cards.map(card => React.cloneElement(card, { priceSlot: price, video: { ...card.props.video, ...model } }));
          const html = renderToStaticMarkup(React.createElement('div', { className: 'opening' }, ...priced));
          await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif}.fixture{max-width:1180px;padding:0 20px;margin:auto}${[...styles.values()].join('\n')}</style><main class="fixture">${html}</main>`);
          for (const link of await page.locator('a[data-analytics-cta-name="view_example_details"]').all()) {
            for (const state of ['rest', 'focus', 'hover']) {
              if (state === 'rest') await page.mouse.click(0, 990);
              if (state === 'focus') await link.focus();
              if (state === 'hover') { await page.keyboard.press('Tab'); await link.hover(); }
              const boxes = await link.evaluate(anchor => {
                const card = anchor.getBoundingClientRect(), model = anchor.querySelector('strong')!.getBoundingClientRect();
                const price = anchor.querySelector('.priceSlot')!.getBoundingClientRect();
                return { top: card.top, bottom: card.bottom, modelTop: model.top, modelBottom: model.bottom, priceBottom: price.bottom };
              });
              assert.ok(boxes.modelTop >= boxes.top - 0.5 && boxes.modelBottom <= boxes.bottom + 0.5, `${width}px ${model.engineLabel} ${state}: the original model must remain fully readable: ${JSON.stringify(boxes)}`);
              assert.ok(boxes.priceBottom <= boxes.bottom + 0.5, 'reference prices must not be clipped to make room for prompts');
              assert.match(await link.getAttribute('aria-label') ?? '', /prompt.*The camera follows the runner/);
            }
          }
          assert.ok(await page.locator('[data-example-prompt]:visible').count() >= 2, 'visible excerpts remain available in the opening');
          if (width >= 390) assert.equal(await page.locator('[data-example-prompt]:visible').count(), 4);
          assert.equal(await page.locator('video').count(), 0, 'text changes must not start media playback');
          const evidence = process.env.EXAMPLES_PROMPT_LAYOUT_EVIDENCE_DIR;
          if (evidence && price) {
            await mkdir(evidence, { recursive: true });
            const name = model.engineIconId;
            await page.screenshot({ path: join(evidence, `prompt-prices-${width}-${name}.png`) });
            await writeFile(join(evidence, `prompt-prices-${width}-${name}.html`), await page.content());
          }
        }
      }
      await page.close();
    }
  } finally { await browser?.close(); await rm(directory, { recursive: true, force: true }); }
});
