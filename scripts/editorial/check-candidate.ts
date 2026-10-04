import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {getEditorialVersion} from '../../frontend/src/server/editorial/repository';
import {getDb} from '../../frontend/src/lib/db';
async function main(){
 const envPath=process.env.EDITORIAL_WORKER_ENV;if(!envPath)throw Error('Worker environment path required');
 const require=createRequire(path.resolve('frontend/package.json'));const values=require('dotenv').parse(readFileSync(envPath));
 for(const [key,value] of Object.entries(values))process.env[key]=String(value).trim();
 const {checkEditorialCandidate}=await import('./publication-qa');
 const record=await getEditorialVersion(process.argv[2],Number(process.argv[3]));if(!record)throw Error('Draft not found');
 console.log(JSON.stringify({status:'checking',articleId:record.articleId,version:record.version,approved:Boolean(record.approvedAt),links:record.draft.sources.length}));
 const report=await checkEditorialCandidate(record,process.cwd());
 const dir=path.resolve('.local/editorial-qa');mkdirSync(dir,{recursive:true,mode:0o700});writeFileSync(path.join(dir,record.digest+'.json'),JSON.stringify(report,null,2),{mode:0o600});
 console.log(JSON.stringify({status:'checked',views:report.views.length,media:report.media.length,links:report.links.length}));
}
main().catch(e=>{console.error(e.message);if(e.report){mkdirSync('.local/editorial-qa',{recursive:true,mode:0o700});writeFileSync('.local/editorial-qa/failed-report.json',JSON.stringify(e.report,null,2),{mode:0o600});console.error(JSON.stringify({failedLinks:e.report.links.filter((l:any)=>l.status<200||l.status>=300),viewFailures:e.report.views.filter((v:any)=>v.failures.length)}));}process.exitCode=1;}).finally(()=>getDb().end());
