import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry';
import { buildDecisionPricingScenarios } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing';

test('every executable model pricing preset renders readable labels in all three locales', () => {
  let checked = 0;
  const failures: string[] = [];
  for (const engine of listFalEngines()) {
    const template = getModelPageTemplateConfig(engine.modelSlug);
    if (!template || template.intent === 'prelaunch') continue;
    for (const locale of ['en', 'fr', 'es'] as const) {
      const scenarios = buildDecisionPricingScenarios(engine, locale, template.pricing.presets);
      template.pricing.presets.forEach((preset, index) => {
        const scenario = scenarios[index];
        for (const [value, key] of [[scenario.label, preset.labelKey], [scenario.note, preset.noteKey], [scenario.badge, preset.highlightKey]]) {
          if (key && (!value || value === key)) failures.push(`${engine.modelSlug}/${locale}/${preset.id}: ${key}`);
        }
        checked++;
      });
    }
  }
  assert.ok(checked > 100, `cover the executable model catalog: ${checked} scenarios, ${listFalEngines().length} engines`);
  assert.deepEqual(failures, []);
});
