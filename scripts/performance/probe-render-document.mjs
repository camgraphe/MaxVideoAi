// Temporary diagnostic runner, executed only on the task branch in GitHub Actions.
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(path.resolve('package.json'));
const lighthouseRequire=createRequire(require.resolve('lighthouse/package.json',{paths:[require.resolve('@lhci/cli/package.json')]}));
const {Launcher}=lighthouseRequire('chrome-launcher');
const cli=lighthouseRequire.resolve('lighthouse/cli/index.js');
const defaults=Launcher.defaultFlags();
const baseline=[...defaults,'--headless=new'];
const candidate=defaults.map(flag=>flag.startsWith('--disable-features=') ? '--disable-features='+flag.slice('--disable-features='.length).split(',').filter(feature=>feature!=='RenderDocument').join(',') : flag);
candidate.push('--enable-features=RenderDocument','--headless=new');
const root=path.resolve('lighthouse-reports/render-document-probe');fs.mkdirSync(root,{recursive:true});
fs.writeFileSync(path.join(root,'flags.json'),JSON.stringify({baseline,candidate},null,2));
for(let run=1;run<=5;run++) {
 for(const arm of run%2 ? ['baseline','candidate'] : ['candidate','baseline']) {
  const prefix=path.join(root,arm+'-'+run);
  const flags={chromeIgnoreDefaultFlags:true,chromeFlags:(arm==='baseline'?baseline:candidate).map(flag=>JSON.stringify(flag)).join(' '),additionalTraceCategories:'viz,cc,renderer.scheduler,disabled-by-default-cc.debug',onlyCategories:['performance']};
  fs.writeFileSync(prefix+'-flags.json',JSON.stringify(flags,null,2));
  const result=spawnSync(process.execPath,[cli,'https://maxvideoai.com/examples','--cli-flags-path='+prefix+'-flags.json','--save-assets','--output=json','--output-path='+prefix+'.json'],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
 }
}
