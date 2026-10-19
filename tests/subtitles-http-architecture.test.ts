import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import path from 'node:path';
/** Dynamic imports are part of Next's bundle graph too; the HTTP graph must not reach render code. */
test('subtitle prepare/confirm and HTTP reconciliation never import an ECS renderer',async()=>{
  const result=await build({entryPoints:['frontend/src/server/subtitles/operations.ts','frontend/src/server/subtitles/reconciliation.ts'],outdir:'/tmp/subtitles-http-graph',bundle:true,write:false,metafile:true,platform:'node',format:'esm',packages:'external',tsconfig:'frontend/tsconfig.json',logLevel:'silent'});
  const inputs=Object.keys(result.metafile!.inputs);
  for(const file of inputs)assert.doesNotMatch(file,/subtitles\/(worker|publish|render|sequence-worker|sequence-render)\.ts$|timeline-exports\/renderer\.ts$/,file);
  const dependencies=Object.values(result.metafile!.inputs).flatMap(input=>input.imports.map(value=>value.path));
  assert.ok(!dependencies.some(value=>/^@remotion\/(bundler|renderer)/.test(value)),dependencies.filter(value=>value.startsWith('@remotion/')).join(','));
  assert.ok(inputs.some(file=>file.endsWith(path.join('subtitles','operations.ts'))));
});
