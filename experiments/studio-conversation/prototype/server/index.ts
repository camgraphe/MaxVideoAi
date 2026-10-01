import {Director} from './director';import {mcp} from './mcp';
import {createServer} from 'node:http';import {createServer as createViteServer} from 'vite';import {resolve} from 'node:path';
import {ProjectStore} from './store';import {CommandService} from './commands';import {JobRunner} from './jobs';import {localWork} from './local-work';import {api,json} from './http';
const port=Number(process.env.STUDIO_LOCAL_PORT??4318),root=resolve(process.env.STUDIO_LOCAL_DATA??'.data');
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Port local invalide.');
const store=new ProjectStore(resolve(root,'projects')),service=new CommandService(store),runner=new JobRunner(store,localWork(root,store));
const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'}),director=new Director(service),handle=api(store,service,root,{chat:(id,data)=>director.respond(id,data),mcp:mcp(service)});
const server=createServer(async(req,res)=>{
 const allowed=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
 if(!allowed.has(req.headers.host??'')||req.headers.origin&&!allowed.has(new URL(req.headers.origin).host)||req.headers['sec-fetch-site']==='cross-site'){json(res,403,{error:'Ce prototype accepte uniquement les requêtes locales.'});return;}
 if(await handle(req,res))return;vite.middlewares(req,res);
});
await runner.recover();runner.start();server.listen(port,'127.0.0.1',()=>console.log(`Studio local prêt : http://127.0.0.1:${port}`));
for(const name of ['SIGINT','SIGTERM'] as const)process.on(name,()=>{void (async()=>{await runner.stop();await vite.close();server.close(()=>process.exit(0));})();});
