import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';

async function fixture(options: { toolsSection?: boolean; env?: Record<string, string>; closeFinishing?: boolean } = {}) {
  const root = resolve('frontend');
  // Replace only unused spending/database boundaries. Discovery and profile gates are real.
  const stubs: Record<string, string> = {
    '@/content/feature-flags': `export const FEATURES={workflows:{toolsSection:${options.toolsSection !== false}}};`,
    '@/server/fraud-cleanup': 'export const getActiveAccountRestriction=async()=>{throw Error("Unexpected account read")};',
    '@/server/tools/creator-operations': 'export const createCreatorOperationsService=()=>{throw Error("Unexpected creator execution")};',
    '@/server/subtitles/operations': 'export const createSubtitleOperationsService=()=>{throw Error("Unexpected subtitle execution")};',
    '@/server/subtitles/repository': 'export const subtitleRepository={};',
    '@/server/tools/creator-media-access': 'export const withCreatorMediaReadAccess=()=>{throw Error("Unexpected signing")};',
  };
  if (options.closeFinishing) stubs['./finishing-release'] = 'export const FINISHING_QUALIFICATIONS=[];export const isFinishingProfileReleased=()=>false;';
  const built = await build({ absWorkingDir: root, entryPoints: ['src/server/agent-api/creator-tools.ts'],
    tsconfig: resolve(root, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs', write: false,
    packages: 'external', plugins: [{ name: 'creator-discovery-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
    } }],
  });
  const module = { exports: {} as any };
  runInNewContext(built.outputFiles[0].text, { module, exports: module.exports,
    require: createRequire(resolve(root, 'package.json')), process: { env: options.env ?? {} }, Buffer, URL });
  return module.exports.createAgentCreatorToolsService;
}

test('creator discovery reports the effective execution gate for subtitles and every existing profile', async () => {
  const createService = await fixture();
  const principal = { userId: 'owner', clientId: 'host', emailVerified: true, authMethod: 'oauth' };
  for (const enabled of [false, true]) {
    const result = await createService({ enabled, accountUrl: 'https://review.example.test/account/connections' }).list(principal);
    assert.deepEqual(Array.from(result.tools, (tool: any) => tool.id),
      ['subtitles', 'lip-sync', 'product-photo-editor', 'product-video-editor', 'motion-transfer']);
    for (const tool of result.tools) {
      for (const profile of tool.profiles) {
        const specialist = ['lip-video-latentsync-v1', 'motion-kling-v3-v1'].includes(profile.id);
        assert.equal(profile.deploymentGateOpen, enabled && !specialist, `${profile.id}: enabled=${enabled}`);
      }
    }
    const subtitles = result.tools.find((tool: any) => tool.id === 'subtitles');
    assert.equal(subtitles.profiles[0].editing, 'text, timing and style; no new transcription');
    assert.equal(result.requiresExactQuoteApproval, true);
  }
});

test('web-only discovery uses trusted instance links and marks pilot profiles without promising MCP execution', async () => {
  const createService = await fixture();
  const result = await createService({ enabled: false, accountUrl: 'https://review.example.test/account/connections' }).list();
  assert.deepEqual(Array.from(result.webTools, (tool: any) => tool.id),
    ['upscale', 'background-removal', 'restore-video', 'denoise', 'fix-blur', 'smooth-motion', 'storyboard', 'angle']);
  for (const tool of result.webTools) {
    assert.equal(tool.url, `https://review.example.test/app/tools/${tool.id}`);
    assert.equal(tool.mcpExecution, false);
    assert.equal(tool.providerReadiness, 'not-checked');
  }
  const pilots = result.webTools.filter((tool: any) => tool.profiles?.length);
  assert.equal(pilots.length, 4);
  for (const pilot of pilots) {
    assert.equal(pilot.release, 'owner-approved-pilot');
    assert.ok(pilot.profiles.every((profile: any) => profile.release === 'owner-approved-pilot'));
  }
  assert.equal(result.webHandoff.startsOperation, false);
  assert.equal(result.webHandoff.transfersMedia, false);
  assert.equal(result.webHandoff.requiresSourceSelection, true);
  assert.equal(result.webHandoff.requiresWebQuoteApproval, true);
  const subtitle = result.tools.find((tool: any) => tool.id === 'subtitles');
  assert.equal(subtitle.web.url, 'https://review.example.test/app/tools/subtitles');
  assert.equal(subtitle.web.executionGateOpen, false);
});

test('web gates and closed finishing profiles are respected independently of MCP execution', async () => {
  const closed = await fixture({ toolsSection: false });
  const hidden = await closed({ enabled: false, accountUrl: 'https://maxvideoai.example/account/connections' }).list();
  assert.equal(hidden.webTools.length, 0);
  assert.ok(hidden.tools.every((tool: any) => tool.web.executionGateOpen === false));
  const scoped = await fixture({ closeFinishing: true, env: { CREATOR_TOOLS_ENABLED: '1' } });
  const result = await scoped({ enabled: false, accountUrl: 'https://maxvideoai.example/account/connections' }).list();
  assert.deepEqual(Array.from(result.webTools, (tool: any) => tool.id), ['upscale', 'background-removal', 'storyboard', 'angle']);
  assert.ok(result.tools.every((tool: any) => tool.web.executionGateOpen === true));
  assert.ok(result.tools.every((tool: any) => tool.profiles.every((profile: any) => profile.deploymentGateOpen === false)));
});
