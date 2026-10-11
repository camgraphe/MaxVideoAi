import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

const frontend = resolve('frontend');

// Execute the real worker renderer until the external Remotion render boundary.
// Persistence, media grants and rendering are isolated: no account, cloud or browser calls.
async function renderWithEnvironment(env: NodeJS.ProcessEnv, errorMessage = 'OFFLINE_RENDER_BOUNDARY') {
  const fixture = {selection: null as any,render: null as any,failure: null as any,errorMessage,logs: [] as unknown[][]};
  const stubs: Record<string,string> = {
    '@remotion/bundler': 'export const bundle = async () => "offline-bundle";',
    '@remotion/renderer': `
      export const selectComposition = async options => {fixture.selection = options;return {id: "MaxVideoAITimelineExport"};};
      export const renderMedia = async options => {fixture.render = options;options.onBrowserLog({type: 'error',text: fixture.errorMessage});options.onBrowserLog({type: 'warning',text: fixture.errorMessage});throw Error(fixture.errorMessage);};
      export const makeCancelSignal = () => ({cancel: () => {},cancelSignal: () => {}});
    `,
    '@/server/media-library': 'export const ensureReusableAsset = async () => {throw Error("Unexpected publication");};',
    '@/server/storage': 'export const buildPublicStorageUrl = () => "";export const deleteStorageObjectByUrl = async () => false;export class StorageUploadError extends Error {} export const uploadFilePath = async () => {throw Error("Unexpected upload");};',
    '@/server/upload-thumbnails': 'export const createVideoThumbnailFromFile = async () => {throw Error("Unexpected thumbnail");};',
    './billing': 'export const releaseFailedTimelineExportBilling = async () => "free_released";',
    './repository': 'export const updateTimelineExportProgress = async () => {};export const completeTimelineExportJob = async () => {throw Error("Unexpected completion");};export const failTimelineExportJob = async input => {fixture.failure = input;};',
    './media-security': 'export const validateTimelineExportManifestMediaUrls = async ({manifest}) => manifest;export const prepareTimelineExportRenderMedia = async ({manifest}) => manifest;',
  };
  const result = await build({absWorkingDir: frontend,
    stdin: {contents: "export * from './src/server/timeline-exports/renderer';",resolveDir: frontend,loader: 'ts'},
    tsconfig: resolve(frontend,'tsconfig.json'),bundle: true,platform: 'node',format: 'cjs',write: false,packages: 'external',
    plugins: [{name: 'offline-browser-config',setup(builder) {
      builder.onResolve({filter: /.*/},args => args.path in stubs ? {path: args.path,namespace: 'fixture'} : undefined);
      builder.onLoad({filter: /.*/,namespace: 'fixture'},args => ({contents: stubs[args.path],loader: 'js',resolveDir: frontend}));
    }}],
  });
  const module = {exports: {} as any};
  runInNewContext(result.outputFiles[0].text,{module,exports: module.exports,fixture,
    require: createRequire(resolve(frontend,'package.json')),process: {env,cwd: () => frontend},
    Buffer,URL,console: {...console,error: (...args: unknown[]) => fixture.logs.push(args),warn: (...args: unknown[]) => fixture.logs.push(args)},setTimeout,clearTimeout,setInterval,clearInterval});
  await module.exports.renderTimelineExportJob({
    id: 'browser-fixture-'+randomUUID(),user_id: 'offline-owner',project_name: 'Three videos',resolution: '1080p',fps: 30,
    billing_status: 'free_reserved',amount_cents: 0,export_settings: {includeAudio: true},
    render_manifest: {
      version: 1,source: 'maxvideoai-editor',projectName: 'Three videos',sequenceId: 'main',sequenceName: 'Main',
      projectSettings: {aspectRatio: '16:9',resolution: '1080p',fps: 30},createdAt: '2026-10-11T00:00:00.000Z',
      status: 'ready',durationSec: 60,exportRange: {mode: 'sequence',startSec: 0,endSec: 60,durationSec: 60},issues: [],
      tracks: [{id: 'video',durationSec: 60,clips: [0,20,40].map((startSec,index) => ({
        id: 'clip-'+index,assetId: 'asset-'+index,outputNodeId: 'output-'+index,title: 'Video '+index,track: 'video',mediaKind: 'video',
        mediaUrl: 'https://cdn.maxvideoai.com/offline-'+index+'.mp4',
        startSec,endSec: startSec+20,durationSec: 20,sourceStartSec: 0,sourceEndSec: 20,sourceDurationSec: 20,
      }))}],
    },
  });
  assert.ok(fixture.failure?.message,'The canonical renderer must reach rendering without a database, storage or browser side effect.');
  return fixture;
}

test('failed rendering retains the causal diagnostic without persisting signed transport credentials',async () => {
  const fixture = await renderWithEnvironment({},'Frame capture stalled: https://media.maxvideoai.com/renders/owner/film.mp4?X-Amz-Credential=secret-access-key&X-Amz-Signature=secret-signature');
  assert.equal(fixture.logs.length,3,'The SDK browser error/warning and caught root error must be retained.');
  const logged = JSON.stringify(fixture.logs);
  assert.match(logged,/Frame capture stalled/);
  assert.match(logged,/stack/,'The caught error includes its causal stack.');
  assert.doesNotMatch(logged,/secret-access-key|secret-signature|X-Amz-/i);
  assert.doesNotMatch(fixture.failure.message,/secret-access-key|secret-signature|X-Amz-/i);
});

for (const {name,env,want} of [
  {name: 'CHROME_BIN takes precedence',env: {CHROME_BIN: ' /usr/bin/chromium ',PUPPETEER_EXECUTABLE_PATH: '/other/chromium'},want: '/usr/bin/chromium'},
  {name: 'Puppeteer executable is accepted',env: {PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium'},want: '/usr/bin/chromium'},
  {name: 'blank CHROME_BIN falls back to Puppeteer',env: {CHROME_BIN: ' ',PUPPETEER_EXECUTABLE_PATH: ' /usr/bin/chromium '},want: '/usr/bin/chromium'},
  {name: 'local unconfigured rendering retains Remotion discovery',env: {},want: undefined},
] as const) {
  test(`timeline worker passes its browser executable to composition selection and rendering: ${name}`,async () => {
    const fixture = await renderWithEnvironment(env);
    assert.equal(fixture.selection?.browserExecutable,want,'Composition selection must use the worker browser.');
    assert.equal(fixture.render?.browserExecutable,want,'Frame rendering must use the same worker browser.');
    assert.equal(fixture.render?.inputProps.manifest.durationSec,60);
    assert.equal(fixture.failure?.message,'OFFLINE_RENDER_BOUNDARY');
  });
}
