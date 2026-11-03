import {z} from 'zod';
import {studioAssistanceDatabaseIdentity} from './studio-assistance-resolution-cli';
const schema=z.object({target:z.string().min(1),environment:z.enum(['local','staging','production']),call:z.string().uuid(),user:z.string().min(1).max(128).regex(/^\S(?:.*\S)?$/),apply:z.string().regex(/^[a-f0-9]{64}$/).optional(),operator:z.string().trim().min(1).max(128).optional(),reason:z.string().trim().min(1).max(500).optional()}).strict();
/** No list/bulk mode or arbitrary credit quantity: the owned call supplies the amount. */
export function parseStudioAssistanceOutputRefundArgs(args:string[],connection:string){
 const values:Record<string,string>={};
 for(let i=0;i<args.length;i++){
  const flag=args[i];
  if(!flag.startsWith('--')||flag==='--'||Object.hasOwn(values,flag.slice(2)))throw new Error('Invalid or duplicate output refund option.');
  const value=args[++i];if(!value||value.startsWith('--'))throw new Error(`Missing value for ${flag}.`);
  values[flag.slice(2)]=value;
 }
 const options=schema.parse(values),identity=studioAssistanceDatabaseIdentity(connection);
 if(options.target!==identity)throw new Error('Database target identity does not match --target. No database operation was performed.');
 if(options.environment==='local'&&!/^(localhost:|127\.0\.0\.1:|\[::1\]:|\/)/.test(identity))throw new Error('The local environment requires a loopback or Unix-socket database.');
 if(options.apply&&(!options.operator||!options.reason))throw new Error('--apply requires an explicit operator and support reason.');
 if(!options.apply&&(options.operator||options.reason))throw new Error('Operator and reason belong to a fingerprinted --apply.');
 return options;
}
