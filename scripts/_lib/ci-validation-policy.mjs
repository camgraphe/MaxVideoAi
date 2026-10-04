// Unknown paths and shared runtime inputs deliberately request every lane.
const documentation = (file) => /(^|\/)AGENTS\.md$/.test(file)
  || /^docs\/.*\.md$/.test(file)
  || /^(README(?:\.[^/]+)?|LICENSE(?:\.[^/]+)?)$/.test(file);
const financial = /(?:pric(?:e|es|ing)|tariff|billing|wallet|checkout|payment|stripe|quote|credit|transaction|membership|subscription)/i;
const presentation = (file) => /^(?:content|frontend\/(?:content|messages))\/.*\.(?:md|mdx|json)$/.test(file)
  || /^frontend\/public\/.*\.(?:avif|gif|ico|jpe?g|png|svg|webp|mp4|webm|mov|mp3|wav|m4a|woff2?|ttf|otf|txt|md|xml)$/.test(file)
  || /^frontend\/components\/marketing\/.*\.tsx$/.test(file)
  || /^frontend\/app\/\(localized\)\/.*\/\(marketing\)\/.*\/_components\/.*\.tsx$/.test(file)
  || /^frontend\/.*\.css$/.test(file);

export function selectValidationLanes(files, exhaustive = false) {
  if (exhaustive || !files?.length) return { integration: true, tariffs: true, browser: true };
  let integration = false;
  let tariffs = false;
  let browser = false;
  for (const file of files) {
    if (documentation(file)) continue;
    if (financial.test(file)) {
      integration = true;
      tariffs = true;
      browser = true;
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
    // UI changes still run browser/database integration tests. Runtime helpers,
    // API routes, catalogues, fixtures, tooling and unrecognized paths also replay
    // the complete financial cutover; this is an allowlist, not a denylist.
    const applicationUi = /^frontend\/components\/.*\.tsx$/.test(file)
      || (/^frontend\/app\//.test(file) && (
        /\/_components\/.*\.tsx$/.test(file)
        || /\/_hooks\/.*\.tsx?$/.test(file)
        || /\.client\.tsx$/.test(file)
      ));
    if (!applicationUi) tariffs = true;
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
