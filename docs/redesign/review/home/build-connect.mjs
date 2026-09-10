import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const checkout=resolve(process.argv[2]||process.cwd());
const require=createRequire(join(checkout,'package.json'));
const {build}=require('esbuild');
await build({
 entryPoints:[fileURLToPath(new URL('./connect-scene.mjs',import.meta.url))],
 outfile:fileURLToPath(new URL('./connect-runtime.js',import.meta.url)),
 nodePaths:[join(checkout,'frontend/node_modules')],
 supported:{'template-literal':false},
 bundle:true,format:'esm',minify:true,logLevel:'info'
});
