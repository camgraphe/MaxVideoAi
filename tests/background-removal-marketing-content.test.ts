import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readLocale(locale: 'en' | 'fr' | 'es') {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), `frontend/messages/${locale}.json`), 'utf8')) as {
    toolMarketing: {
      backgroundRemoval?: {
        meta?: { title?: string; description?: string; keywords?: string[]; imageAlt?: string };
        hero?: { title?: string; body?: string; primaryCta?: string; secondaryCta?: string };
        modelGuide?: { rows?: Array<{ model?: string; bestFor?: string; price?: string; useWhen?: string }> };
        faq?: Array<{ q?: string; a?: string }>;
      };
      hub?: unknown;
    };
  };
}

test('background removal marketing copy is complete in every locale', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = readLocale(locale).toolMarketing.backgroundRemoval;
    assert.ok(copy?.meta?.title, `${locale} title`);
    assert.ok(copy?.meta?.description, `${locale} description`);
    assert.ok(copy?.meta?.keywords?.length, `${locale} keywords`);
    assert.ok(copy?.meta?.imageAlt, `${locale} image alt`);
    assert.ok(copy?.hero?.title, `${locale} hero title`);
    assert.ok(copy?.hero?.body, `${locale} hero body`);
    assert.ok(copy?.modelGuide?.rows?.some((row) => row.model), `${locale} model guide rows`);
    assert.ok((copy?.faq?.length ?? 0) >= 4, `${locale} FAQ`);
  }
});

test('background removal marketing copy does not expose supplier, multiplier, or margin wording', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = readLocale(locale).toolMarketing.backgroundRemoval;
    assert.doesNotMatch(JSON.stringify(copy), /\bfal(?:\.ai|-ai|\s+ai)?\b|bria|vrmbg|provider|fournisseur|proveedor|2x|margin|marge|margen/i);
  }

  const toolsWorkspaceSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/src/components/tools/ToolsWorkspacePage.tsx'),
    'utf8'
  );
  assert.doesNotMatch(toolsWorkspaceSource, /"backgroundRemovalBody":\s*"[^"]*(?:bria|vrmbg|provider|2x|margin)[^"]*"/i);
});

test('background removal user-facing copy no longer advertises ProRes export', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = readLocale(locale).toolMarketing.backgroundRemoval;
    assert.doesNotMatch(JSON.stringify(copy), /prores|mov prores|7[- ]?day|7 jours|7 dias/i);
  }

  for (const relativePath of [
    'frontend/src/components/tools/ToolsWorkspacePage.tsx',
    'frontend/src/components/tools/background-removal/_lib/background-removal-workspace-copy.ts',
    'frontend/src/components/tools/background-removal/_components/BackgroundRemovalSettingsPanel.tsx',
    'frontend/src/lib/tools-background-removal.ts',
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
    assert.doesNotMatch(source, /ProRes|prores|mov_proresks|7[- ]?day|7 jours|7 dias/i, relativePath);
  }
});

test('background removal landing uses shared JSON-LD helpers and app screenshots', () => {
  const wrapper = fs.readFileSync(
    path.join(process.cwd(), 'frontend/src/components/tools/BackgroundRemovalLandingPage.tsx'),
    'utf8'
  );
  const view = fs.readFileSync(
    path.join(process.cwd(), 'frontend/src/components/tools/background-removal/landing/BackgroundRemovalLandingView.tsx'),
    'utf8'
  );
  const route = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(localized)/[locale]/(marketing)/tools/background-removal/page.tsx'),
    'utf8'
  );

  assert.match(wrapper, /BackgroundRemovalLandingView/);
  assert.match(view, /buildToolBreadcrumbJsonLd/);
  assert.match(view, /buildToolHowToJsonLd/);
  assert.match(route, /image: '\/assets\/tools\/background-removal-hero-before-after\.webp'/);
});
