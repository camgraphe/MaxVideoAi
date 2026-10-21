import {loadSupabaseClient} from '../../frontend/src/lib/supabaseClientLoader';

/** Replace only the external session adapter; ownedAuthFetch remains real. */
export async function uploadSessionFixture() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://auth.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-public-key';
  const channel=Object.getOwnPropertyDescriptor(globalThis,'BroadcastChannel');
  Object.defineProperty(globalThis,'BroadcastChannel',{configurable:true,value:undefined});
  let client:Awaited<ReturnType<typeof loadSupabaseClient>>;
  try {client=await loadSupabaseClient();}
  finally {if(channel)Object.defineProperty(globalThis,'BroadcastChannel',channel);else Reflect.deleteProperty(globalThis,'BroadcastChannel');}
  await client.auth.stopAutoRefresh();
  const previous=client.auth.getSession;
  let userId:string|null='account-A';
  client.auth.getSession=async()=>({data:{session:userId?{access_token:'token-'+userId,user:{id:userId}}:null},error:null}) as Awaited<ReturnType<typeof previous>>;
  return {
    switchTo(id:string|null){userId=id;},
    restore(){client.auth.getSession=previous;},
  };
}
