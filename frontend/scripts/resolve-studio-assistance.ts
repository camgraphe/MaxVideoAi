import {getDb} from '../src/lib/db';
import {applyStudioAssistanceResolution,inspectStudioAssistanceResolution,listStudioAssistanceUnresolved} from '../src/server/studio/assistance-resolution';
import {parseStudioAssistanceSupportArgs} from './_lib/studio-assistance-resolution-cli';

async function main(){
  const connection=process.env.DATABASE_URL;
  if(!connection)throw new Error('Provide DATABASE_URL through the approved secret environment.');
  const options=parseStudioAssistanceSupportArgs(process.argv.slice(2),connection);
  try{
    const result=options.list?await listStudioAssistanceUnresolved():options.apply
      ?await applyStudioAssistanceResolution({callId:options.call!,action:options.action!,expectedFingerprint:options.apply,operator:options.operator!,reason:options.reason!})
      :await inspectStudioAssistanceResolution(options.call!,options.action!);
    console.log(JSON.stringify({target:options.target,environment:options.environment,mode:options.list?'list':options.apply?'apply':'dry_run',result},null,2));
  }finally{await getDb().end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Studio support command failed.');process.exitCode=1;});
