import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

type UpscaleModelGuideEntry = {
  model: string;
  bestFor: string;
  quality: string;
  price: string;
  useWhen: string;
};

function readLocale(locale: 'en' | 'fr' | 'es') {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), `frontend/messages/${locale}.json`), 'utf8')) as {
    toolMarketing: {
      upscale: {
        meta?: {
          description?: string;
          keywords?: string[];
        };
        hero?: {
          body?: string;
          stats?: Array<{ label?: string; value?: string }>;
        };
        models?: {
          title?: string;
        };
        modelGuide?: {
          eyebrow?: string;
          title?: string;
          body?: string;
          columns?: {
            model?: string;
            bestFor?: string;
            quality?: string;
            price?: string;
            useWhen?: string;
          };
          rows?: UpscaleModelGuideEntry[];
        };
      };
    };
  };
}

test('upscale marketing explains model fit, quality, and MaxVideoAI pricing in every locale', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const guide = readLocale(locale).toolMarketing.upscale.modelGuide;

    assert.ok(guide?.title, `${locale} should expose a model guide title`);
    assert.ok(guide?.body?.toLowerCase().includes('maxvideoai'), `${locale} should mention MaxVideoAI pricing context`);
    assert.deepEqual(Object.keys(guide?.columns ?? {}), ['model', 'bestFor', 'quality', 'price', 'useWhen']);
    assert.equal(guide?.rows?.length, 4, `${locale} should compare four model routes`);

    for (const model of ['SeedVR2', 'Topaz', 'FlashVSR', 'Recraft']) {
      assert.equal(
        guide?.rows?.some((entry) => entry.model.includes(model)),
        true,
        `${locale} should include ${model}`
      );
    }

    guide?.rows?.forEach((entry) => {
      assert.ok(entry.bestFor.length > 10, `${locale} ${entry.model} should explain fit`);
      assert.ok(entry.quality.length > 6, `${locale} ${entry.model} should explain quality`);
      assert.ok(entry.price.length > 6, `${locale} ${entry.model} should explain price`);
      assert.ok(entry.useWhen.length > 10, `${locale} ${entry.model} should explain when to use it`);
    });
  }
});

test('upscale marketing copy does not expose provider implementation branding', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const upscale = readLocale(locale).toolMarketing.upscale;
    assert.doesNotMatch(JSON.stringify(upscale).toLowerCase(), /fal(?:\.ai|-ai|\s+ai)?/);
  }
});

test('upscale landing renders the model guide table', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'frontend/src/components/tools/UpscaleLandingPage.tsx'), 'utf8');

  assert.match(source, /content\.modelGuide/);
  assert.match(source, /modelGuide\.rows\.map/);
});

test('upscale landing hero uses app screenshots with default preview media in light and dark mode', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'frontend/src/components/tools/UpscaleLandingPage.tsx'), 'utf8');
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(localized)/[locale]/(marketing)/tools/upscale/page.tsx'),
    'utf8'
  );

  assert.match(source, /upscale-hero-app-light\.webp/);
  assert.match(source, /upscale-hero-app-dark\.webp/);
  assert.match(source, /role="img"/);
  assert.match(source, /aria-label=\{imageAlt\}/);
  assert.doesNotMatch(source, /SOURCE_IMAGE_URL|OUTPUT_IMAGE_URL/);
  assert.doesNotMatch(source, /hero\.studioLabel|hero\.stackLabel/);
  assert.doesNotMatch(source, /<HeroVisual imageAlt=\{content\.meta\.imageAlt\} hero=/);
  assert.match(pageSource, /image: '\/assets\/tools\/upscale-hero-app-light\.webp'/);
});
