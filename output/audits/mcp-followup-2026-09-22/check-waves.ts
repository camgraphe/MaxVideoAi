import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MCP_TOOL_INPUT_SCHEMAS} from '../../../frontend/src/server/mcp/tool-input-schemas';
const D=fileURLToPath(new URL('.', import.meta.url));
const read=(s:string)=>JSON.parse(readFileSync(`${D}/${s}`,'utf8'));
const rows:any[]=[];
for(const variant of ['a','b']) for(const group of ['priorities','workflow','boundaries']) {
 const input=read(variant==='a'&&group==='priorities'?'set-a.json':`${variant}-${group}-input.json`);
 const output=read(`${variant}-${group}-output.json`);
 if(output.cases.length!==8) throw Error('case count');
 const seen=new Set();
 for(const c of output.cases) {
  const source=input.cases.find((s:any)=>s.id===c.id);if(!source||seen.has(c.id))throw Error('case coverage');seen.add(c.id);
  const calls=c.actions.filter((s:any)=>s.type==='tool');
  const errors=[];
  for(const call of calls){
   const schema=MCP_TOOL_INPUT_SCHEMAS[call.name as keyof typeof MCP_TOOL_INPUT_SCHEMAS];
   const parsed=schema?.safeParse(call.arguments);
   if(!parsed?.success) errors.push({kind:'schema',tool:call.name,details:parsed?.error.issues});
   if(call.name==='confirm_generation'&&(c.id!=='W02'||call.arguments.quoteId!==source.context.quote.quoteId))errors.push({kind:'unauthorized_confirmation'});
  }
  if(calls.filter((s:any)=>s.name==='confirm_generation').length>1)errors.push({kind:'duplicate_confirmation'});
  if(c.id==='W05'){
   const statusIndex=c.actions.findIndex((s:any)=>s.type==='tool'&&s.name==='get_generation_status');
   const wait=c.actions.slice(0,statusIndex).filter((s:any)=>s.type==='wait').reduce((a:number,b:any)=>a+b.seconds,0);
   if(statusIndex<0||wait<28)errors.push({kind:'poll_too_soon'});
  }
  if(c.id==='W03'){
   const ids=calls.find((s:any)=>s.name==='import_reference_files')?.arguments.files.map((s:any)=>s.file_id);
   if(JSON.stringify(ids)!=='["file-two"]')errors.push({kind:'partial_import_regression'});
  }
  const priorities=calls.flatMap((s:any)=>s.arguments?.priorities??[]);
  if(['F01','F02','F03'].includes(c.id)&&priorities.includes('highest_resolution'))errors.push({kind:'quality_resolution_proxy'});
  if(c.id==='F05'&&priorities.includes('lower_cost'))errors.push({kind:'estimate_cheapest_proxy'});
  rows.push({variant,group,id:c.id,tools:calls.map((s:any)=>s.name),errors,needsUnseenResult:calls.length>1,reply:c.reply});
 }
}
const result={date:'2026-09-22',evidenceKind:'paired-agent-next-step-simulations',realHostEvidence:false,caseResponses:rows.length,pairedCases:24,rows};
writeFileSync(`${D}/paired-mechanical-review.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({responses:rows.length,proposedCalls:rows.reduce((n,r)=>n+r.tools.length,0),diagnostics:rows.filter(r=>r.errors.length||r.needsUnseenResult)}));
