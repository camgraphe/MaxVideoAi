import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
export function assertPublicationAllowed(root:string|undefined,now=new Date()){
 if(!root||!path.isAbsolute(root))throw Error('Publication control root required');
 const local=path.join(root,'.local');
 if(existsSync(path.join(local,'bridge-paused'))||existsSync(path.join(local,'topic-gate/paused')))throw Error('Publication paused');
 const trial=JSON.parse(readFileSync(path.join(local,'editorial-trial.json'),'utf8'));
 if(!trial.enabled||now<new Date(trial.startsAt)||now>=new Date(trial.endsAt))throw Error('Publication paused or trial ended');
}
