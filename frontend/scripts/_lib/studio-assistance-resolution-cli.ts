import {z} from 'zod';
const schema=z.object({
  target:z.string().min(1),environment:z.enum(['local','staging','production']),
  list:z.literal('true').optional(),call:z.string().uuid().optional(),
  action:z.enum(['waive_unknown','settle_recorded']).optional(),
  operator:z.string().trim().min(1).max(128).optional(),reason:z.string().trim().min(1).max(500).optional(),
  apply:z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
export function studioAssistanceDatabaseIdentity(connection:string){
  const url=new URL(connection);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('A PostgreSQL connection is required.');
  const host=url.searchParams.get('host')??url.hostname;
  return `${host}:${url.port||'5432'}${url.pathname}`;
}
export function parseStudioAssistanceSupportArgs(args:string[],connection:string){
  const values:Record<string,string>={};
  for(let i=0;i<args.length;i++){
    const name=args[i];
    if(!name.startsWith('--')||name==='--'||Object.hasOwn(values,name.slice(2)))throw new Error('Invalid or duplicate support option.');
    const key=name.slice(2);
    if(key==='list'){values[key]='true';continue;}
    const value=args[++i];if(!value||value.startsWith('--'))throw new Error(`Missing value for ${name}.`);
    values[key]=value;
  }
  const options=schema.parse(values),identity=studioAssistanceDatabaseIdentity(connection);
  if(options.target!==identity)throw new Error('Database target identity does not match --target. No database operation was performed.');
  if(options.environment==='local'&&!/^(localhost|127\.0\.0\.1|\[::1\]|\/)/.test(identity))throw new Error('The local environment requires a loopback or Unix-socket database.');
  if(options.list){if(options.call||options.action||options.apply||options.operator||options.reason)throw new Error('--list cannot be combined with a resolution.');}
  else if(!options.call||!options.action)throw new Error('Choose --call and --action, or --list.');
  if(options.apply&&(!options.operator||!options.reason))throw new Error('--apply requires an explicit operator and support reason.');
  return options;
}
