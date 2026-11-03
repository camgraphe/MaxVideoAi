import {getDb} from '../src/lib/db';
import {inspectStudioAssistanceOutputRefund,applyStudioAssistanceOutputRefund} from '../src/server/studio/assistance-output-refund';
import {parseStudioAssistanceOutputRefundArgs} from './_lib/studio-assistance-output-refund-cli';
async function main(){
 const connection=process.env.DATABASE_URL;
 if(!connection)throw new Error('Provide DATABASE_URL through the approved secret environment.');
 const options=parseStudioAssistanceOutputRefundArgs(process.argv.slice(2),connection);
 try{
  const scope={callId:options.call,userId:options.user};
  const result=options.apply?await applyStudioAssistanceOutputRefund({...scope,expectedFingerprint:options.apply,operator:options.operator!,reason:options.reason!}):await inspectStudioAssistanceOutputRefund(scope);
  console.log(JSON.stringify({target:options.target,environment:options.environment,mode:options.apply?'apply':'dry_run',result},null,2));
 }finally{await getDb().end();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Studio output refund command failed.');process.exitCode=1;});
