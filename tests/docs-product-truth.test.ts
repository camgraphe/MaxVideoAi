import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { docs as fallbackDocs } from '../frontend/lib/i18n/dictionary-data/en-content.ts';

const localizedDocs = ['en', 'fr', 'es'].map((locale) => ({
  locale,
  docs: JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8')).docs,
}));

test('Docs does not promise an unimplemented workspace content-review service', () => {
  for (const { locale, docs } of localizedDocs) {
    const serialized = JSON.stringify(docs);
    assert.doesNotMatch(
      serialized,
      /allowlists?|quarantin|quarantaine|cuarentena|human review|revue humaine|revisión humana|audit trail|piste d.audit|trazabilidad|restricted keywords|mots.clés restreints|palabras clave restringidas/iu,
      `${locale}: safety copy must describe implemented provider checks, not a workspace review product`,
    );
    assert.equal(docs.sections.length, 5, `${locale}: preserve docs navigation sections`);
    assert.equal(docs.sections[3].items.length, 3, `${locale}: retain usable safety guidance`);
    assert.equal(docs.safetyQuick.items.length, 3, `${locale}: retain practical input/error guidance`);
  }
});

test('Docs onboarding and MCP guidance reflect available product paths', () => {
  for (const { locale, docs } of localizedDocs) {
    assert.doesNotMatch(JSON.stringify(docs.onboardingChecklist), /brand brief|brief de mar(?:que|ca)|1–3/iu);
    assert.equal(docs.onboardingChecklist.items.length, 3);
    assert.equal(docs.mcpGuide.href, `${locale === 'en' ? '' : `/${locale}`}/docs/mcp`);
    assert.doesNotMatch(docs.mcpGuide.description, /read-only tool registry|registre d.outils en lecture seule|registro de herramientas de solo lectura/iu);
    assert.doesNotMatch(JSON.stringify(docs.sections[4]), /rollout|déploiement activé|despliegue habilitado/iu);
    assert.doesNotMatch(docs.library.summaryLive, /presets/iu);
  }
});

test('Docs articles and fallback cannot resurrect the removed workspace and membership promises', () => {
  assert.doesNotMatch(JSON.stringify(fallbackDocs), /allowlist|human review|brand brief|automatic discounts|Plus \/ Pro|GraphQL|SDK examples/iu);
  for (const directory of ['content/docs', 'content/fr/docs', 'content/es/docs']) {
    const safety = readFileSync(`${directory}/brand-safety.mdx`, 'utf8');
    const gettingStarted = readFileSync(`${directory}/get-started.mdx`, 'utf8');
    assert.doesNotMatch(safety, /Settings → Trust|allowlist|human review|revue humaine|revisión humana|audit trail|piste d.audit|trazabilidad/iu);
    assert.doesNotMatch(gettingStarted, /rollout|déploiement activé|despliegue habilitado/iu);
    assert.match(safety, /slug: "brand-safety"/);
    assert.match(safety, /date: "2024-06-03"/);
    assert.match(gettingStarted, /date: "2024-06-01"/);
    assert.match(safety, /updatedAt: "2026-09-21"/);
    assert.match(gettingStarted, /updatedAt: "2026-09-21"/);
  }
});
