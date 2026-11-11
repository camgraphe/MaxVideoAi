#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createZip } from './lib/plugin-zip.mjs';
import { inspectPluginText } from './lib/plugin-content-guards.mjs';

const publicFiles = [
  'LICENSE', 'assets/logo-mark.svg', 'scripts/import-reference-files.mjs',
  'skills/plan/SKILL.md', 'skills/plan/agents/openai.yaml', 'skills/plan/references/budget-planning.md',
  'skills/generate/SKILL.md', 'skills/generate/agents/openai.yaml',
  'skills/generate/references/generation-safety.md', 'skills/generate/references/reference-inputs.md',
];
const sha256 = (contents) => createHash('sha256').update(contents).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function replaceExactly(text, before, after) {
  if (text.split(before).length !== 2) throw new Error('Directory skill projection is stale; review the changed source workflow.');
  return text.replace(before, after);
}

function main() {
  const args = process.argv.slice(2);
  const values = new Map();
  for (let i = 0; i < args.length; i += 2) {
    if (!['--source', '--out', '--asset-manifest'].includes(args[i]) || !args[i + 1] || values.has(args[i])) {
      throw new Error('Expected --out <new-empty-folder>, optional --source <path> and --asset-manifest <path>.');
    }
    values.set(args[i], args[i + 1]);
  }
  if (!values.has('--out')) throw new Error('An explicit --out <new-empty-folder> is required.');
  const requestedOut = resolve(values.get('--out'));
  if (existsSync(requestedOut) && readdirSync(requestedOut).length > 0) {
    throw new Error('Directory output is not empty; existing archives are never replaced.');
  }
  const source = resolve(values.get('--source') ?? 'plugins/maxvideoai');
  const config = JSON.parse(readFileSync(join(source, 'openai-directory.json'), 'utf8'));
  const channel = JSON.parse(readFileSync(new URL('../frontend/config/mcp-openai-directory.json', import.meta.url), 'utf8'));
  const resource = new URL(channel.resourceUrl);
  if (resource.protocol !== 'https:' || resource.username || resource.password || resource.port
    || resource.search || resource.hash || resource.pathname !== '/mcp'
    || !resource.hostname.endsWith('.maxvideoai.com') || resource.hostname === 'api.maxvideoai.com') {
    throw new Error('The OpenAI directory endpoint must identify its separate MaxVideoAI HTTPS /mcp resource.');
  }
  if (!/^\d+\.\d+\.\d+$/.test(config.version) || config.review?.commerce !== false
    || config.review.test_cases.positive.length !== 5 || config.review.test_cases.negative.length !== 3
    || config.interface.shortDescription.length > 30) {
    throw new Error('Invalid OpenAI directory candidate metadata.');
  }
  // Reuse the release builder's full-source secret, asset, version, symlink and
  // output ownership checks. Nothing is uploaded or deployed by either builder.
  const genericSource = JSON.parse(execFileSync(process.execPath, [
    fileURLToPath(new URL('./build-maxvideoai-plugin-release.mjs', import.meta.url)), ...args,
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 }));
  if (config.version === genericSource.version) throw new Error('A directory candidate must not reuse the generic source package version.');
  const out = realpathSync(resolve(values.get('--out')));
  const validated = join(out, 'maxvideoai-plugin');
  const bundle = join(out, 'openai-directory');
  mkdirSync(bundle);
  for (const name of publicFiles) {
    const destination = join(bundle, name);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(validated, name), destination);
  }
  for (const skill of ['plan', 'generate']) {
    const path = join(bundle, `skills/${skill}/agents/openai.yaml`);
    const projected = replaceExactly(readFileSync(path, 'utf8'),
      'url: "https://api.maxvideoai.com/mcp"', `url: "${resource.toString()}"`);
    writeFileSync(path, projected);
  }
  const base = JSON.parse(readFileSync(join(validated, '.codex-plugin/plugin.json'), 'utf8'));
  const { name, description, author, homepage, repository, license, keywords } = base;
  const manifest = {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name, version: config.version, description, author, homepage, repository, license, keywords,
    extensions: { 'com.openai': {
      interface: { ...base.interface, ...config.interface },
      review: config.review, publication: config.publication,
    } },
  };
  writeFileSync(join(bundle, 'plugin.json'), json(manifest));
  writeFileSync(join(bundle, 'mcp.json'), json({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: { maxvideoai: { type: 'streamable-http', url: resource.toString(), extensions: { 'com.openai': { auth: { type: 'oauth' } } } } },
  }));
  const generatePath = join(bundle, 'skills/generate/SKILL.md');
  let generate = readFileSync(generatePath, 'utf8');
  const directFunding = [
    '## Account and funding', '',
    'Use `get_account_status` for the connected account, credit balance, trial state,',
    'spending limits, and safe destinations. Never guess them.', '',
    'If the exact quote reports insufficient credits, call `create_topup_link` with',
    'that quote and direct the user to the exact returned MaxVideoAI destination.',
    'Payment stays on MaxVideoAI. The old quote becomes invalid. After the user says',
    'funding is complete, call `get_account_status`, then `prepare_generation` again,',
    'show the fresh exact quote, and wait for explicit approval before confirmation.', '',
  ].join('\n');
  generate = replaceExactly(generate, directFunding, [
    '## Existing account entitlements', '',
    'Use get_account_status for the connected account, existing balance, trial',
    'state, actual spending limits and returned account destinations. Never guess them.', '',
    'If existing entitlements are insufficient, explain the limitation and stop.',
    'This integration cannot sell credits, open checkout, provide purchase links or',
    'initiate a funding handoff. Never switch to another tool or website to bypass',
    'this boundary. Any later attempt still needs a fresh exact quote and explicit approval.', '',
  ].join('\n') + '\n');
  generate = replaceExactly(generate, 'paid confirmation, recovery, retry, trial decision, or top-up handoff.',
    'paid confirmation, recovery, retry, or trial decision.');
  generate += [
    '', '## Saved characters and Recast when available', '',
    'Use list_saved_characters and get_saved_character to resolve the exact owned',
    'identity and look. Use select_saved_character for an ordinary reference or',
    'prepare_recast for the dedicated Recast workflow. Preserve the chosen look,',
    'media passages, dialogue and settings. Present the exact quote and wait for',
    'explicit approval before confirm_recast. Recover the same quote with',
    'get_recast_status; insufficient existing entitlements do not authorize funding.',
    'Save only completed Character Builder originals when the user asks.',
    '', '## Creator tools and subtitles when available', '',
    'Read list_creator_tools to discover qualified profiles. Use prepare_creator_tool',
    'and present its exact quote before confirm_creator_tool with separate explicit',
    'approval. Recover the same operation with get_creator_tool_operation; never',
    'resubmit after an ambiguous response. Keep exact owned sources and profile IDs.',
    'Read subtitle documents before edits, preserve expected revision and request ID.',
    'Export SRT/VTT without retranscribing. Read the current exact MP4 burn-in quote;',
    'prepare_subtitle_export pins its exact revision and still needs confirmation.',
    'prepare_studio_subtitles follows the current saved sequence revision. Keep',
    'owned status/document recovery available when fresh execution is closed.',
    '', '## Audio and saved Studio work when available', '',
    'Discover the host tool inventory first. An installed skill does not enable a',
    'closed capability. Keep the conversation and creative decisions with the host.', '',
    'For audio, read list_audio_capabilities, use prepare_audio_generation for the',
    'exact selected request, and wait for explicit approval before one',
    'confirm_audio_generation. Recover the same job through generation status.', '',
    'For existing owned media, use prepare_montage if a non-persisted plan is useful,',
    'then create_studio_montage to save the selected edit. Read get_studio_timeline',
    'before edit_studio_timeline; use its actual revision and keep exact retries on',
    'the same idempotency key. Changed content requires a new key. Do not fabricate',
    'media identities, source timings, dimensions or completed outputs.', '',
    'Use prepare_studio_export for the saved sequence and current revision.',
    'Present the exact price and wait for human approval before confirm_studio_export.',
    'Read get_studio_export to recover the accepted render. Missing temporary read',
    'access does not authorize a new render. Never start Studio assistance or',
    'charge Sol/Luna to carry out the host conversation.', '',
    'Audio and export use existing account entitlements. If they are insufficient,',
    'explain the limitation and stop; do not route around the funding boundary.', '',
  ].join('\n');
  writeFileSync(generatePath, generate);
  const safetyPath = join(bundle, 'skills/generate/references/generation-safety.md');
  let safety = readFileSync(safetyPath, 'utf8');
  safety = replaceExactly(safety, 'job, needs more account funding, or asks about an unsuccessful result.',
    'job, has insufficient existing entitlements, or asks about an unsuccessful result.');
  const directSafetyFunding = [
    'If an exact quote reports insufficient credits, use `create_topup_link` with',
    'that quote and direct the user to its exact returned destination. Payment takes',
    'place only on the MaxVideoAI website. The old quote is invalid after the funding',
    'handoff. After the user says funding is complete, call `get_account_status`, then',
    '`prepare_generation` again, show the fresh exact quote, and wait for explicit',
    'approval before confirmation. If a trial condition appears in live results,',
    'explain it as returned and ask before changing the request. Do not guess account',
    'eligibility, invent an account URL, or claim the browser step completed.', '',
  ].join('\n');
  safety = replaceExactly(safety, directSafetyFunding, [
    'If existing entitlements are insufficient, explain the live limitation and stop.',
    'Do not sell credits, send checkout or purchase links, or use another tool to',
    'initiate a funding handoff. If a trial condition appears in live results,',
    'explain it as returned and ask before changing the request. Do not guess',
    'eligibility, invent a destination or claim that an account step completed.', '',
  ].join('\n'));
  writeFileSync(safetyPath, safety);
  const files = [...publicFiles, 'plugin.json', 'mcp.json'].sort();
  for (const file of files) inspectPluginText(file, readFileSync(join(bundle, file)), true);
  const checksums = Object.fromEntries(files.map((file) => [file, sha256(readFileSync(join(bundle, file)))]));
  writeFileSync(join(bundle, 'checksums.json'), json({ algorithm: 'sha256', files: checksums }));
  const archiveName = `maxvideoai-openai-directory-${config.version}.zip`;
  const archive = createZip([...files, 'checksums.json'].sort().map((file) => ({ name: file, contents: readFileSync(join(bundle, file)) })));
  writeFileSync(join(out, archiveName), archive);
  const digest = sha256(archive);
  writeFileSync(join(out, `${archiveName}.sha256`), `${digest}  ${archiveName}\n`);
  const readiness = {
    archive: archiveName, sha256: digest, version: config.version,
    readyToSubmit: false, productionActivated: false,
    requiredRuntimeProfile: 'openai-directory',
    resourceUrl: resource.toString(),
    requiredRuntimeSwitch: 'MCP_OPENAI_DIRECTORY_ENABLED=true',
    targetCapabilitySwitches: {
      MCP_OPENAI_DIRECTORY_PAID_GENERATION_ENABLED: 'true',
      MCP_OPENAI_DIRECTORY_REFERENCE_UPLOADS_ENABLED: 'true',
      MCP_OPENAI_DIRECTORY_MONTAGE_PREPARATION_ENABLED: 'true',
      MCP_OPENAI_DIRECTORY_AUDIO_GENERATION_ENABLED: 'true',
      MCP_OPENAI_DIRECTORY_STUDIO_MONTAGE_CREATION_ENABLED: 'true',
      MCP_OPENAI_DIRECTORY_STUDIO_TIMELINE_EDITING_ENABLED: 'true',
      MCP_OPENAI_DIRECTORY_STUDIO_EXPORTS_ENABLED: 'true',
      MCP_OPENAI_DIRECTORY_CREATOR_TOOLS_ENABLED: 'true',
      MCP_OPENAI_DIRECTORY_CHARACTER_STUDIO_ENABLED: 'true',
    },
    projectEligibility: { residency: 'global', verified: false, reviewedAt: '2026-11-11', source: 'https://developers.openai.com/plugins/deploy/app-review#metadata-stored-during-tool-scanning' },
    domainVerified: false,
    oauthClientConfigured: false,
    blockers: [
      'Bind the real dedicated OAuth client and portal callback; configure its secret only in the portal, then qualify PKCE/resource/refresh/revocation. No client is invented in this package.',
      'Deploy and verify the reviewed server profile on the final HTTPS endpoint before uploading this package.',
      'Verify publisher identity, current project eligibility/residency requirements, organization roles and the actual domain challenge.',
      'Run the five positive and three negative scenarios in each claimed real host with a seeded review account.',
      'Add a real accessible demo_recording_url to the authored review metadata and rebuild.',
      'Apply the standard terms for the actual provider routes, address explicit restrictions, and finalize privacy and reviewer access. Bespoke signed provider contracts are not assumed.',
    ],
    genericSourcePackage: { ...genericSource, publicationStatus: 'not-attested-by-local-builder' },
  };
  writeFileSync(join(out, 'openai-directory-readiness.json'), json(readiness));
  process.stdout.write(json(readiness));
}

try { main(); } catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
