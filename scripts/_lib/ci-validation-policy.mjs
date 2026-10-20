// Runtime paths retain integration/browser coverage. Exhaustive cutovers are
// reserved for financial changes, explicit commercial inputs and full runs.
const documentation = (file) => /(^|\/)AGENTS\.md$/.test(file)
  || /^docs\/.*\.md$/.test(file)
  || /^(README(?:\.[^/]+)?|LICENSE(?:\.[^/]+)?)$/.test(file);
const financial = (file) => /(?:pric(?:e|es|ing)|tariff|billing|wallet|checkout|payment|stripe|quote|credit|transaction|membership|subscription|refund|invoice|ledger|topup|currency)/i.test(file)
  || /(?:^|[\/._-])(?:cost|accounting)(?:[\/._-]|$)/i.test(file);
// These owners supply rates or persisted pricing without a financial filename.
// Model identity/marketing configuration alone does not own monetary amounts.
const commercialInputs = new Set([
  'frontend/config/engine-catalog.json',
  'frontend/config/published-supplier-rates.json',
  'frontend/config/studio-media-analysis-policy.json',
  'frontend/fixtures/fal-models.json',
  'frontend/lib/image/gptImage2.ts',
  'frontend/src/config/falEngines.ts',
  'frontend/src/config/tools-angle-engines.ts',
  'frontend/src/config/tools-upscale-engines.ts',
  'frontend/src/config/tools-background-removal-engines.ts',
  'frontend/src/lib/fal-catalog.ts',
  'frontend/src/lib/audio-generation.ts',
  'frontend/src/lib/tools-angle.ts',
  'frontend/src/lib/tools-upscale.ts',
  'frontend/src/lib/tools-background-removal.ts',
  'frontend/src/lib/exchange.ts',
  'frontend/src/lib/fxProvider.ts',
  'frontend/src/lib/kling-3-turbo.ts',
  'frontend/src/lib/studio/assistance-contract.ts',
  'frontend/src/server/studio/assistance-provider-facts.ts',
  'frontend/src/server/studio/media-analysis/policy.ts',
  'frontend/src/server/tools/creator-profiles-lipsync.ts',
  'frontend/src/server/tools/creator-profiles-motion.ts',
  'frontend/src/server/engine-settings.ts',
  'frontend/src/server/engine-settings-defaults.ts',
  'frontend/src/server/engine-configuration-read.ts',
  'frontend/src/server/engine-configuration-projection.ts',
  'neon/migrations/09_engine_settings.sql',
]);
const commercialInput = (file) => commercialInputs.has(file)
  || file.startsWith('frontend/src/config/fal-engines/');
const presentation = (file) => /^(?:content|frontend\/(?:content|messages))\/.*\.(?:md|mdx|json)$/.test(file)
  || /^frontend\/public\/.*\.(?:avif|gif|ico|jpe?g|png|svg|webp|mp4|webm|mov|mp3|wav|m4a|woff2?|ttf|otf|txt|md|xml)$/.test(file)
  || /^frontend\/components\/marketing\/.*\.tsx$/.test(file)
  || /^frontend\/app\/\(localized\)\/.*\/\(marketing\)\/.*\/_components\/.*\.tsx$/.test(file)
  || /^frontend\/.*\.css$/.test(file);
const exhaustiveFinancialTests = new Set([
  'tests/customer-tariff-initial-cutover-postgres.test.ts',
  'tests/local-customer-tariff-activation-postgres.test.ts',
]);
const ordinaryValidationTest = (file) => /^tests\/.*\.test\.ts$/.test(file)
  && !exhaustiveFinancialTests.has(file);

export function selectValidationLanes(files, exhaustive = false) {
  if (exhaustive || !files?.length) return { integration: true, tariffs: true, browser: true };
  let integration = false;
  let tariffs = false;
  let browser = false;
  for (const file of files) {
    if (documentation(file)) continue;
    const commercial = commercialInput(file);
    if (commercial || financial(file)) {
      integration = true;
      browser = true;
      // Preserve normal integration coverage for financial displays/tests while
      // limiting exhaustive replay to runtime inputs and the cutover tests.
      tariffs ||= commercial || (!presentation(file)
        && !/\.(?:tsx|jsx|css|scss|sass|less)$/.test(file)
        && !ordinaryValidationTest(file));
      continue;
    }
    if (presentation(file)) {
      // Interactive marketing, layout CSS and translated UI still need real
      // browser behavior checks, without replaying database/financial cutovers.
      if (/\.(?:tsx|css)$/.test(file) || file.startsWith('frontend/messages/')) browser = true;
      continue;
    }
    integration = true;
    browser = true;
    // Non-financial runtime, tests, tooling and unknown paths still run normal
    // integration coverage. Their exhaustive financial replay is nightly/manual.
  }
  return { integration, tariffs, browser };
}

export function assertValidationResults(jobs) {
  for (const name of ['plan', 'fast']) {
    if (jobs[name]?.result !== 'success') throw new Error(`Required CI job ${name} did not succeed.`);
  }
  for (const name of ['integration', 'tariffs', 'browser']) {
    const selected = jobs.plan.outputs?.[name];
    if (selected !== 'true' && selected !== 'false') throw new Error(`Missing CI selection for ${name}.`);
    const result = jobs[name]?.result;
    if (selected === 'true' ? result !== 'success' : !['success', 'skipped'].includes(result)) {
      throw new Error(`CI job ${name} did not complete as required (selected=${selected}, result=${result}).`);
    }
  }
}
