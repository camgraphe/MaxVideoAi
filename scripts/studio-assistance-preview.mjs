import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Only a browser bundle of the real presentation component. No API or credentials.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.argv.find(arg=>arg.startsWith('--port='))?.slice(7)??3047);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port');
const output=path.join(root,'.local/studio-assistance-preview');
await mkdir(output,{recursive:true});
async function compile(){
  await build({
    absWorkingDir:root,entryPoints:['tests/fixtures/studio-assistance-preview/preview.client.tsx'],
    bundle:true,outfile:path.join(output,'preview.js'),platform:'browser',format:'esm',
    jsx:'automatic',tsconfig:path.join(root,'frontend/tsconfig.json'),
    nodePaths:[path.join(root,'frontend/node_modules')],
    loader:{'.module.css':'local-css'},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},
  });
}
await compile();
const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio assistance · local review</title><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>';
const server=createServer(async(request,response)=>{
  response.setHeader('Cache-Control','no-store');
  response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; font-src 'self'; form-action 'none'; base-uri 'none'");
  try{
    const url=new URL(request.url,'http://127.0.0.1');
    if(url.pathname==='/preview.js'||url.pathname==='/preview.css'){
      response.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css':'text/javascript');
      response.end(await readFile(path.join(output,url.pathname.slice(1))));
    }else{
      await compile();
      response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);
    }
  }catch(error){response.writeHead(500,{'Content-Type':'text/plain'}).end(String(error));}
});
server.listen(port,'127.0.0.1',()=>console.log(`Studio assistance review: http://127.0.0.1:${port}/\nExplicit demo data; choices only change memory. No network APIs are available.`));
